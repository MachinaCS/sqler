import assert from 'assert';
import { extractPhpSqlStrings } from '../utils/phpAst';
import { tokenizeSql } from '../parser/tokenizer';
import { parseSql } from '../parser/parser';
import { TokenType, SchemaCacheData, TableMeta, DiagnosticError } from '../types';

describe('PHP SQL Extraction Test', () => {
    it('extracts SQL string starting with SELECT in double quotes', () => {
        const phpCode = `<?php
        $sql = "SELECT * FROM User u WHERE u.id = 1";
        $notSql = "Hello world!";
        `;
        const extracted = extractPhpSqlStrings(phpCode);
        assert.strictEqual(extracted.length, 1);
        assert.ok(extracted[0].sqlText.includes('SELECT * FROM User'));
    });

    it('extracts SQL string with multiline heredoc starting with UPDATE', () => {
        const phpCode = `<?php
        $query = <<<SQL
        UPDATE User SET status = 'active'
        SQL;
        `;
        const extracted = extractPhpSqlStrings(phpCode);
        assert.strictEqual(extracted.length, 1);
        assert.ok(extracted[0].sqlText.includes('UPDATE User'));
    });
});

describe('Manual SQL Tokenizer Test', () => {
    it('tokenizes SQL keywords, identifiers, dots and operators without regex', () => {
        const sql = 'SELECT u.id, u.name FROM User u';
        const tokens = tokenizeSql(sql).filter((t) => t.type !== TokenType.Whitespace);
        assert.strictEqual(tokens[0].value, 'SELECT');
        assert.strictEqual(tokens[1].value, 'u');
        assert.strictEqual(tokens[2].value, '.');
        assert.strictEqual(tokens[3].value, 'id');
    });
});

describe('Manual SQL Parser & Alias Tracking Test', () => {
    it('tracks alias mapping u -> User', () => {
        const sql = 'SELECT u.id FROM User u JOIN Order o ON o.user_id = u.id';
        const result = parseSql(sql);
        assert.strictEqual(result.aliases.get('u'), 'User');
        assert.strictEqual(result.aliases.get('o'), 'Order');
        assert.strictEqual(result.tables.length, 2);
    });

    it('detects cursor after alias dot', () => {
        const sql = 'SELECT u. FROM User u';
        const cursorOffset = sql.indexOf('u.') + 2;
        const result = parseSql(sql, cursorOffset);
        assert.ok(result.cursorContext);
        assert.strictEqual(result.cursorContext?.isAfterDot, true);
        assert.strictEqual(result.cursorContext?.targetQualifier, 'u');
    });

    it('reports diagnostic for unknown table and unknown column', () => {
        const mockSchema: SchemaCacheData = {
            serverInfo: 'MySQL 8.0.32',
            tables: new Map<string, TableMeta>([
                ['user', {
                    name: 'User',
                    databaseName: 'testdb',
                    serverName: 'Local WAMP',
                    columns: new Map([['id', { name: 'id', tableName: 'User', databaseName: 'testdb', serverName: 'Local WAMP', dataType: 'int', columnType: 'int(11)', isNullable: false, isPrimaryKey: true, isForeignKey: false, defaultValue: null, comment: 'Primary identifier' }]]),
                    primaryKeys: ['id'],
                    foreignKeys: [],
                    indexes: []
                }]
            ])
        };

        const sql = 'SELECT u.non_existent_column FROM User u JOIN MissingTable m ON m.id = u.id';
        const result = parseSql(sql, undefined, mockSchema);
        assert.ok(result.errors.length >= 2);
        assert.ok(result.errors.some((e: DiagnosticError) => e.type === 'unknown_column'));
        assert.ok(result.errors.some((e: DiagnosticError) => e.type === 'unknown_table'));
    });
});
