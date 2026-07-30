import * as vscode from 'vscode';
import { extractPhpSqlStrings } from '../utils/phpAst';
import { parseSql } from '../parser/parser';
import { schemaCacheManager } from '../cache/schemaCache';

export class SqlDiagnosticManager {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('sqler');
    }

    public updateDiagnostics(document: vscode.TextDocument): void {
        if (document.languageId !== 'php') {
            this.diagnosticCollection.delete(document.uri);
            return;
        }

        const fullText = document.getText();
        const phpSqlStrings = extractPhpSqlStrings(fullText);
        const diagnostics: vscode.Diagnostic[] = [];
        const schema = schemaCacheManager.getCache();

        for (const phpSql of phpSqlStrings) {
            const parseResult = parseSql(phpSql.sqlText, undefined, schema);
            for (const err of parseResult.errors) {
                const absStart = phpSql.startOffset + err.start;
                const absEnd = phpSql.startOffset + err.end;

                const startPos = document.positionAt(absStart);
                const endPos = document.positionAt(absEnd);

                const range = new vscode.Range(startPos, endPos);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    err.message,
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'SQLer';
                diagnostics.push(diagnostic);
            }
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    public clear(): void {
        this.diagnosticCollection.clear();
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
