const os = require('os');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const _val = (val1, val2) => {
    return typeof val1 === 'string' ? val1 : val2;
};

const config = {
    dataFolder: path.join(_val(process.env.DATA_DIR, os.tmpdir()), 'data_gov_ua_dl'),
    dropFiles: _val(process.env.DROP_FILES, '1') === '1',
};

module.exports.exportConfig = {
    datasetID: process.env.DATASET_NAME,
    tableID: process.env.TABLE,
    bqAuthKeyFile: process.env.BQ_AUTH_KEY_FILE,
    projectId: process.env.PROJECT_ID,
    privateKey: process.env.PRIVATE_KEY,
    clientId: process.env.CLIENT_ID,
    clientEmail: process.env.CLIENT_EMAIL,
    ...config,
};

module.exports.downloadConfig = {
    sourceLink: _val(process.env.SOURCE_LINK, 'https://data.gov.ua/dataset/ab09ed00-4f51-4f6c-a2f7-1b2fb118be0f'),
    sourceFile: _val(process.env.SOURCE_FILE),
    ...config,
};
