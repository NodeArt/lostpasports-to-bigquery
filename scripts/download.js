const fs = require('fs');
const fse = require('fs-extra');

const { downloadConfig: config } = require('../config');
const { parseFiles, downloadAll } = require('../src/download');


const main = async () => {
    if (config.dropFiles) fse.removeSync(config.dataFolder);
    if (!fs.existsSync(config.dataFolder)) fs.mkdirSync(config.dataFolder);

    let uriList;
    if (config.sourceFile) {
        const contents = fs.readFileSync(config.sourceFile);
        try {
            const _links = JSON.parse(contents);
            if (!Array.isArray(_links)) throw new Error('Array expected');
            uriList = _links;
        } catch (e) {
            console.error('Source file content in wrong format. JSON-array of uri`s expected');
            process.exit(1);
        }
    } else if (config.sourceLink) {
        uriList = [config.sourceLink];
    } else {
        console.error('No uri`s specified. Exit');
        process.exit(1);
    }


    const _result = await Promise.all(uriList.map(parseFiles));
    let files = [];

    for (let item of _result) {
        files = files.concat(item);
    }

    if (!files.length) {
        console.warn('No files found for specified source. Try to check url. Also, the page structure may change. In this case parse function will need some adjustments');
        process.exit(1);
    }
    console.log(`Found ${files.length} file(s)`);
    downloadAll(files);
};

main();


