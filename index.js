import cp from 'child_process';
import _ from 'lodash';

import setupSNS from './lib/setupSNS';
import writeDockerAWSConfig from './lib/writeDockerAWSConfig';

/**
 * Init plugin with command options
 *
 * @param {Object} commander
 * @returns {Object}
 */
export function init(commander) {
  const text = 'the AWS Elastic Beanstalk environment that Felfire must deploys to';

  commander.option('--env <env>', text);

  return commander;
}

/**
 * Write Docker for AWS configuration and Elastic Beanstalk extensions,
 * zip it, deploy it to corresponding S3 bucket, create a new Elastic Beanstalk app version,
 * and finally update the corresponding environment.
 *
 * @param {Object} compiler
 * @param {Object} commander
 * @returns {Promise}
 */
export default function ({ compiler, commander }) {
  const pluginConfigRaw = _.find(compiler.config.plugins, plugin =>
    plugin[0] === 'aws-elastic-beanstalk');
  const message = 'Missing plugin\'s configuration properties. See all mandatory properties ' +
    'in the documentation: https://github.com/nicolascava/felfire-aws-elastic-beanstalk#' +
    'configuration.';

  if (!pluginConfigRaw) throw new Error(message);

  const pluginConfig = pluginConfigRaw[1];
  const versionName = process.env[pluginConfig.version];
  const { port } = compiler.config;
  const {
    app,
    bucket,
    region,
    keyPrefix,
    dockerImage,
    snsTopic,
  } = pluginConfig;

  // eslint-disable-next-line no-underscore-dangle
  const args = _.find(commander.commands, command => command._name === 'aws-elastic-beanstalk');

  const { envFile } = commander;
  const { env } = args;
  const secondMessage = 'Missing mandatory configuration properties. See all mandatory ' +
    'properties in the documentation: https://github.com/nicolascava/felfire-aws-elastic-' +
    'beanstalk#configuration.';

  if (!app || !bucket || !region || !dockerImage || !env || !versionName) {
    throw new Error(secondMessage);
  }

  return new Promise(async (resolve) => {
    if (!snsTopic) {
      compiler.log.info('SNS topic configuration not found. Skipping SNS configuration.');
    } else {
      await setupSNS();
    }

    await writeDockerAWSConfig({
      inputEnvFile: envFile || null,
      bucket,
      dockerImage,
      port,
      secrets: pluginConfig.secrets || [],
      versionName,
      compiler,
    });

    const fileName = `${versionName}.zip`;
    const deploymentFileName = `/tmp/${fileName}`;
    const pluginPath = compiler.config.trunkBased ? '..' : 'node_modules';

    let cmd = `cp -R ${pluginPath}/felfire-aws-elastic-beanstalk/config/eb-extensions/* ` +
      'build/eb/.ebextensions/ && ';

    if (snsTopic) {
      cmd += `sed -i "s/{{SNS_TOPIC}}/${snsTopic}/" build/eb/.ebextensions/04_sns.config && `;
    }

    const bucketWithKeyPrefix = keyPrefix ? `${bucket}/${keyPrefix}` : bucket;
    const fileNameWithKeyPrefix = keyPrefix ? `${keyPrefix}/${fileName}` : fileName;

    cp.exec(
      `${cmd}cd build/eb && ` +
      `zip -r "${deploymentFileName}" Dockerrun.aws.json .ebextensions && ` +
      'cd ../../ && ' +
      `aws s3 cp "${deploymentFileName}" "s3://${bucketWithKeyPrefix}/" --region ${region} && ` +
      `aws elasticbeanstalk create-application-version --application-name ${app} --version-label ` +
      `${versionName} --source-bundle S3Bucket=${bucket},S3Key=${fileNameWithKeyPrefix} ` +
      `--region ${region} && ` +
      `aws elasticbeanstalk update-environment --environment-name ${env} --version-label ` +
      `${versionName} --region ${region}`,
      (error, stdout) => {
        if (error) compiler.log.info(error);

        compiler.log.info(stdout);

        return resolve();
      },
    );
  });
}
