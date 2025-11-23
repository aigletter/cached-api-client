import { AuthConfig } from "./Config";
import { AxiosRequestConfig, type AxiosResponse } from "axios";
import { Api } from "./Api";
export interface Auth {
    authorizeRequest(request: AxiosRequestConfig): void;
    handleUnauthorized(): void;
    auth(api: Api, email: string, password: string, remember?: boolean): Promise<AxiosResponse>;
}
export declare function makeAuth(config: AuthConfig): Auth;
//# sourceMappingURL=Auth.d.ts.map