import { AuthConfig } from "./Config";
import { AxiosRequestConfig, type AxiosResponse } from "axios";
export interface Auth {
    authorizeRequest(request: AxiosRequestConfig): void;
    handleUnauthorized(): void;
    auth(email: string, password: string, remember?: boolean): Promise<AxiosResponse>;
}
export declare function makeAuth(config: AuthConfig): Auth;
//# sourceMappingURL=Auth.d.ts.map