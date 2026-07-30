import * as mysql from 'mysql2/promise';
import { DbConfig, ServerConnectionConfig } from '../types';

const pools = new Map<string, mysql.Pool>();

export function getDbConnection(config: ServerConnectionConfig): mysql.Pool {
    const key = `${config.host}:${config.port}:${config.username}:${config.database}`;
    let pool = pools.get(key);

    if (!pool) {
        pool = mysql.createPool({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.database || undefined,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0
        });
        pools.set(key, pool);
    }

    return pool;
}

export function closeAllDbConnections(): void {
    for (const pool of pools.values()) {
        pool.end().catch(() => {});
    }
    pools.clear();
}
