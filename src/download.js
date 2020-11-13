const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const es = require('event-stream');

const { downloadConfig: config } = require('../config');


const dlResource = (url, cfg = {}) => {
    const defaultCfg = { maxRetries: 4, method: 'GET' };
    cfg = { ...defaultCfg, ...cfg };
    return axios({
        method: cfg.method,
        responseType: 'stream',
        url,
    });
};

module.exports.parseFiles = async (url) => {
    const document = await axios.get(url);
    const $ = cheerio.load(document.data);
    const result = [];

    $('#dataset-resources .resource-item').each((i, el) => {
        result.push({
            url: $(el).find('.fa-arrow-circle-o-down').closest('a').first().attr('href'),
            name: $(el).find('a.heading').first().attr('title'),
        });
    });

    return result;
};


module.exports.downloadAll = async (fileLinks) => {
    const skipBOMChar = () => {
        let completed = false;
        return (data) => {
            if (completed) return data;
            let content = data.toString('utf8');
            if (content.charAt(0) === '\uFEFF') {
                content = content.substr(1);
            }
            completed = true;
            return Buffer.from(content, 'utf8');
        };
    };


    for (let file of fileLinks) {
        if (file.name.toLowerCase().includes('shema')) {
            console.log('Skip ', file.name);
            continue; // Skip files with shema description
        }
        console.log(`Loading ${file.name}`);

        let fileName = file.name;
        const ext = path.extname(file.url);

        if (!fileName.endsWith(ext)) fileName += ext;

        const savePath = path.join(config.dataFolder, fileName);
        const stream = (await dlResource(file.url)).data;
        const streamComplete = new Promise((resolve, reject) => {
            stream.on('close', resolve);
            stream.on('error', reject);
        });

        stream
            .pipe(es.mapSync(skipBOMChar()))
            .pipe(fs.createWriteStream(savePath, { encoding: 'utf8' }));

        await streamComplete;
    }
};
