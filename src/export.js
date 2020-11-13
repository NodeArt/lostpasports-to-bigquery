const fs = require('fs');
const path = require('path');
const es = require('event-stream');
const JSONStream = require('JSONStream');
const { parse: parseCSV } = require('@fast-csv/parse');

const { exportConfig: config } = require('../config');
const { passportTableSchema } = require('../schema');


const csvOptions = {
    delimiter: ';',
    headers: ['nn', 'status', 'series', 'number', 'date_edit'],
    skipRows: 1,
};


const createTable = (bq) => {
    const options = {
        schema: passportTableSchema,
    };
    console.log(`Create table ${config.datasetID}.${config.tableID}`);
    return bq.dataset(config.datasetID).createTable(config.tableID, options);
};

const transformFromDFields = (data) => { // Adapter from "D_SERIES", "D_NUMBER" etc. Fields must match passportTableSchema
    return {
        series: data.D_SERIES,
        number: data.D_NUMBER,
        status: data.D_STATUS,
    };
};

const selectFields = (data, fields) => {
    const result = {};
    for (let field of fields) {
        if (typeof data[field] === 'undefined') return null;
        result[field] = data[field];
    }
    return result;
};


module.exports.getTable = async (bq) => {
    const exists = await bq.dataset(config.datasetID).table(config.tableID).exists();
    if (exists[0]) {
        console.log(`Drop table ${config.datasetID}.${config.tableID}`);
        await bq.dataset(config.datasetID).table(config.tableID).delete();
    }
    return createTable(bq);
};

module.exports.exportToBQ = async (bq) => {
    function selectFileParser (filename) {
        const ext = path.extname(filename);
        if (ext === '.json') return JSONStream.parse('*');
        else if (ext === '.csv') return parseCSV(csvOptions);
        return null;
    }

    const fields = passportTableSchema.map(el => el.name);
    const files = fs.readdirSync(config.dataFolder);
    const uniqPassports = new Set();


    for (let file of files) {
        const parser = selectFileParser(file);
        let transformFn;

        if (!parser) continue;
        console.log(`Streaming data from file ${file} to BQ table ${config.datasetID}.${config.tableID}`);

        const fStream = fs.createReadStream(path.join(config.dataFolder, file), { encoding: 'utf8' });
        const streamComplete = new Promise((resolve, reject) => {
            fStream.on('close', resolve);
            fStream.on('error', reject);
        });

        fStream
            .pipe(parser)
            .pipe(es.mapSync((data) => {
                if (!transformFn) {
                    transformFn = typeof data.D_SERIES !== 'undefined' ? transformFromDFields : data => data;
                }

                const item = selectFields(transformFn(data), fields);
                if (!item) return; // Drop items with wrong fields
                const ln = uniqPassports.size;
                if (uniqPassports.add(item.series + item.number).size === ln) return; // Drop non-unique item
                return JSON.stringify(item) + '\n';
            }))
            .pipe(bq.dataset(config.datasetID).table(config.tableID).createWriteStream({
                sourceFormat: 'NEWLINE_DELIMITED_JSON',
            }));
        await streamComplete;
    }
};
