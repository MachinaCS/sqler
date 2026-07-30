import * as vscode from 'vscode';
import { getPhpSqlStringAtOffset } from '../utils/phpAst';
import { parseSql } from '../parser/parser';
import { schemaCacheManager } from '../cache/schemaCache';

export class SqlTextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    public provideTextDocumentContent(uri: vscode.Uri): string {
        const schema = schemaCacheManager.getCache();
        const tableName = uri.path.replace(/^\//, '').replace(/\.sql$/, '');
        const tableMeta = schema.tables.get(tableName.toLowerCase());

        if (!tableMeta) {
            return `-- Table ${tableName} schema not found in cache.`;
        }

        let sql = `-- Virtual Schema Definition for table \`${tableMeta.name}\`\n`;
        sql += `-- Database: ${tableMeta.databaseName} | Server: ${tableMeta.serverName}\n\n`;
        sql += `CREATE TABLE \`${tableMeta.name}\` (\n`;

        const colLines: string[] = [];
        for (const col of tableMeta.columns.values()) {
            let colLine = `  \`${col.name}\` ${col.columnType}`;
            if (!col.isNullable) colLine += ' NOT NULL';
            if (col.defaultValue !== null) colLine += ` DEFAULT '${col.defaultValue}'`;
            if (col.comment) colLine += ` COMMENT '${col.comment}'`;
            colLines.push(colLine);
        }

        if (tableMeta.primaryKeys.length > 0) {
            colLines.push(`  PRIMARY KEY (\`${tableMeta.primaryKeys.join('`, `')}\`)`);
        }

        for (const fk of tableMeta.foreignKeys) {
            colLines.push(`  CONSTRAINT \`${fk.constraintName}\` FOREIGN KEY (\`${fk.columnName}\`) REFERENCES \`${fk.referencedTableName}\` (\`${fk.referencedColumnName}\`)`);
        }

        sql += colLines.join(',\n');
        sql += `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n`;

        return sql;
    }
}

export class SqlDefinitionProvider implements vscode.DefinitionProvider {
    public async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {
        if (document.languageId !== 'php') {
            return undefined;
        }

        const fullText = document.getText();
        const offset = document.offsetAt(position);

        const phpSql = getPhpSqlStringAtOffset(fullText, offset);
        if (!phpSql) {
            return undefined;
        }

        const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_$.]+/);
        if (!wordRange) {
            return undefined;
        }

        let rawWord = document.getText(wordRange);

        if (rawWord.includes('.')) {
            rawWord = rawWord.split('.')[0];
        }

        const schema = schemaCacheManager.getCache();
        const relativeOffset = offset - phpSql.startOffset;
        const parseResult = parseSql(phpSql.sqlText, relativeOffset, schema);

        let resolvedTable = parseResult.aliases.get(rawWord) || rawWord;
        let tableMeta = schema.tables.get(resolvedTable.toLowerCase());

        if (!tableMeta) {
            for (const tableAlias of parseResult.tables) {
                const tMeta = schema.tables.get(tableAlias.tableName.toLowerCase());
                if (tMeta && tMeta.columns.has(rawWord.toLowerCase())) {
                    tableMeta = tMeta;
                    break;
                }
            }
        }

        if (!tableMeta) {
            for (const tMeta of schema.tables.values()) {
                if (tMeta.name.toLowerCase() === rawWord.toLowerCase() || tMeta.columns.has(rawWord.toLowerCase())) {
                    tableMeta = tMeta;
                    break;
                }
            }
        }

        if (tableMeta) {
            const virtualUri = vscode.Uri.parse(`sqler-schema://${tableMeta.databaseName}/${tableMeta.name}.sql`);
            return [
                {
                    originSelectionRange: wordRange,
                    targetUri: virtualUri,
                    targetRange: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
                }
            ];
        }

        return undefined;
    }
}
