declare class Singleflight {
    private DEFAULT_TIMEOUT;
    private CHECK_INTERVAL;
    private processes;
    run<T>(key: string, callback: () => T | Promise<T>, options?: Record<string, any>): Promise<T>;
}
export default function useSingleflight(): Singleflight;
export {};
//# sourceMappingURL=Singleflight.d.ts.map