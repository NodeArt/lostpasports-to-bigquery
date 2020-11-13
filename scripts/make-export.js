const fse = require('fs-extra');
const { BigQuery } = require('@google-cloud/bigquery');

const { exportToBQ, getTable } = require('../src/export');
const { exportConfig: config } = require('../config');


const getBqConfig = () => {
    if (config.bqAuthKeyFile) {
        return {
            projectId: config.projectId,
            keyFilename: config.bqAuthKeyFile,
        };
    } else {
        return {
            projectId: config.projectId,
            credentials: {
                client_email: config.clientEmail,
                private_key: decodeURI(config.privateKey),
            },
            clientOptions: {
                clientId: config.clientId,
            },
        };
    }
};

const main = async () => {
    const bqConfig = getBqConfig();
    if (Object.values(bqConfig).includes(undefined)) {
        console.error('Required env options are missed. Unable to start');
        process.exit(1);
    }

    const bq = new BigQuery(bqConfig);

    await getTable(bq);
    await exportToBQ(bq);
    if (config.dropFiles) {
        console.log('Cleaning up..');
        fse.removeSync(config.dataFolder);
    }
    console.log('Export completed!');
};

main();
