import { type AxiosResponse } from "axios";
import { ApiConfig } from "./Config";
export interface Api {
    options(options: Record<string, unknown>): Api;
    cache(ttl?: number, storage?: 'memory' | 'session' | 'local'): Api;
    method(method: string): Api;
    header(key: string, value: string): Api;
    headers(headers: Record<string, string>): Api;
    body(body: Record<string, any>): Api;
    url(name: string, params?: Record<string, any>): Api;
    get(url?: string): Promise<AxiosResponse>;
    post(url?: string, body?: Record<string, any>, headers?: Record<string, string>): Promise<AxiosResponse>;
    put(url?: string, body?: Record<string, any>, headers?: Record<string, string>): Promise<AxiosResponse>;
    delete(url?: string): Promise<AxiosResponse>;
    send(url?: string): Promise<AxiosResponse>;
    buildUrl(path: string, params?: Record<string, any>): string;
    auth(email: string, password: string, remember?: boolean): Promise<AxiosResponse>;
}
export declare function provideApiConfig(config: ApiConfig): void;
export declare function useApi(): Api;
//# sourceMappingURL=Api.d.ts.map