import {beforeEach, describe, vi, it, expect} from "vitest";
import {AuthConfig, ApiConfig, provideApiConfig, Token, TokenStore, useApi} from "../src";
import {Auth, makeAuth} from "../src/Auth";
import {Api} from "../src/Api";

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

const mockConfig: ApiConfig = {
    base: 'http:/localhost',
    routes: {

    },
    auth: {
        method: 'POST',
        route: 'v1/login',
        notAuthRedirect: vi.fn(),
        stateless: {
            tokenStore: 'local',
            formatToken: vi.fn(),
        },
    } as AuthConfig
};

describe('ApiService', () => {
    let apiService: Api;

    let StoreTypeMock: any;

    beforeEach(async () => {
        vi.clearAllMocks();

        const stores = await import('../src/Stores');
        StoreTypeMock = (stores as any).StoreType;

        StoreTypeMock.getStore.mockClear();

        provideApiConfig(mockConfig);
        apiService = useApi();

        /*vi.spyOn(apiService as any, 'getTokenStore').mockImplementation(() => {
            return {
                get: mockExpirableStore.get,
                set: mockExpirableStore.set,
                remove: mockExpirableStore.remove,
            } as unknown as TokenStore;
        });*/
    });

    // ТЕСТ 3: Перевірка, що метод повертає Service (для ланцюгового виклику)
    it('should return the Api instance to allow method chaining', () => {

        // Act
        const result = apiService.cache(100);

        // Assert: Перевіряємо, що повернутий об'єкт дорівнює вихідному клієнту
        expect(result).toBe(apiService);
    });
});