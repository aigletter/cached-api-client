import axios, {type AxiosError, type AxiosResponse} from "axios";
import {ExpirableStore} from "pinia-expirable-store";
import {ApiConfig} from "./ApiConfig";
import useSingleflight from "./Singleflight";
import {StoreType, useApiStoreLocal, useApiStoreMemory, useApiStoreSession} from "./Stores";
import {Token} from "./Token";

interface Cache {
    store: ExpirableStore,
    ttl?: number
}

const TOKEN_STORE_KEY = 'token';

class Api {
    private _url: string = '';

    private _method: string = 'GET';

    private _body: Record<string, unknown> = {};

    private _headers: Record<string, string> = {};

    private _cache?: Cache;

    constructor(private readonly config: ApiConfig) {

    }

    private getStore(storage: string|StoreType): ExpirableStore {
        const storeType = typeof storage === 'string' ? StoreType.fromValue(storage) : storage;
        switch (storeType) {
            case StoreType.session:
                return  useApiStoreSession() as unknown as ExpirableStore;
            case StoreType.local:
                return  useApiStoreLocal() as unknown as ExpirableStore;
            default:
                return  useApiStoreMemory() as unknown as ExpirableStore;
        }
    }

    public cache (ttl?: number, storage: 'memory' | 'session' | 'local' = 'memory') {
        this._cache = {
            store: this.getStore(storage),
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

    /*public async get(path: string, params: Record<string, string|number> = {}): Promise<AxiosResponse> {
        path = this.buildUrl(path, params);
        return await this.fetch(path);
    }*/
    public async get(url?: string): Promise<AxiosResponse> {
        url = this.checkAndGetUrl(url);

        return this.fetch(url);
    }

    /*public async post(path: string, params: Record<string, string|number> = {}, body?: Record<string, any>, headers?: Record<string, string>) {
        path = this.buildUrl(path, params);
        this.method('POST');
        if (body) {
            this.body(body);
        }
        return await this.fetch(path);
    }*/
    public async post(url?: string, body?: Record<string, any>, headers?: Record<string, string>) {
        url = this.checkAndGetUrl(url);
        this.method('POST');
        if (body) {
            this.body(body);
        }
        return this.send(url);
    }

    public async put(url?: string, body?: Record<string, any>, headers?: Record<string, string>) {
        url = this.checkAndGetUrl(url);
        this.method('PUT');
        if (body) {
            this.body(body);
        }
        return this.send(url);
    }

    public async delete(url?: string) {
        url = this.checkAndGetUrl(url);
        this.method('DELETE');

        return this.send(url);
    }

    private getTokenStore(): ExpirableStore {
        if (!this.config.auth?.stateless?.tokenStore) {
            return useApiStoreMemory();
        }
        let store = this.config.auth?.stateless.tokenStore;
        if (typeof store === 'string') {
            store = this.getStore(store);
        }
        return store;
    }

    private handleAuthResponse(response: AxiosResponse) {
        // TODO
        if (!this.config.auth) {
            throw new Error('');
        }

        if (this.config.auth.stateless) {
            if (!this.config.auth.stateless.tokenStore) {
                throw new Error('Token store is not initialized')
            }
            const token = this.formatToken(response.data);
            const ttl = this.calculateTokenTtl(token.expires);
            const tokenStore = this.getTokenStore();
            tokenStore.set('token', token, ttl);
        }
    }

    private async beforeAuth(request: Record<string, unknown>, headers: Record<string, string>) {
        if (this.config.auth?.stateful?.csrfRoute) {
            const url = this.buildUrl(this.config.auth?.stateful?.csrfRoute);
            await this.request(url, 'GET', {}, {});
        }
        if (this.config.auth?.stateful?.beforeAuth) {
            this.config.auth?.stateful?.beforeAuth(request, headers);
        }
    }

    public async auth(email: string, password: string, remember?: boolean) {
        // TODO
        if (!this.isAuthenticatable()) {
            throw new Error('');
        }

        const request = {email: email, password: password, remember: remember} as Record<string, any>;
        const headers = {}

        await this.beforeAuth(request, headers);

        const response = await this.post(this.getLoginUrl(), request);

        this.handleAuthResponse(response);

        return response;
    }

    private checkAndGetUrl(url?: string): string {
        url = url || this._url;
        if (!url) {
            throw new Error('Url is required');
        }
        return url;
    }

    private calculateTokenTtl(expires?: Date): number|null {
        if (!expires) {
            return null;
        }

        const now = new Date();
        const diff = expires.getTime() - now.getTime();

        return diff > 0 ? diff : 0;
    }

    private formatToken(response: unknown): Token
    {
        if (!this.config.auth?.stateless?.formatToken) {
            throw new Error('unknown token response format');
        }
        return this.config.auth?.stateless.formatToken(response);
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

    public async send (url: string): Promise<AxiosResponse> {
        const response = await this.request(url, this._method, this._body, this._headers);
        this.reset();
        return response;
    }

    private reset () {
        this._method = 'GET';
        this._body = {};
        this._headers = {};
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

    /*private sendForMethod (method: string, url: string, params: Record<string, any> = {}) {
        this.method(method);
        return this.send(url);
    }*/

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

    private handleUnauthorized(): void
    {
        if (this.config.auth && this.config.auth.notAuthRedirect) {
            //router.push({name: this.config.loginRoute})
            this.config.auth.notAuthRedirect();
        }
    }

    public buildUrl(path: string, params = {}): string {
        const current = this._url;
        this.url(path, params);
        const url = this._url;
        this._url = current;

        return url;
    }

    /*private handleMethod(callback: any) {
        return callback().catch((error: AxiosError) => {
            if (error.response && error.response.status === 401) {
                // Clear storage token
                router.push('/login');
                return error.response;
            } else {
                throw error;
            }
        });
    }*/

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

    private getLoginUrl(): string {
        if (!this.config.auth) {
            throw new Error('Auth is not configured');
        }
        return this.buildUrl(this.config.auth.route);
    }

    private isCacheable(): boolean {
        if (this._method !== 'GET') {
            return false;
        }
        return !!this._cache;
    }

    private isAuthenticatable(): boolean {
        return !!this.config.auth;
    }

    private addAuthRequestHeaders() {
        if (this.config.auth?.stateless) {
            const store = this.getTokenStore();
            const token = store.get<Token>(TOKEN_STORE_KEY);
            if (token) {
                this.header('Authorization', 'Bearer ' + token.token)
            }
        }
    }

    private isWithCredentials(): boolean {
        return !!this.config.auth?.stateful;
    }

    private async request(url: string, method: string, body: Record<string, any>, headers: Record<string, any>) {
        if (this.isAuthenticatable()) {
            this.addAuthRequestHeaders();
        }

        try {
            const response = await axios({
                url: url,
                method: method,
                data: body,
                headers: headers,
                withCredentials: this.isWithCredentials()
            });

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

export function useApi() {
    if (!instance) {
        if (!apiConfig) {
            throw new Error('ApiConfig is not provided');
        }
        instance = new Api(apiConfig);
    }
    return instance;
}