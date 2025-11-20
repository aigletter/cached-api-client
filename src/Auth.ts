import {AuthConfig, TokenStore} from "./Config";
import {AxiosRequestConfig, type AxiosResponse} from "axios";
import {StoreType, TokenStoreAdapter, useApiStoreMemory} from "./Stores";
import {useApi} from "./Api";
import {Token} from "./Token";

export interface Auth {
    authorizeRequest(request: AxiosRequestConfig): void;

    handleUnauthorized(): void;

    auth(email: string, password: string, remember?: boolean): Promise<AxiosResponse>
}

class AuthService implements Auth {
    public constructor(private readonly config: AuthConfig) {

    }

    public authorizeRequest(request: AxiosRequestConfig): void {
        if (this.config.stateless) {
            this.addAuthRequestHeaders(request);
        }
    }

    public handleUnauthorized(): void {
        this.config.notAuthRedirect();
    }

    public async auth(email: string, password: string, remember?: boolean): Promise<AxiosResponse> {
        const body = {email: email, password: password, remember: remember} as Record<string, any>;

        await this.beforeAuth();

        const response = await useApi()
            .method(this.getAuthMethod())
            .body(body)
            .send(this.getAuthUrl());

        this.handleAuthResponse(response);

        return response;
    }

    private getTokenStore(): TokenStore {
        if (!this.config.stateless?.tokenStore) {
            return new TokenStoreAdapter(useApiStoreMemory());
        }
        let store = this.config.stateless.tokenStore;
        if (typeof store === 'string') {
            const defaultStore = StoreType.getStore(store);
            return new TokenStoreAdapter(defaultStore);
        } else if (typeof store === 'function') {
            return store();
        }

        return this.config.stateless.tokenStore as TokenStore;
    }

    private addAuthRequestHeaders(request: AxiosRequestConfig) {
        const store = this.getTokenStore();
        const token = store.get();
        if (token) {
            this.addHeaderToRequest(request, 'Authorization', 'Bearer ' + token.token);
        }
    }

    private addHeaderToRequest(request: AxiosRequestConfig, name: string, value: string): void {
        const headers = request.headers || {} as Record<string, any>;
        headers[name] = value;
        request.headers = headers;
    }

    private async beforeAuth() {
        if (this.config.stateful?.csrfRoute) {
            const url = useApi().buildUrl(this.config.stateful?.csrfRoute);
            await useApi().get(url);
        }
    }

    private getAuthMethod(): string {
        if (this.config.method) {
            return this.config.method;
        }
        return 'POST';
    }

    private getAuthUrl(): string {
        return useApi().buildUrl(this.config.route);
    }

    private handleAuthResponse(response: AxiosResponse) {
        if (this.config.stateless) {
            if (!this.config.stateless.tokenStore) {
                throw new Error('Token store is not initialized')
            }
            const token = this.formatToken(response.data);
            const tokenStore = this.getTokenStore();
            tokenStore.set(token);
        }
    }

    private formatToken(response: unknown): Token
    {
        if (!this.config.stateless?.formatToken) {
            throw new Error('unknown token response format');
        }
        return this.config.stateless.formatToken(response);
    }

    private calculateTokenTtl(expires?: Date): number|null {
        if (!expires) {
            return null;
        }

        const now = new Date();
        const diff = expires.getTime() - now.getTime();

        return diff > 0 ? diff : 0;
    }
}

export function makeAuth(config: AuthConfig): Auth {
    return new AuthService(config);
}