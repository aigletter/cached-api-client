import {Token} from "./Token";
import {StoreType} from "./Stores";
import {AxiosRequestConfig} from "axios";

export interface TokenStore {
    get(): Token | null;
    set(token: Token): void;
    forget(): void;
}

export interface AuthConfig {
    method: string,
    route: string,
    notAuthRedirect: () => void,

    stateless?: {
        tokenStore: StoreType|TokenStore|string,
        formatToken: (raw: unknown) => Token;
    } | undefined,
    stateful?: {
        csrfRoute?: string,
    }
}

export interface ApiConfig {
    base: string;
    version?: string;
    routes: Record<string, string>;
    beforeRequest?: (request: AxiosRequestConfig) => void,
    auth?: AuthConfig
}