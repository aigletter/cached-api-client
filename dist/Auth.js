import { StoreType, TokenStoreAdapter, useApiStoreMemory } from "./Stores";
import { useApi } from "./Api";
class AuthService {
    constructor(config) {
        this.config = config;
    }
    authorizeRequest(request) {
        if (this.config.stateless) {
            this.addAuthRequestHeaders(request);
        }
    }
    handleUnauthorized() {
        this.config.notAuthRedirect();
    }
    async auth(api, email, password, remember) {
        const body = { email: email, password: password, remember: remember };
        await this.beforeAuth();
        const response = await api
            .method(this.getAuthMethod())
            .body(body)
            .send(this.getAuthUrl());
        this.handleAuthResponse(response);
        return response;
    }
    getTokenStore() {
        if (!this.config.stateless?.tokenStore) {
            return new TokenStoreAdapter(useApiStoreMemory());
        }
        let store = this.config.stateless.tokenStore;
        if (typeof store === 'string') {
            const defaultStore = StoreType.getStore(store);
            return new TokenStoreAdapter(defaultStore);
        }
        else if (typeof store === 'function') {
            return store();
        }
        return this.config.stateless.tokenStore;
    }
    addAuthRequestHeaders(request) {
        const store = this.getTokenStore();
        const token = store.get();
        if (token) {
            this.addHeaderToRequest(request, 'Authorization', 'Bearer ' + token.token);
        }
    }
    addHeaderToRequest(request, name, value) {
        const headers = request.headers || {};
        headers[name] = value;
        request.headers = headers;
    }
    async beforeAuth() {
        if (this.config.stateful?.csrfRoute) {
            const url = useApi().buildUrl(this.config.stateful?.csrfRoute);
            await useApi().get(url);
        }
    }
    getAuthMethod() {
        if (this.config.method) {
            return this.config.method;
        }
        return 'POST';
    }
    getAuthUrl() {
        return useApi().buildUrl(this.config.route);
    }
    handleAuthResponse(response) {
        if (this.config.stateless) {
            if (!this.config.stateless.tokenStore) {
                throw new Error('Token store is not initialized');
            }
            const token = this.formatToken(response.data);
            const tokenStore = this.getTokenStore();
            tokenStore.set(token);
        }
    }
    formatToken(response) {
        if (!this.config.stateless?.formatToken) {
            throw new Error('unknown token response format');
        }
        return this.config.stateless.formatToken(response);
    }
    calculateTokenTtl(expires) {
        if (!expires) {
            return null;
        }
        const now = new Date();
        const diff = expires.getTime() - now.getTime();
        return diff > 0 ? diff : 0;
    }
}
export function makeAuth(config) {
    return new AuthService(config);
}
