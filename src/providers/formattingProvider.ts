import * as vscode from 'vscode';
import { getPhpSqlStringAtOffset } from '../utils/phpAst';

export class SqlFormattingProvider implements vscode.DocumentRangeFormattingEditProvider, vscode.DocumentFormattingEditProvider {
    public provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        _options: vscode.FormattingOptions,
        _token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        return this.provideDocumentRangeFormattingEdits(document, fullRange, _options, _token);
    }

    public provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        _options: vscode.FormattingOptions,
        _token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        if (document.languageId !== 'php') {
            return [];
        }

        const fullText = document.getText();
        const startOffset = document.offsetAt(range.start);
        const endOffset = document.offsetAt(range.end);

        const edits: vscode.TextEdit[] = [];
        let offset = startOffset;

        while (offset < endOffset) {
            const phpSql = getPhpSqlStringAtOffset(fullText, offset);
            if (!phpSql) {
                offset += 10;
                continue;
            }

            const formattedSql = formatSqlText(phpSql.sqlText);
            if (formattedSql && formattedSql !== phpSql.sqlText) {
                const sqlRange = new vscode.Range(
                    document.positionAt(phpSql.startOffset),
                    document.positionAt(phpSql.endOffset)
                );
                edits.push(vscode.TextEdit.replace(sqlRange, formattedSql));
            }

            offset = phpSql.endOffset + 1;
        }

        return edits;
    }
}

export function formatSqlText(sql: string): string {
    let clean = sql.trim();
    if (!clean) return sql;

    const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'CROSS JOIN', 'ON', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'UPDATE', 'SET', 'INSERT INTO', 'VALUES', 'DELETE FROM', 'WITH'];

    let formatted = clean;
    for (const kw of keywords) {
        const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
        formatted = formatted.replace(regex, (match) => `\n${match.toUpperCase()}`);
    }

    const lines = formatted.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) {
        return clean;
    }

    const resultLines: string[] = [];
    let isFirst = true;

    for (const line of lines) {
        if (isFirst) {
            resultLines.push(line);
            isFirst = false;
        } else {
            const upper = line.toUpperCase();
            if (upper.startsWith('SELECT') || upper.startsWith('FROM') || upper.startsWith('WHERE') || upper.includes('JOIN') || upper.startsWith('GROUP BY') || upper.startsWith('ORDER BY') || upper.startsWith('LIMIT') || upper.startsWith('SET') || upper.startsWith('HAVING')) {
                resultLines.push(`    ${line}`);
            } else {
                resultLines.push(`        ${line}`);
            }
        }
    }

    return resultLines.join('\n');
}
