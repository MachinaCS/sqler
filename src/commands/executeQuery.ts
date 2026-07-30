import * as vscode from 'vscode';
import * as mysql from 'mysql2/promise';
import { getDbConfig } from './refreshSchema';

export async function executeQueryCommand(sql?: string) {
    let queryToRun = sql;

    if (!queryToRun) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.document.getText(editor.selection);
            queryToRun = selection.trim();
        }
    }

    if (!queryToRun) {
        vscode.window.showErrorMessage('No SQL query selected or found.');
        return;
    }

    const config = getDbConfig();
    const activeConnection = config.connections[0];

    if (!activeConnection || !activeConnection.host || !activeConnection.database) {
        vscode.window.showErrorMessage('No active database connection configured in SQLer Settings.');
        return;
    }

    try {
        vscode.window.showInformationMessage(`Executing query on ${activeConnection.name} (${activeConnection.database})...`);

        const conn = await mysql.createConnection({
            host: activeConnection.host,
            port: activeConnection.port,
            user: activeConnection.username,
            password: activeConnection.password,
            database: activeConnection.database
        });

        let safeSql = queryToRun.trim();
        if (safeSql.toUpperCase().startsWith('SELECT') && !safeSql.toUpperCase().includes('LIMIT')) {
            safeSql += ' LIMIT 50';
        }

        const [rows, fields] = await conn.query(safeSql);
        await conn.end();

        const panel = vscode.window.createWebviewPanel(
            'sqlerResults',
            `SQLer Results: ${activeConnection.name}`,
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = renderResultsHtml(safeSql, rows, fields);
    } catch (err: any) {
        vscode.window.showErrorMessage(`SQL Execution Error: ${err.message}`);
    }
}

function renderResultsHtml(sql: string, rows: any, fields: any): string {
    const rowList = Array.isArray(rows) ? rows : [];
    const fieldList = Array.isArray(fields) ? fields.map(f => f.name) : [];

    let tableHeaders = fieldList.map(f => `<th>${f}</th>`).join('');
    let tableRows = rowList.map(r => {
        let cols = fieldList.map(f => `<td>${r[f] !== null && r[f] !== undefined ? String(r[f]) : '<i>NULL</i>'}</td>`).join('');
        return `<tr>${cols}</tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SQLer Query Results</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #1e1e1e; color: #d4d4d4; padding: 15px; }
        h3 { color: #569cd6; margin-bottom: 5px; }
        pre { background: #252526; padding: 10px; border-radius: 4px; overflow-x: auto; color: #ce9178; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #3c3c3c; padding: 8px 12px; text-align: left; }
        th { background: #2d2d2d; color: #4ec9b0; }
        tr:nth-child(even) { background: #252526; }
        tr:hover { background: #37373d; }
    </style>
</head>
<body>
    <h3>SQLer Result Preview (${rowList.length} rows)</h3>
    <pre>${sql}</pre>
    <table>
        <thead><tr>${tableHeaders}</tr></thead>
        <tbody>${tableRows}</tbody>
    </table>
</body>
</html>`;
}
