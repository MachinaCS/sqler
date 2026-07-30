import { getDbConnection, closeAllDbConnections } from './connection';
import { DbConfig, ServerConnectionConfig, SchemaCacheData, TableMeta, ColumnMeta, ForeignKeyMeta, IndexMeta } from '../types';
import { RowDataPacket } from 'mysql2/promise';

/**
 * Loads metadata exclusively from sqler.connections profiles array.
 */
export async function loadSchemaMetadata(config: DbConfig): Promise<SchemaCacheData> {
    closeAllDbConnections();

    const profiles: ServerConnectionConfig[] = (config.connections && Array.isArray(config.connections))
        ? config.connections
        : [];

    const tablesMap = new Map<string, TableMeta>();
    const serverInfos: string[] = [];

    for (const profile of profiles) {
        const serverLabel = profile.name || `${profile.host}:${profile.port}`;
        const pool = getDbConnection(profile);

        try {
            const [verRows] = await pool.query<RowDataPacket[]>('SELECT VERSION() AS version');
            if (verRows.length > 0 && verRows[0].version) {
                const verStr = String(verRows[0].version);
                const info = verStr.toLowerCase().includes('mariadb') ? `MariaDB ${verStr}` : `MySQL ${verStr}`;
                serverInfos.push(`${serverLabel} (${info})`);
            }
        } catch {
            serverInfos.push(serverLabel);
        }

        let dbFilter = '';
        const dbParams: string[] = [];
        if (profile.database && profile.database.trim() !== '') {
            const dbs = profile.database.split(',').map(d => d.trim()).filter(d => d.length > 0);
            if (dbs.length > 0) {
                const placeholders = dbs.map(() => '?').join(',');
                dbFilter = `WHERE TABLE_SCHEMA IN (${placeholders})`;
                dbParams.push(...dbs);
            }
        } else {
            dbFilter = `WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')`;
        }

        try {
            const [tableRows] = await pool.query<RowDataPacket[]>(
                `SELECT TABLE_SCHEMA, TABLE_NAME 
                 FROM information_schema.TABLES 
                 ${dbFilter}`,
                dbParams
            );

            for (const row of tableRows) {
                const dbName = String(row.TABLE_SCHEMA);
                const tableName = String(row.TABLE_NAME);

                const tableMeta: TableMeta = {
                    name: tableName,
                    databaseName: dbName,
                    serverName: serverLabel,
                    columns: new Map<string, ColumnMeta>(),
                    primaryKeys: [],
                    foreignKeys: [],
                    indexes: []
                };

                tablesMap.set(tableName.toLowerCase(), tableMeta);
                tablesMap.set(`${dbName.toLowerCase()}.${tableName.toLowerCase()}`, tableMeta);
            }

            const [columnRows] = await pool.query<RowDataPacket[]>(
                `SELECT 
                    TABLE_SCHEMA,
                    TABLE_NAME, 
                    COLUMN_NAME, 
                    DATA_TYPE, 
                    COLUMN_TYPE, 
                    IS_NULLABLE, 
                    COLUMN_KEY, 
                    COLUMN_DEFAULT,
                    COLUMN_COMMENT
                 FROM information_schema.COLUMNS 
                 ${dbFilter}
                 ORDER BY ORDINAL_POSITION`,
                dbParams
            );

            for (const row of columnRows) {
                const dbName = String(row.TABLE_SCHEMA);
                const tableName = String(row.TABLE_NAME);
                const tableMeta = tablesMap.get(`${dbName.toLowerCase()}.${tableName.toLowerCase()}`) || tablesMap.get(tableName.toLowerCase());
                if (tableMeta) {
                    const colName = String(row.COLUMN_NAME);
                    const isPk = row.COLUMN_KEY === 'PRI';
                    if (isPk) {
                        tableMeta.primaryKeys.push(colName);
                    }

                    const colMeta: ColumnMeta = {
                        name: colName,
                        tableName: tableMeta.name,
                        databaseName: dbName,
                        serverName: serverLabel,
                        dataType: String(row.DATA_TYPE),
                        columnType: String(row.COLUMN_TYPE),
                        isNullable: String(row.IS_NULLABLE).toUpperCase() === 'YES',
                        isPrimaryKey: isPk,
                        isForeignKey: false,
                        defaultValue: row.COLUMN_DEFAULT !== null ? String(row.COLUMN_DEFAULT) : null,
                        comment: row.COLUMN_COMMENT ? String(row.COLUMN_COMMENT) : ''
                    };

                    tableMeta.columns.set(colName.toLowerCase(), colMeta);
                }
            }

            const [fkRows] = await pool.query<RowDataPacket[]>(
                `SELECT 
                    CONSTRAINT_NAME,
                    TABLE_SCHEMA, 
                    TABLE_NAME, 
                    COLUMN_NAME, 
                    REFERENCED_TABLE_NAME, 
                    REFERENCED_COLUMN_NAME
                 FROM information_schema.KEY_COLUMN_USAGE
                 ${dbFilter ? `${dbFilter} AND` : 'WHERE'} REFERENCED_TABLE_NAME IS NOT NULL`,
                dbParams
            );

            for (const row of fkRows) {
                const dbName = String(row.TABLE_SCHEMA);
                const tableName = String(row.TABLE_NAME);
                const tableMeta = tablesMap.get(`${dbName.toLowerCase()}.${tableName.toLowerCase()}`) || tablesMap.get(tableName.toLowerCase());
                if (tableMeta) {
                    const colName = String(row.COLUMN_NAME);
                    const refTable = String(row.REFERENCED_TABLE_NAME);
                    const refCol = String(row.REFERENCED_COLUMN_NAME);

                    const fkMeta: ForeignKeyMeta = {
                        constraintName: String(row.CONSTRAINT_NAME),
                        tableName: tableMeta.name,
                        columnName: colName,
                        referencedTableName: refTable,
                        referencedColumnName: refCol
                    };

                    tableMeta.foreignKeys.push(fkMeta);

                    const colMeta = tableMeta.columns.get(colName.toLowerCase());
                    if (colMeta) {
                        colMeta.isForeignKey = true;
                        colMeta.foreignKeyRef = {
                            targetTable: refTable,
                            targetColumn: refCol
                        };
                    }
                }
            }
        } catch (err) {
            console.error(`SQLer error loading schema from ${serverLabel}:`, err);
        }
    }

    return {
        tables: tablesMap,
        serverInfo: serverInfos.join(' | ') || 'MySQL / MariaDB'
    };
}
