import * as vscode from 'vscode';
import { SchemaCacheData, TableMeta } from '../types';

export function calculateLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

export function findBestFuzzyMatch(target: string, candidates: string[], maxDistance: number = 3): string | undefined {
    let bestCandidate: string | undefined;
    let minDistance = maxDistance + 1;

    for (const cand of candidates) {
        const dist = calculateLevenshteinDistance(target, cand);
        if (dist < minDistance) {
            minDistance = dist;
            bestCandidate = cand;
        }
    }

    return bestCandidate;
}

export class SqlCodeActionProvider implements vscode.CodeActionProvider {
    private schema: SchemaCacheData;

    constructor(schema: SchemaCacheData) {
        this.schema = schema;
    }

    public updateSchema(schema: SchemaCacheData) {
        this.schema = schema;
    }

    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'SQLer') continue;

            const msg = diagnostic.message;
            const unknownTableMatch = msg.match(/Unknown table '([^']+)'/);
            const unknownColumnMatch = msg.match(/Unknown column '([^']+)'/);

            if (unknownTableMatch) {
                const invalidTable = unknownTableMatch[1];
                const candidateTables: string[] = [];
                for (const t of this.schema.tables.values()) {
                    candidateTables.push(t.name);
                }
                const bestMatch = findBestFuzzyMatch(invalidTable, candidateTables);

                if (bestMatch) {
                    const action = new vscode.CodeAction(
                        `💡 Change '${invalidTable}' to '${bestMatch}'`,
                        vscode.CodeActionKind.QuickFix
                    );
                    action.diagnostics = [diagnostic];
                    action.edit = new vscode.WorkspaceEdit();
                    action.edit.replace(document.uri, diagnostic.range, bestMatch);
                    action.isPreferred = true;
                    actions.push(action);
                }
            } else if (unknownColumnMatch) {
                const invalidCol = unknownColumnMatch[1];
                const candidateCols = new Set<string>();
                for (const tableMeta of this.schema.tables.values()) {
                    for (const col of tableMeta.columns.values()) {
                        candidateCols.add(col.name);
                    }
                }
                const bestMatch = findBestFuzzyMatch(invalidCol, Array.from(candidateCols));

                if (bestMatch) {
                    const action = new vscode.CodeAction(
                        `💡 Change '${invalidCol}' to '${bestMatch}'`,
                        vscode.CodeActionKind.QuickFix
                    );
                    action.diagnostics = [diagnostic];
                    action.edit = new vscode.WorkspaceEdit();
                    action.edit.replace(document.uri, diagnostic.range, bestMatch);
                    action.isPreferred = true;
                    actions.push(action);
                }
            }
        }

        return actions;
    }
}
