import {ExpirableStore} from "pinia-expirable-store";
import {Token} from "./Token";
import {StoreType} from "./Stores";

export interface AuthConfig {
    method: string,
    route: string,
    notAuthRedirect: () => void,

    stateless?: {
        tokenStore: StoreType|ExpirableStore|string,
        formatToken: (raw: unknown) => Token;
    } | undefined,
    stateful?: {
        csrfRoute?: string,
        beforeAuth: (request: Record<string, unknown>, headers: Record<string, string>) => void,
    }
}

export interface ApiConfig {
    base: string;
    version?: string;
    routes: Record<string, string>;

    auth?: AuthConfig
}