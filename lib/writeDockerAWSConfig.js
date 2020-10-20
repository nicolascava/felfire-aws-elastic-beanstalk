import fs from 'fs-extra';
import path from 'path';
import mkdirp from 'mkdirp';

/**
 * Write Docker for AWS configuration based on specified configuration
 * and environment variables.
 *
 * @param {String|null} inputEnvFile
 * @param {String|null} bucket
 * @param {String|null} dockerImage
 * @param {Number} port
 * @param {Array} secrets
 * @param {String} versionName
 * @param {Object} compiler
 * @returns {Promise}
 */
export default function (props) {
  const {
    inputEnvFile,
    bucket,
    dockerImage,
    port,
    secrets,
    versionName,
    compiler,
  } = props;

  return new Promise((resolve) => {
    let envFile = null;

    if (inputEnvFile) {
      try {
        envFile = fs.readFileSync(path.join(process.cwd(), inputEnvFile), 'utf8');
      } catch (error) {
        throw new Error(`File not found: ${inputEnvFile} doesn't exists.`);
      }
    } else {
      compiler.log.info('No environment file specified. Skipping environment variables ' +
        'injection into environment.');
    }

    const env = {};
    const dockerForAws = {
      AWSEBDockerrunVersion: 2,
      authentication: {
        key: 'dockercfg',
        bucket,
      },
      containerDefinitions: [
        {
          name: 'elastic-beanstalk',
          essential: true,
          memory: 496,
          image: `${dockerImage}:${versionName}`,
          portMappings: [
            {
              hostPort: 80,
              containerPort: port,
            },
          ],
          mountPoints: [],
          environment: [],
        },
      ],
    };

    if (envFile) {
      envFile.split('\n').map((item) => {
        const tmpEnv = item.split('=');

        // eslint-disable-next-line prefer-destructuring
        if (item !== '') env[tmpEnv[0]] = tmpEnv[1];

        return env;
      });
    }

    secrets.map((encryptedEnvItem) => {
      env[encryptedEnvItem] = process.env[encryptedEnvItem];

      return encryptedEnvItem;
    });

    Object.keys(env).forEach((envProperty) => {
      dockerForAws.containerDefinitions[0].environment.push({
        name: envProperty,
        value: env[envProperty],
      });
    });

    return mkdirp(path.join(process.cwd(), './build/eb'), () => {
      const computedPath = path.join(process.cwd(), './build/eb/Dockerrun.aws.json');

      fs.writeFileSync(computedPath, JSON.stringify(dockerForAws));

      return resolve();
    });
  });
}
