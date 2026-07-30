import * as vscode from 'vscode';
import { getPhpSqlStringAtOffset } from '../utils/phpAst';
import { parseSql } from '../parser/parser';
import { schemaCacheManager } from '../cache/schemaCache';

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

        const resolvedTable = parseResult.aliases.get(rawWord) || rawWord;
        const tableMeta = schema.tables.get(resolvedTable.toLowerCase());

        if (tableMeta) {
            const virtualUri = vscode.Uri.parse(`sqler-schema://${tableMeta.databaseName}/${tableMeta.name}.sql`);
            return new vscode.Location(virtualUri, new vscode.Position(0, 0));
        }

        return undefined;
    }
}
