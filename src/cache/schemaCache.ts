import { SchemaCacheData, DbConfig } from '../types';
import { loadSchemaMetadata } from '../database/schemaLoader';
import { closeAllDbConnections } from '../database/connection';

export class SchemaCacheManager {
    private cache: SchemaCacheData = { tables: new Map(), serverInfo: 'MySQL / MariaDB' };
    private isLoaded = false;
    private isLoading = false;

    public getCache(): SchemaCacheData {
        return this.cache;
    }

    public async refresh(config: DbConfig): Promise<SchemaCacheData> {
        if (this.isLoading) {
            return this.cache;
        }

        this.isLoading = true;
        try {
            closeAllDbConnections();
            this.cache = await loadSchemaMetadata(config);
            this.isLoaded = true;
        } finally {
            this.isLoading = false;
        }

        return this.cache;
    }

    public isSchemaLoaded(): boolean {
        return this.isLoaded;
    }
}

export const schemaCacheManager = new SchemaCacheManager();
