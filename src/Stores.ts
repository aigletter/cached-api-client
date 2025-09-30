import {ExpirableStore} from "pinia-expirable-store";
import defineExpirableStore from "pinia-expirable-store";

export enum StoreType {
    local = 'local',
    session = 'session',
    memory = 'memory'
}

export namespace StoreType {
    export function fromValue(value: string): StoreType {
        if (Object.values(StoreType).includes(value as StoreType)) {
            return value as StoreType;
        }
        throw new Error('Unknown store type');
    }
}

export function useApiStoreMemory(): ExpirableStore {
    return defineExpirableStore('apiMemory')() as unknown as ExpirableStore;
}

export function useApiStoreLocal(): ExpirableStore {
    return  defineExpirableStore('apiLocal', {
        persist: true
    })() as unknown as ExpirableStore;
}

export function useApiStoreSession(): ExpirableStore {
    return defineExpirableStore('apiSession', {
        persist: {
            storage: sessionStorage
        }
    })() as unknown as ExpirableStore;
}
