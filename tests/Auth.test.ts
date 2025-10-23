import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosRequestConfig } from 'axios';

import { Auth, makeAuth } from '../src/Auth';
import { AuthConfig, TokenStore } from '../src';
import { Token} from "../src";
//import { useApi } from "../src";
//import { StoreType } from '../src/Stores';

const mockExpirableStore = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
};

vi.mock('../src/Stores', () => {
    return {
        StoreType: {
            getStore: vi.fn(() => mockExpirableStore),
        },
    };
});

const MOCK_TOKEN: Token = { token: 'mock-jwt-token', expires: new Date(Date.now() + 3600000) };

const mockStatelessConfig: AuthConfig = {
    method: 'POST',
    route: 'v1/login',
    notAuthRedirect: vi.fn(),
    stateless: {
        tokenStore: 'local',
        formatToken: vi.fn(),
    },
};

describe('AuthService', () => {
    let authService: Auth;

    beforeEach(() => {
        vi.clearAllMocks();
        authService = makeAuth(mockStatelessConfig);

        vi.spyOn(authService as any, 'getTokenStore').mockImplementation(() => {
            return {
                get: mockExpirableStore.get,
                set: mockExpirableStore.set,
                remove: mockExpirableStore.remove,
            } as unknown as TokenStore;
        });
    });

    it('should add Authorization header if token exists', () => {
        mockExpirableStore.get.mockReturnValue(MOCK_TOKEN);

        const request: AxiosRequestConfig = { headers: {} };

        authService.beforeRequest(request);

        expect(request.headers?.['Authorization']).toBe(`Bearer ${MOCK_TOKEN.token}`);
    });
});
