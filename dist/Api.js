import axios from "axios";
import useSingleflight from "./Singleflight";
import { StoreType } from "./Stores";
import { makeAuth } from "./Auth";
class ApiService {
    constructor(config, authService) {
        this.config = config;
        this.authService = authService;
        this._url = '';
        this._method = 'GET';
        this._body = {};
        this._headers = {};
        this._options = {};
    }
    /*%%%%%%% public %%%%%%%*/
    options(options) {
        this._options = options;
        return this;
    }
    cache(ttl, storage = 'memory') {
        this._cache = {
            store: StoreType.getStore(storage),
            ttl: ttl
        };
        return this;
    }
    method(method) {
        this._method = method;
        return this;
    }
    header(key, value) {
        this._headers[key] = value;
        return this;
    }
    headers(headers) {
        this._headers = headers;
        return this;
    }
    body(body) {
        this._body = body;
        return this;
    }
    url(name, params = {}) {
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
    async get(url) {
        url = this.checkAndGetUrl(url);
        return this.fetch(url);
    }
    async post(url, body, headers) {
        url = this.checkAndGetUrl(url);
        this.method('POST');
        if (body) {
            this.body(body);
        }
        return this.send(url);
    }
    async put(url, body, headers) {
        url = this.checkAndGetUrl(url);
        this.method('PUT');
        if (body) {
            this.body(body);
        }
        return this.send(url);
    }
    async delete(url) {
        url = this.checkAndGetUrl(url);
        this.method('DELETE');
        return this.send(url);
    }
    async fetch(url) {
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
    async send(url) {
        url = url || this._url;
        if (!url) {
            throw new Error('Url is required');
        }
        const response = await this.request(url, this._method, this._body, this._headers, this._options);
        this.reset();
        return response;
    }
    buildUrl(path, params = {}) {
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
    async auth(email, password, remember) {
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
    checkAndGetUrl(url) {
        url = url || this._url;
        if (!url) {
            throw new Error('Url is required');
        }
        return url;
    }
    reset() {
        this._method = 'GET';
        this._body = {};
        this._headers = {};
        this._options = {};
        this._url = '';
        this._cache = undefined;
    }
    inCache(key) {
        if (!this._cache) {
            return false;
        }
        return this._cache.store.has(key);
    }
    isResponseSuccess(response) {
        return response.status >= 200 && response.status < 300;
    }
    isResponseUnauthorized(response, error = null) {
        if (response && response.status === 401) {
            return true;
        }
        return error?.response?.status === 401;
    }
    getFromCache(key) {
        if (this.inCache(key)) {
            const cached = this._cache?.store.get(key);
            if (!cached) {
                return null;
            }
            return cached;
        }
        return null;
    }
    setToCache(key, response) {
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
    buildUrlParams(url, params = {}) {
        if (Object.keys(params).length === 0) {
            return url;
        }
        const query = new URLSearchParams(params).toString();
        return `${url}?${query}`;
    }
    handleUnauthorized() {
        if (!this.authService) {
            throw new Error('Auth service is not implement');
        }
        this.authService.handleUnauthorized();
        /*if (this.config.auth && this.config.auth.notAuthRedirect) {
            this.config.auth.notAuthRedirect();
        }*/
    }
    hasRoute(key) {
        return this.config.routes.hasOwnProperty(key);
    }
    getRoute(key) {
        return this.config.routes[key];
    }
    getBaseUrl() {
        if (!this.config.version) {
            return this.config.base;
        }
        return this.config.base + '/' + this.config.version;
    }
    isCacheable() {
        if (this._method !== 'GET') {
            return false;
        }
        return !!this._cache;
    }
    isWithCredentials() {
        return !!this.config.auth?.stateful;
    }
    async request(url, method, body, headers, options = {}) {
        const requestConfig = Object.assign({
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
        }
        catch (error) {
            const err = error;
            if (this.isResponseUnauthorized(null, err)) {
                this.handleUnauthorized();
            }
            throw error;
        }
    }
}
let apiConfig;
let instance;
export function provideApiConfig(config) {
    apiConfig = config;
}
export function useApi() {
    /*if (!instance) {
        if (!apiConfig) {
            throw new Error('ApiConfig is not provided');
        }
        instance = new ApiImpl(apiConfig);
    }
    return instance;*/
    let authService = undefined;
    if (apiConfig.auth) {
        authService = makeAuth(apiConfig.auth);
    }
    return new ApiService(apiConfig, authService);
}
