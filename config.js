const dotenv = require('dotenv');

if (process.env.NODE_ENV === "development") dotenv.config();

module.exports = {
    datasetID: process.env.DATASET_NAME,
    tableID: process.env.TABLE,
    bqAuthKeyFile: process.env.BQ_AUTH_KEY_FILE,
    projectId: process.env.PROJECT_ID,
    privateKey: process.env.PRIVATE_KEY,
    clientId: process.env.CLIENT_ID,
    clientEmail: process.env.CLIENT_EMAIL,
    sourceId: process.env.SOURCE_ID || 'ab09ed00-4f51-4f6c-a2f7-1b2fb118be0f',
    requestTimeout: 10 * 1e3,
    requestMaxRetries: 10,
    requestRetryDelay: 2 * 1e3,
    streamTimeout: 10 * 1e3,
};
