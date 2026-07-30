import * as vscode from 'vscode';
import { getPhpSqlStringAtOffset } from '../utils/phpAst';
import { parseSql } from '../parser/parser';
import { schemaCacheManager } from '../cache/schemaCache';
import { KEYWORDS_DOCS } from '../constants/keywordDocs';

export class SqlHoverProvider implements vscode.HoverProvider {
    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        if (document.languageId !== 'php') {
            return undefined;
        }

        const fullText = document.getText();
        const offset = document.offsetAt(position);

        const phpSql = getPhpSqlStringAtOffset(fullText, offset);
        if (!phpSql) {
            return undefined;
        }

        // Check if token directly at cursor is a prepared statement placeholder e.g. `:id` or `$var`
        const lineText = document.lineAt(position.line).text;
        const col = position.character;
        let charBefore = col > 0 ? lineText[col - 1] : '';
        let wordRange = document.getWordRangeAtPosition(position, /[:$]?[a-zA-Z0-9_$.]+/);
        if (!wordRange) {
            return undefined;
        }

        let rawWord = document.getText(wordRange);

        // Ignore hover for variables / prepared statement placeholders like `:id` or `$id`
        if (rawWord.startsWith(':') || rawWord.startsWith('$') || charBefore === ':') {
            return undefined;
        }

        const schema = schemaCacheManager.getCache();
        const relativeOffset = offset - phpSql.startOffset;
        const parseResult = parseSql(phpSql.sqlText, relativeOffset, schema);

        // Check SQL Keywords hover documentation
        const upperWord = rawWord.toUpperCase();
        if (KEYWORDS_DOCS[upperWord]) {
            const doc = KEYWORDS_DOCS[upperWord];
            const md = new vscode.MarkdownString();
            md.appendCodeblock(`(sql keyword) ${doc.title}`, 'sql');
            md.appendMarkdown(`---\n${doc.description}\n\n\`\`\`sql\n${doc.example}\n\`\`\``);
            return new vscode.Hover(md);
        }

        // Check if word is qualified column e.g. `u.id` or `User.name`
        if (rawWord.includes('.')) {
            const parts = rawWord.split('.');
            const qualifier = parts[0];
            const colName = parts[1];

            // Hover strictly on qualifier part (e.g. `u` in `u.id`)
            const wordOffsetInLine = position.character - wordRange.start.character;
            if (wordOffsetInLine <= qualifier.length) {
                const targetTable = parseResult.aliases.get(qualifier) || qualifier;
                const tableMeta = schema.tables.get(targetTable.toLowerCase());
                if (tableMeta) {
                    return new vscode.Hover(this.formatTableMarkdown(tableMeta, schema.serverInfo, qualifier !== targetTable ? qualifier : undefined));
                }
            }

            const tableName = parseResult.aliases.get(qualifier) || qualifier;
            const tableMeta = schema.tables.get(tableName.toLowerCase());
            if (tableMeta && colName) {
                const colMeta = tableMeta.columns.get(colName.toLowerCase());
                if (colMeta) {
                    return new vscode.Hover(this.formatColumnMarkdown(colMeta, tableMeta.name, schema.serverInfo));
                }
            }
        }

        // Check if word is alias or table name directly
        const resolvedTable = parseResult.aliases.get(rawWord) || rawWord;
        const tableMeta = schema.tables.get(resolvedTable.toLowerCase());

        if (tableMeta) {
            return new vscode.Hover(this.formatTableMarkdown(tableMeta, schema.serverInfo, rawWord !== resolvedTable ? rawWord : undefined));
        }

        // Check columns in active tables if word matches column name directly
        for (const tableAlias of parseResult.tables) {
            const tMeta = schema.tables.get(tableAlias.tableName.toLowerCase());
            if (tMeta) {
                const cMeta = tMeta.columns.get(rawWord.toLowerCase());
                if (cMeta) {
                    return new vscode.Hover(this.formatColumnMarkdown(cMeta, tMeta.name, schema.serverInfo));
                }
            }
        }

        return undefined;
    }

    private formatColumnMarkdown(col: any, tableName: string, serverInfo: string): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        // Clean compact signature header (like PHP / TS language server)
        md.appendCodeblock(`(column) ${tableName}.${col.name}: ${col.columnType}`, 'sql');
        md.appendMarkdown(`---\n`);
        md.appendMarkdown(`- **Database**: \`${col.databaseName}\`${serverInfo ? ` _[${serverInfo}]_` : ''}\n`);
        md.appendMarkdown(`- **Table**: \`${tableName}\`\n`);
        md.appendMarkdown(`- **Type**: \`${col.columnType}\`\n`);
        if (col.comment) {
            const cleanComment = String(col.comment).replace(/[\r\n]+/g, ' ');
            md.appendMarkdown(`- **Comment**: _${cleanComment}_\n`);
        }
        md.appendMarkdown(`- **Nullable**: ${col.isNullable ? 'Yes' : 'No'}\n`);
        md.appendMarkdown(`- **Primary Key**: ${col.isPrimaryKey ? 'Yes' : 'No'}\n`);
        md.appendMarkdown(`- **Foreign Key**: ${col.isForeignKey ? 'Yes' : 'No'}\n`);
        if (col.isForeignKey && col.foreignKeyRef) {
            md.appendMarkdown(`  - **References**: \`${col.foreignKeyRef.targetTable}.${col.foreignKeyRef.targetColumn}\`\n`);
        }
        md.appendMarkdown(`- **Default Value**: \`${col.defaultValue !== null ? col.defaultValue : 'NULL'}\`\n`);
        return md;
    }

    private formatTableMarkdown(table: any, serverInfo: string, alias?: string): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        // Clean compact signature header
        const aliasStr = alias ? ` (alias: ${alias})` : '';
        md.appendCodeblock(`(table) ${table.name}${aliasStr}: ${table.columns.size} columns`, 'sql');
        md.appendMarkdown(`---\n`);
        md.appendMarkdown(`**Database**: \`${table.databaseName}\`${serverInfo ? ` _[${serverInfo}]_` : ''}\n\n`);
        md.appendMarkdown(`- **Primary Keys**: ${table.primaryKeys.join(', ') || 'None'}\n\n`);
        md.appendMarkdown(`| Column | Type | Nullable | Key | Comment |\n| --- | --- | --- | --- | --- |\n`);

        for (const col of table.columns.values()) {
            let keyStr = col.isPrimaryKey ? 'PK' : (col.isForeignKey ? 'FK' : '');
            const commentClean = col.comment
                ? String(col.comment).replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|')
                : '';
            md.appendMarkdown(`| \`${col.name}\` | \`${col.dataType}\` | ${col.isNullable ? 'YES' : 'NO'} | ${keyStr} | ${commentClean} |\n`);
        }
        return md;
    }
}
