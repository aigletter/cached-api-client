class Singleflight {
    private DEFAULT_TIMEOUT = 3000;

    private CHECK_INTERVAL = 200;

    private processes: Record<string, boolean> = {};

    public async run <T>(key: string, callback: () => T | Promise<T>, options: Record<string, any> = {}): Promise<T> {
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

let instance: Singleflight;

export default function useSingleflight() {
    if (!instance) {
        instance = new Singleflight();
    }
    return instance;
}