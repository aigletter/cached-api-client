import {ExpirableStore} from "pinia-expirable-store";
import {Token} from "./Token";
import {StoreType} from "./Stores";

export interface Auth {
    method: string,
    route: string,
    notAuthRedirect: Function,
    tokenStore: StoreType|ExpirableStore,
    formatToken: (raw: unknown) => Token;
}

export interface ApiConfig {
    base: string;
    version?: string;
    routes: Record<string, string>;
    auth?: Auth
}