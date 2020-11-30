const wait = require("./wait");
const axios = require("axios");
const { PassThrough } = require("stream");


class RetryStreamError extends Error {
    constructor (message) {
        super(message);
        this.name = "RetryStreamError";
    }
}

class RetryStream {
    constructor (requestConfig, config = {}) {
        const { entryStream, maxRetries, retryDelay, streamTimeout } = config;
        this.requestConfig = requestConfig;
        this.entryStream = entryStream || new PassThrough();
        this.contentLength = null;
        this.contentReceived = 0;
        this.retryCount = 0;

        this.maxRetries = maxRetries || 3;
        this.retryDelay = retryDelay || 2 * 1e3;
        this.streamTimeout = streamTimeout || 5 * 1e3;

        this.writeData = this.writeData.bind(this);
        this.makePipe = this.makePipe.bind(this);
        this.lastChunk = null;
        this.readableStream = null;
        this.lastUpdate = null;
        this.completed = false;
    }

    async _makeRequest () {
        // template method. Must return readable stream
    }

    async makeRequest () {
        console.log("Making request at byte ", this.contentReceived);
        if (this.retryCount >= this.maxRetries) {
            const err = new RetryStreamError("Max retries");
            this.completed = true;
            this.entryStream.emit("error", err);
            throw err;
        }
        if (this.retryCount > 0) await wait(this.retryDelay);

        let stream;
        try {
            stream = await this._makeRequest();
            this.retryCount = 0;
        } catch (e) {
            if (e instanceof RetryStreamError) {
                this.completed = true;
                this.entryStream.emit("error", e);
                throw e;
            }
            this.retryCount++;
            return (await this.makeRequest());
        }
        return this.makePipe(stream);
    }

    hasMoreData () {
        return this.contentLength > this.contentReceived;
    }

    makePipe (readableStream) {
        readableStream.on("data", this.writeData);
        readableStream.on("end", () => {
            if (!this.hasMoreData()) {
                this.completed = true;
                return this.entryStream.end();
            }
            this.readableStream = null;
            this.makeRequest().catch(e => {});
        });
        this.readableStream = readableStream;
        this.lastUpdate = new Date();
        this.addStreamTimeout(readableStream);

        return this.entryStream;
    }

    writeData (data) {
        this.contentReceived += data.length;
        this.lastUpdate = new Date();
        const written = this.entryStream.write(data);

        if (!written) {
            this.readableStream.pause();
            this.entryStream.once("drain", () => this.readableStream.resume());
        }
    }

    addStreamTimeout (stream) {
        const id = setInterval(() => {
            if (new Date() - this.lastUpdate > this.streamTimeout) stream.destroy();
        }, this.streamTimeout);
        stream.on("end", () => clearInterval(id));
        stream.on("close", () => clearInterval(id));
    }
}

class AxiosRetryStream extends RetryStream {
    async _makeRequest () {
        const reqConfig = { ...this.requestConfig };
        if (!reqConfig.headers) {
            reqConfig.headers = {};
        }
        reqConfig.headers.Accept = "application/octet-stream";
        reqConfig.responseType = "stream";

        let resp;
        if (this.contentReceived > 0) {
            reqConfig.headers.Range = `bytes=${this.contentReceived}-`;
            resp = await axios.request(reqConfig);
            if (resp.status !== 206) {
                throw new RetryStreamError("Content range request is not supported by server");
            }
        } else {
            resp = await axios.request(reqConfig);
            if (resp.status !== 200) throw new Error(`Received ${resp.status} status code from server`);
            this.contentLength = parseInt(resp.headers["content-length"]);
        }
        return resp.data;
    }
}



module.exports = AxiosRetryStream;
