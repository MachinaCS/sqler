import * as vscode from 'vscode';
import { SqlCompletionItemProvider } from './providers/completionProvider';
import { SqlHoverProvider } from './providers/hoverProvider';
import { SqlDiagnosticManager } from './providers/diagnosticProvider';
import { refreshDatabaseSchemaCommand, getDbConfig } from './commands/refreshSchema';
import { schemaCacheManager } from './cache/schemaCache';

export function activate(context: vscode.ExtensionContext) {
    console.log('SQLer extension is active.');

    const diagnosticManager = new SqlDiagnosticManager();
    context.subscriptions.push(diagnosticManager);

    // Initial schema load in background
    const config = getDbConfig();
    if (config.database) {
        schemaCacheManager.refresh(config).then(() => {
            if (vscode.window.activeTextEditor) {
                diagnosticManager.updateDiagnostics(vscode.window.activeTextEditor.document);
            }
        }).catch(err => {
            console.error('SQLer background schema load failed:', err);
        });
    }

    // Register Command
    const refreshCmd = vscode.commands.registerCommand('sqler.refreshSchema', () => {
        refreshDatabaseSchemaCommand(diagnosticManager);
    });
    context.subscriptions.push(refreshCmd);

    // Register Completion Item Provider for PHP
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', language: 'php' },
        new SqlCompletionItemProvider(),
        '.', ' ', '*'
    );
    context.subscriptions.push(completionProvider);

    // Register Hover Provider for PHP
    const hoverProvider = vscode.languages.registerHoverProvider(
        { scheme: 'file', language: 'php' },
        new SqlHoverProvider()
    );
    context.subscriptions.push(hoverProvider);

    // Document Events for Diagnostics
    vscode.workspace.onDidOpenTextDocument(doc => {
        diagnosticManager.updateDiagnostics(doc);
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(e => {
        diagnosticManager.updateDiagnostics(e.document);
    }, null, context.subscriptions);

    vscode.workspace.onDidSaveTextDocument(doc => {
        diagnosticManager.updateDiagnostics(doc);
    }, null, context.subscriptions);

    // Update diagnostics for already open documents
    vscode.workspace.textDocuments.forEach(doc => {
        diagnosticManager.updateDiagnostics(doc);
    });

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('sqler')) {
            const newConfig = getDbConfig();
            if (newConfig.database) {
                schemaCacheManager.refresh(newConfig).then(() => {
                    if (vscode.window.activeTextEditor) {
                        diagnosticManager.updateDiagnostics(vscode.window.activeTextEditor.document);
                    }
                }).catch(err => console.error('SQLer config reload error:', err));
            }
        }
    }, null, context.subscriptions);
}

export function deactivate() {}
