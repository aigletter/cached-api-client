import defineExpirableStore from "pinia-expirable-store";
export var StoreType;
(function (StoreType) {
    StoreType["local"] = "local";
    StoreType["session"] = "session";
    StoreType["memory"] = "memory";
})(StoreType || (StoreType = {}));
(function (StoreType) {
    function fromValue(value) {
        if (Object.values(StoreType).includes(value)) {
            return value;
        }
        throw new Error('Unknown store type');
    }
    StoreType.fromValue = fromValue;
    function getStore(storage) {
        const storeType = typeof storage === 'string' ? StoreType.fromValue(storage) : storage;
        switch (storeType) {
            case StoreType.session:
                return useApiStoreSession();
            case StoreType.local:
                return useApiStoreLocal();
            default:
                return useApiStoreMemory();
        }
    }
    StoreType.getStore = getStore;
})(StoreType || (StoreType = {}));
export function useApiStoreMemory() {
    return defineExpirableStore('apiMemory')();
}
export function useApiStoreLocal() {
    return defineExpirableStore('apiLocal', {
        persist: true
    })();
}
export function useApiStoreSession() {
    return defineExpirableStore('apiSession', {
        persist: {
            storage: sessionStorage
        }
    })();
}
export class TokenStoreAdapter {
    constructor(store) {
        this.store = store;
        this.tokenStoreKey = 'token';
    }
    get() {
        const token = this.store.get(this.tokenStoreKey);
        return token || null;
    }
    set(token) {
        this.store.set(this.tokenStoreKey, token);
    }
    forget() {
        this.store.remove(this.tokenStoreKey);
    }
}
