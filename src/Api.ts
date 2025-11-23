import axios, {type AxiosError, AxiosRequestConfig, type AxiosResponse} from "axios";
import {ExpirableStore} from "pinia-expirable-store";
import {ApiConfig, TokenStore} from "./Config";
import useSingleflight from "./Singleflight";
import {StoreType, TokenStoreAdapter, useApiStoreLocal, useApiStoreMemory, useApiStoreSession} from "./Stores";
import {Token} from "./Token";
import {Auth, makeAuth} from "./Auth";

export interface Api {
    options(options: Record<string, unknown>): Api;

    cache (ttl?: number, storage?: 'memory' | 'session' | 'local'): Api;

    method (method: string): Api;

    header (key: string, value: string): Api;

    headers (headers: Record<string, string>): Api;

    body (body: Record<string, any>): Api;

    url(name: string, params?: Record<string, any>): Api;

    get(url?: string): Promise<AxiosResponse>;

    post(url?: string, body?: Record<string, any>, headers?: Record<string, string>): Promise<AxiosResponse>;

    put(url?: string, body?: Record<string, any>, headers?: Record<string, string>): Promise<AxiosResponse>;

    delete(url?: string): Promise<AxiosResponse>;

    send (url?: string): Promise<AxiosResponse>;

    buildUrl(path: string, params?: Record<string, any>): string;


    auth(email: string, password: string, remember?: boolean): Promise<AxiosResponse>;
}

interface Cache {
    store: ExpirableStore,
    ttl?: number
}

class ApiService implements Api {
    private _url: string = '';

    private _method: string = 'GET';

    private _body: Record<string, unknown> = {};

    private _headers: Record<string, string> = {};

    private _options: Record<string, unknown> = {};

    private _cache?: Cache;

    constructor(private readonly config: ApiConfig, private readonly authService?: Auth) {

    }


    /*%%%%%%% public %%%%%%%*/

    public options(options: Record<string, unknown>): Api {
        this._options = options;
        return this;
    }

    public cache (ttl?: number, storage: 'memory' | 'session' | 'local' = 'memory') {
        this._cache = {
            store: StoreType.getStore(storage),
            ttl: ttl
        }

        return this;
    }

    public method (method: string): Api {
        this._method = method;
        return this;
    }

    public header (key: string, value: string): Api {
        this._headers[key] = value;
        return this;
    }

    public headers (headers: Record<string, string>): Api {
        this._headers = headers;
        return this;
    }

    public body (body: Record<string, any>): Api {
        this._body = body;
        return this;
    }

