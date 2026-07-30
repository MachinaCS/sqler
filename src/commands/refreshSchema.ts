import * as vscode from 'vscode';
import { schemaCacheManager } from '../cache/schemaCache';
import { DbConfig } from '../types';
import { SqlDiagnosticManager } from '../providers/diagnosticProvider';

export function getDbConfig(): DbConfig {
    const config = vscode.workspace.getConfiguration('sqler');
    return {
        host: config.get<string>('host', 'localhost'),
        port: config.get<number>('port', 3306),
        username: config.get<string>('username', 'root'),
        password: config.get<string>('password', ''),
        database: config.get<string>('database', ''),
        combineSameColumns: config.get<boolean>('combineSameColumns', false),
        connections: config.get<any[]>('connections', [])
    };
}

export async function refreshDatabaseSchemaCommand(diagnosticManager?: SqlDiagnosticManager): Promise<void> {
    const config = getDbConfig();
    if ((!config.connections || config.connections.length === 0) && !config.database) {
        vscode.window.showWarningMessage('SQLer: No database connections configured in extension settings (sqler.connections).');
        return;
    }

    try {
        let loadedTablesCount = 0;
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'SQLer: Loading database schema from connections...',
                cancellable: false
            },
            async () => {
                const schema = await schemaCacheManager.refresh(config);
                loadedTablesCount = schema.tables.size;
            }
        );

        vscode.window.showInformationMessage(`SQLer: Loaded metadata for ${loadedTablesCount} tables successfully.`);

        // Re-evaluate diagnostics for active editor
        if (diagnosticManager && vscode.window.activeTextEditor) {
            diagnosticManager.updateDiagnostics(vscode.window.activeTextEditor.document);
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(`SQLer Error reloading schema: ${err.message || String(err)}`);
    }
}
