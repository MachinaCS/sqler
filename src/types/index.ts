export interface ServerConnectionConfig {
    name?: string;
    host: string;
    port: number;
    username: string;
    password: string;
    driver?: string; // 'mysql' | 'mariadb'
    database: string; // Comma-separated or empty for all
}

export interface DbConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    combineSameColumns: boolean;
    connections: ServerConnectionConfig[];
}

export interface ColumnMeta {
    name: string;
    tableName: string;
    databaseName: string;
    serverName: string;
    dataType: string;
    columnType: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    defaultValue: string | null;
    comment: string;
    foreignKeyRef?: {
        targetTable: string;
        targetColumn: string;
    };
}

export interface ForeignKeyMeta {
    constraintName: string;
    tableName: string;
    columnName: string;
    referencedTableName: string;
    referencedColumnName: string;
}

export interface IndexMeta {
    name: string;
    tableName: string;
    columnName: string;
    isNonUnique: boolean;
}

export interface TableMeta {
    name: string;
    databaseName: string;
    serverName: string;
    columns: Map<string, ColumnMeta>;
    primaryKeys: string[];
    foreignKeys: ForeignKeyMeta[];
    indexes: IndexMeta[];
}

export interface SchemaCacheData {
    tables: Map<string, TableMeta>; // key: "dbname.tablename" or "tablename"
    serverInfo: string;
}

export enum TokenType {
    Keyword,
    Identifier,
    Number,
    String,
    Dot,
    Comma,
    Star,
    Equals,
    Operator,
    OpenParen,
    CloseParen,
    Whitespace,
    EOF,
    Unknown
}

export interface Token {
    type: TokenType;
    value: string;
    start: number;
    end: number;
}

export interface TableAlias {
    alias: string;
    tableName: string;
    rawName: string;
}

export enum ClauseType {
    None,
    SELECT,
    FROM,
    JOIN,
    ON,
    WHERE,
    GROUP_BY,
    ORDER_BY,
    LIMIT,
    UPDATE,
    SET,
    INSERT_INTO,
    VALUES
}

export interface CursorContext {
    clause: ClauseType;
    isAfterDot: boolean;
    targetQualifier?: string; // alias or table name before dot
    currentWord: string;
    activeTables: TableAlias[];
    joinLeftTable?: string;
    joinRightTable?: string;
    isExpressionComplete?: boolean; // True if cursor follows a complete binary comparison (e.g. `a.id <> 0`)
    isAfterColumnInWhere?: boolean; // True if cursor immediately follows a column name in WHERE clause
    isFromTableComplete?: boolean; // True if FROM clause table is complete without trailing comma
    isAfterSelectFunction?: boolean; // True if cursor immediately follows a closed parenthesis in SELECT clause
}

export interface DiagnosticError {
    message: string;
    start: number;
    end: number;
    type: 'unknown_table' | 'unknown_column' | 'unknown_alias';
}

export interface ParsedSqlResult {
    aliases: Map<string, string>; // alias -> table name
    tables: TableAlias[];
    errors: DiagnosticError[];
    cursorContext?: CursorContext;
}

export interface PhpSqlString {
    sqlText: string;
    startOffset: number; // offset within PHP document where string content starts
    endOffset: number;
}
