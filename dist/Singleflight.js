class Singleflight {
    constructor() {
        this.DEFAULT_TIMEOUT = 3000;
        this.CHECK_INTERVAL = 200;
        this.processes = {};
    }
    async run(key, callback, options = {}) {
        if (this.processes.hasOwnProperty(key)) {
            return new Promise((resolve) => {
                const start = Date.now();
                const timeout = options.timeout || this.DEFAULT_TIMEOUT;
                const interval = setInterval(() => {
                    const time = Date.now() - start;
                    console.log('Wait...', time);
                    if (time > timeout || !this.processes.hasOwnProperty(key)) {
                        clearInterval(interval);
                        resolve(callback());
                    }
                }, this.CHECK_INTERVAL);
            });
        }
        this.processes[key] = true;
        const promise = Promise.resolve(callback());
        promise.finally(() => {
            delete this.processes[key];
        });
        return promise;
    }
}
let instance;
export default function useSingleflight() {
    if (!instance) {
        instance = new Singleflight();
    }
    return instance;
}