    public url(name: string, params: Record<string, any> = {}): Api {
        if (!this.hasRoute(name)) {
            throw new Error(`Route "${name}" not found`);
        }

        let path = this.getRoute(name);

        const cloned = Object.assign({}, params);
        // Підстановка параметрів {id}, {slug} тощо
        Object.keys(cloned).forEach(key => {
            const template = `{${key}}`;
            if (path.includes(template)) {
                path = path.replace(template, encodeURIComponent(cloned[key]));
                delete cloned[key];
            }
        });

        const match = path.match(/\{(\w+)\}/);
        if (match) {
            throw new Error(match[1] + ' parameter is required in route "' + this.getRoute(name) + '"');
        }

        // Якщо base є — додаємо перед шляхом
        const base = this.getBaseUrl();
        const url = `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

        this._url = this.buildUrlParams(url, cloned);

        return this;
    }

    public async get(url?: string): Promise<AxiosResponse> {
        url = this.checkAndGetUrl(url);

        return this.fetch(url);
    }

    public async post(url?: string, body?: Record<string, any>, headers?: Record<string, string>): Promise<AxiosResponse> {
        url = this.checkAndGetUrl(url);
        this.method('POST');
        if (body) {
            this.body(body);
        }
        return this.send(url);
    }

    public async put(url?: string, body?: Record<string, any>, headers?: Record<string, string>): Promise<AxiosResponse> {
        url = this.checkAndGetUrl(url);
        this.method('PUT');
        if (body) {
            this.body(body);
        }
        return this.send(url);
    }

    public async delete(url?: string): Promise<AxiosResponse> {
        url = this.checkAndGetUrl(url);
        this.method('DELETE');

        return this.send(url);
    }

    public async fetch (url: string): Promise<AxiosResponse> {
        const response = await useSingleflight().run(url, async () => {
            if (this.isCacheable() && this.inCache(url)) {
                console.log('Return cached response');
                return Promise.resolve(this.getFromCache(url)).finally(() => {
                    this.reset();
                });
            }

            return this.send(url);
        });
        if (!response) {
            throw new Error('Empty response');
        }
        return response;
    }

    public async send (url?: string): Promise<AxiosResponse> {
        url = url || this._url;
        if (!url) {
            throw new Error('Url is required');
        }
        const response = await this.request(url, this._method, this._body, this._headers, this._options);
        this.reset();
        return response;
    }

    public buildUrl(path: string, params: Record<string, any> = {}): string {
        const current = this._url;
        this.url(path, params);
        const url = this._url;
        this._url = current;

        return url;
    }

    /**
     * @param email
     * @param password
     * @param remember
     */
    public async auth(email: string, password: string, remember?: boolean): Promise<AxiosResponse> {
        if (!this.authService) {
            throw new Error('Auth service is not provided');
        }

        return await this.authService.auth(this, email, password, remember);
    }


    /*%%%%%%% PRIVATE %%%%%%%*/

    /*private getStore(storage: string|StoreType): ExpirableStore {
        const storeType = typeof storage === 'string' ? StoreType.fromValue(storage) : storage;
        switch (storeType) {
            case StoreType.session:
                return  useApiStoreSession() as unknown as ExpirableStore;
            case StoreType.local:
                return  useApiStoreLocal() as unknown as ExpirableStore;
            default:
                return  useApiStoreMemory() as unknown as ExpirableStore;
        }
    }*/

    private checkAndGetUrl(url?: string): string {
        url = url || this._url;
        if (!url) {
            throw new Error('Url is required');
        }
        return url;
    }

    private reset () {
        this._method = 'GET';
        this._body = {};
        this._headers = {};
        this._options = {};
        this._url = '';
        this._cache = undefined;
    }

    private inCache(key: string): boolean {
        if (!this._cache) {
            return false;
        }
        return this._cache.store.has(key);
    }

    private isResponseSuccess (response: AxiosResponse) {
        return response.status >= 200 && response.status < 300;
    }

    private isResponseUnauthorized (response: AxiosResponse|null, error: AxiosError|null = null): boolean {
        if (response && response.status === 401) {
            return true;
        }
        return error?.response?.status === 401;
    }

    private getFromCache (key: string): AxiosResponse|null {
        if (this.inCache(key)) {
            const cached = this._cache?.store.get(key);
            if (!cached) {
                return null;
            }
            return cached as AxiosResponse;
        }
        return null;
    }

    private setToCache (key: string, response: any): void {
        if (!this._cache) {
            throw new Error('Cache is not initialized');
        }
        this._cache.store.set(key, {
            status: response.status,
            statusText: response.statusText,
            headers: { ...response.headers },
            data: response.data,
        }, this._cache.ttl);
    }

    private buildUrlParams (url: string, params = {}): string {
        if (Object.keys(params).length === 0) {
            return url;
        }
        const query = new URLSearchParams(params).toString();
        return `${url}?${query}`;
    }

    private handleUnauthorized(): void {
        if (!this.authService) {
            throw new Error('Auth service is not implement');
        }
        this.authService.handleUnauthorized();
        /*if (this.config.auth && this.config.auth.notAuthRedirect) {
            this.config.auth.notAuthRedirect();
        }*/
    }

    private hasRoute(key: string): boolean {
        return this.config.routes.hasOwnProperty(key);
    }

    private getRoute(key: string): string {
        return this.config.routes[key];
    }

    private getBaseUrl(): string {
        if (!this.config.version) {
            return this.config.base;
        }
        return this.config.base + '/' + this.config.version;
    }

    private isCacheable(): boolean {
        if (this._method !== 'GET') {
            return false;
        }
        return !!this._cache;
    }

    private isWithCredentials(): boolean {
        return !!this.config.auth?.stateful;
    }

    private async request(
        url: string,
        method: string,
        body: Record<string, any>,
        headers: Record<string, any>,
        options: Record<string, unknown> = {}
    ) {
        const requestConfig: AxiosRequestConfig = Object.assign({
            url: url,
            method: method,
            data: body,
            headers: headers,
        }, options);

        if (this.authService) {
            this.authService.authorizeRequest(requestConfig);
        }

        if (this.isWithCredentials()) {
            requestConfig.withCredentials = true;
        }

        if (this.config.beforeRequest) {
            this.config.beforeRequest(requestConfig);
        }

        try {
            const response = await axios(requestConfig);

            if (this.isResponseUnauthorized(response)) {
                this.handleUnauthorized();
            }

            if (this.isCacheable()) {
                this.setToCache(url, response);
            }

            return response;
        } catch (error) {
            const err = error as AxiosError;
            if (this.isResponseUnauthorized(null, err)) {
                this.handleUnauthorized();
            }

            throw error;
        }
    }
}

let apiConfig: ApiConfig;
let instance: Api;

export function provideApiConfig(config: ApiConfig) {
    apiConfig = config;
}

export function useApi(): Api {
    /*if (!instance) {
        if (!apiConfig) {
            throw new Error('ApiConfig is not provided');
        }
        instance = new ApiImpl(apiConfig);
    }
    return instance;*/
    let authService: Auth | undefined = undefined;
    if (apiConfig.auth) {
        authService = makeAuth(apiConfig.auth);
    }
    return new ApiService(apiConfig, authService);
}