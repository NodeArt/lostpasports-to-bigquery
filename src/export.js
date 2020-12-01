const es = require('event-stream');
const JSONStream = require('JSONStream');
const axios = require('axios');
const rax = require('retry-axios');
const { parse: parseCSV } = require('@fast-csv/parse');
const { promisify } = require("util");

let { pipeline } = require("stream");
pipeline = promisify(pipeline);

const config = require('../config');
const { passportTableSchema } = require('../schema');
const AxiosRetryStream = require("./utils/retry-stream");

const API_URL = 'https://data.gov.ua/api/3';

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

const getLinks = async function * (datasetList) {
    const client = axios.create({ timeout: config.requestTimeout });
    client.defaults.raxConfig = {
        instance: client,
        retry: config.requestMaxRetries,
        noResponseRetries: config.requestMaxRetries,
        backoffType: "static",
        retryDelay: config.requestRetryDelay,
        onRetryAttempt: err => {
            const cfg = rax.getConfig(err);
            console.log(`Retry attempt #${cfg.currentRetryAttempt}`);
        },
    };
    const interceptorId = rax.attach(client);

    for (let datasetId of datasetList) {
        const resp = await client.request(`${API_URL}/action/package_show?id=${datasetId}`);
        if (!resp.status === 200) {
            console.warn(`Received ${resp.status} for dataset ${datasetId}`);
            continue;
        }
        const resources = resp.data.result && resp.data.result.resources ? resp.data.result.resources : [];
        if (!resources.length) {
            console.warn(`Resouce list is empty for dataset ${datasetId}`);
            continue;
        }
        for (let resource of resources) {
            const resp = await client.request(`${API_URL}/action/resource_show?id=${resource.id}`);
            if (!resp.status === 200) {
                console.warn(`Received ${resp.status} for resource ${resource.id}(${resource.name}) of dataset ${datasetId}`);
                continue;
            }
            yield resp.data.result;
        }
    }
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
    const selectParser = (item) => {
        if (item.mimetype === 'application/json') return JSONStream.parse('*');
        else if (item.mimetype === 'text/csv') return parseCSV(csvOptions);
        return null;
    };

    const skipBOMChar = () => {
        let completed = false;
        return (data) => {
            if (completed) return data;
            const content = data.toString('utf8');
            if (content.charAt(0) === '\uFEFF') {
                const buff = Buffer.allocUnsafe(data.length - 3);
                data.copy(buff, 0, 3);
                data = buff;
            }
            completed = true;
            return data;
        };
    };

    const fields = passportTableSchema.map(el => el.name);
    const uniqPassports = new Set();
    const items = getLinks([config.sourceId]);

    let cnt = 0;

    for await (let item of items) {
        const parser = selectParser(item);
        let transformFn;

        if (!parser) {
            console.warn("No parsers found for item. Skip");
            continue;
        }
        console.log(`Streaming resource ${item.name} to BQ table ${config.datasetID}.${config.tableID}`);
        const retryStream = new AxiosRetryStream(
            { method: "GET", url: item.url },
            { maxRetries: config.requestMaxRetries, retryDelay: config.requestRetryDelay, streamTimeout: config.streamTimeout },
        );
        const stream = await retryStream.makeRequest();

        await pipeline(
            stream,
            es.mapSync(skipBOMChar()),
            parser,
            es.mapSync((data) => {
                if (!transformFn) {
                    transformFn = typeof data.D_SERIES !== 'undefined' ? transformFromDFields : data => data;
                }

                const item = selectFields(transformFn(data), fields);
                if (!item) return; // Drop items with wrong fields
                const ln = uniqPassports.size;
                if (uniqPassports.add(item.series + item.number).size === ln) return; // Drop non-unique item

                cnt++;
                if (cnt % 10000 === 0) console.log(`${cnt} items processed`);

                return JSON.stringify(item) + '\n';
            }),
            bq.dataset(config.datasetID).table(config.tableID).createWriteStream({
                sourceFormat: 'NEWLINE_DELIMITED_JSON',
            }),
        );
    }
};
