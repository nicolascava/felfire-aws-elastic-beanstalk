import fs from 'fs-extra';
import path from 'path';

/**
 * Setup New Relic configuration
 *
 * @returns {Promise}
 */
export default function () {
  return new Promise((resolve) => {
    fs.copySync(
      path.join(__dirname, '../config/sns/sns.config'),
      path.join(process.cwd(), './build/eb/.ebextensions/04_sns.config'),
    );

    resolve();
  });
}
