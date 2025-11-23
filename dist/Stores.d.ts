import { ExpirableStore } from "pinia-expirable-store";
import { TokenStore } from "./Config";
import { Token } from "./Token";
export declare enum StoreType {
    local = "local",
    session = "session",
    memory = "memory"
}
export declare namespace StoreType {
    function fromValue(value: string): StoreType;
    function getStore(storage: string | StoreType): ExpirableStore;
}
export declare function useApiStoreMemory(): ExpirableStore;
export declare function useApiStoreLocal(): ExpirableStore;
export declare function useApiStoreSession(): ExpirableStore;
export declare class TokenStoreAdapter implements TokenStore {
    private store;
    private tokenStoreKey;
    constructor(store: ExpirableStore);
    get(): Token | null;
    set(token: Token): void;
    forget(): void;
}
//# sourceMappingURL=Stores.d.ts.map