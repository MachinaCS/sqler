import * as vscode from 'vscode';
import { extractPhpSqlStrings } from '../utils/phpAst';

export class SqlCodeLensProvider implements vscode.CodeLensProvider {
    public provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        if (document.languageId !== 'php') {
            return [];
        }

        const fullText = document.getText();
        const phpSqlStrings = extractPhpSqlStrings(fullText);
        const codeLenses: vscode.CodeLens[] = [];

        for (const phpSql of phpSqlStrings) {
            const startPos = document.positionAt(phpSql.startOffset);
            const lineRange = new vscode.Range(startPos, startPos);

            const lens = new vscode.CodeLens(lineRange, {
                title: '▶ Run SQL Query',
                command: 'sqler.executeQuery',
                arguments: [phpSql.sqlText]
            });
            codeLenses.push(lens);

            const fmtLens = new vscode.CodeLens(lineRange, {
                title: '✨ Format SQL',
                command: 'sqler.formatQuery',
                arguments: []
            });
            codeLenses.push(fmtLens);
        }

        return codeLenses;
    }
}
