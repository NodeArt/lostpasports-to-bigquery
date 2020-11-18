const { BigQuery } = require('@google-cloud/bigquery');

const { exportToBQ, getTable } = require('../src/export');
const config = require('../config');


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
    if (Object.values(bqConfig).includes(undefined) || !config.sourceId) {
        console.error('Required env options are missed. Unable to start');
        process.exit(1);
    }

    // for await (let item of getLinks([config.sourceId])) {
    //     console.log("Item is ", item.result.url);
    // }

    const bq = new BigQuery(bqConfig);

    await getTable(bq);
    await exportToBQ(bq);

    console.log('Export completed!');
};

main();
