export interface Config {
    api_key?: string;
    api_url?: string;
}
export declare function loadConfig(): Config;
export declare function getApiKey(): string;
export declare function getApiUrl(): string;
export declare function clearApiKey(): void;
export declare function saveConfig(updates: Partial<Config>): void;
//# sourceMappingURL=config.d.ts.map