const { BigQuery } = require('@google-cloud/bigquery');

const { exportToBQ, getTable } = require('../src/export');
const config = require('../config');


const getBqConfig = () => {
    const { projectId, clientId, clientEmail, privateKey } = config.bqCredents;

    if (config.bqAuthKeyFile && projectId) {
        return {
            projectId,
            keyFilename: config.bqAuthKeyFile,
        };
    } else if (Object.values(config.bqCredents).includes(undefined)) return;

    return {
        projectId,
        credentials: {
            client_email: clientEmail,
            private_key: decodeURI(privateKey),
        },
        clientOptions: {
            clientId,
        },
    };
};

const main = async () => {
    const bqConfig = getBqConfig();
    if (!bqConfig || !config.sourceId) {
        console.error('Required env options are missed. Unable to start');
        process.exit(1);
    }

    const bq = new BigQuery(bqConfig);

    await getTable(bq);
    await exportToBQ(bq);


    console.log('Export completed!');
};

main();
