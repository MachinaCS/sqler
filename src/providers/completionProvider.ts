import * as vscode from 'vscode';
import { getPhpSqlStringAtOffset } from '../utils/phpAst';
import { parseSql } from '../parser/parser';
import { schemaCacheManager } from '../cache/schemaCache';
import { ClauseType } from '../types';
import { getDbConfig } from '../commands/refreshSchema';

const MYSQL_BUILTIN_FUNCTIONS = [
    // Aggregates & Window Functions
    { name: 'COUNT(...)', snippet: 'COUNT(${1:*})', doc: 'Returns number of rows matching query criteria' },
    { name: 'SUM(...)', snippet: 'SUM(${1:column})', doc: 'Calculates the sum of numeric values' },
    { name: 'AVG(...)', snippet: 'AVG(${1:column})', doc: 'Calculates the average value of a numeric column' },
    { name: 'MIN(...)', snippet: 'MIN(${1:column})', doc: 'Returns the minimum value' },
    { name: 'MAX(...)', snippet: 'MAX(${1:column})', doc: 'Returns the maximum value' },
    { name: 'GROUP_CONCAT(...)', snippet: 'GROUP_CONCAT(${1:column} SEPARATOR \'${2:,}\')', doc: 'Concatenates strings from a group into one string' },
    { name: 'JSON_ARRAYAGG(...)', snippet: 'JSON_ARRAYAGG(${1:column})', doc: 'Aggregates values into a JSON array' },
    { name: 'JSON_OBJECTAGG(...)', snippet: 'JSON_OBJECTAGG(${1:key}, ${2:val})', doc: 'Aggregates key-value pairs into a JSON object' },
    { name: 'ROW_NUMBER() OVER()', snippet: 'ROW_NUMBER() OVER(PARTITION BY ${1:column} ORDER BY ${2:column})', doc: 'Window function returning sequential row number' },
    { name: 'RANK() OVER()', snippet: 'RANK() OVER(PARTITION BY ${1:column} ORDER BY ${2:column})', doc: 'Window function returning rank with gaps' },
    { name: 'DENSE_RANK() OVER()', snippet: 'DENSE_RANK() OVER(PARTITION BY ${1:column} ORDER BY ${2:column})', doc: 'Window function returning rank without gaps' },
    { name: 'LAG(...) OVER()', snippet: 'LAG(${1:column}, ${2:1}) OVER(PARTITION BY ${3:column} ORDER BY ${4:column})', doc: 'Returns value from a previous row' },
    { name: 'LEAD(...) OVER()', snippet: 'LEAD(${1:column}, ${2:1}) OVER(PARTITION BY ${3:column} ORDER BY ${4:column})', doc: 'Returns value from a subsequent row' },

    // Conditional & General
    { name: 'CASE WHEN ... END', snippet: 'CASE WHEN ${1:condition} THEN ${2:result} ELSE ${3:default} END', doc: 'Conditional CASE expression' },
    { name: 'IF(...)', snippet: 'IF(${1:condition}, ${2:true_val}, ${3:false_val})', doc: 'IF condition statement' },
    { name: 'IFNULL(...)', snippet: 'IFNULL(${1:expr1}, ${2:expr2})', doc: 'Replaces NULL with alternative value' },
    { name: 'COALESCE(...)', snippet: 'COALESCE(${1:val1}, ${2:val2})', doc: 'Returns first non-NULL value in list' },
    { name: 'GREATEST(...)', snippet: 'GREATEST(${1:val1}, ${2:val2})', doc: 'Returns largest value from arguments' },
    { name: 'LEAST(...)', snippet: 'LEAST(${1:val1}, ${2:val2})', doc: 'Returns smallest value from arguments' },

    // Strings & JSON
    { name: 'CONCAT(...)', snippet: 'CONCAT(${1:str1}, ${2:str2})', doc: 'Concatenates two or more string values' },
    { name: 'CONCAT_WS(...)', snippet: 'CONCAT_WS(\'${1:,}\', ${2:str1}, ${3:str2})', doc: 'Concatenates strings with a separator' },
    { name: 'SUBSTRING(...)', snippet: 'SUBSTRING(${1:str}, ${2:pos}, ${3:len})', doc: 'Extracts substring' },
    { name: 'REPLACE(...)', snippet: 'REPLACE(${1:str}, ${2:from}, ${3:to})', doc: 'Replaces occurrences of substring' },
    { name: 'REGEXP_REPLACE(...)', snippet: 'REGEXP_REPLACE(${1:expr}, ${2:pattern}, ${3:replace})', doc: 'Replaces regex pattern matches' },
    { name: 'CHAR_LENGTH(...)', snippet: 'CHAR_LENGTH(${1:str})', doc: 'Returns string length in characters' },
    { name: 'LOWER(...)', snippet: 'LOWER(${1:str})', doc: 'Converts string to lowercase' },
    { name: 'UPPER(...)', snippet: 'UPPER(${1:str})', doc: 'Converts string to uppercase' },
    { name: 'JSON_EXTRACT(...)', snippet: 'JSON_EXTRACT(${1:json_doc}, \'$.${2:path}\')', doc: 'Extracts data from JSON document' },
    { name: 'JSON_UNQUOTE(...)', snippet: 'JSON_UNQUOTE(${1:val})', doc: 'Unquotes JSON value' },
    { name: 'JSON_TABLE(...)', snippet: 'JSON_TABLE(${1:json_doc}, \'$.${2:path}\' COLUMNS(${3:cols}))', doc: 'Extracts JSON data as relational table' },

    // Date & Time
    { name: 'NOW()', snippet: 'NOW()', doc: 'Returns current date and time' },
    { name: 'CURRENT_TIMESTAMP()', snippet: 'CURRENT_TIMESTAMP()', doc: 'Returns current timestamp' },
    { name: 'DATE_FORMAT(...)', snippet: 'DATE_FORMAT(${1:date}, \'${2:%Y-%m-%d}\')', doc: 'Formats date value' },
    { name: 'DATE_ADD(...)', snippet: 'DATE_ADD(${1:date}, INTERVAL ${2:1} DAY)', doc: 'Adds time interval to date' },
    { name: 'DATE_SUB(...)', snippet: 'DATE_SUB(${1:date}, INTERVAL ${2:1} DAY)', doc: 'Subtracts time interval from date' },
    { name: 'DATEDIFF(...)', snippet: 'DATEDIFF(${1:expr1}, ${2:expr2})', doc: 'Returns days between two dates' },
    { name: 'TIMESTAMPDIFF(...)', snippet: 'TIMESTAMPDIFF(${1:DAY}, ${2:datetime1}, ${3:datetime2})', doc: 'Returns difference between datetimes' },

    // GIS / System / Crypto
    { name: 'ST_Distance(...)', snippet: 'ST_Distance(${1:g1}, ${2:g2})', doc: 'Returns distance between two geometries' },
    { name: 'ST_Contains(...)', snippet: 'ST_Contains(${1:g1}, ${2:g2})', doc: 'Tests if geometry 1 contains geometry 2' },
    { name: 'DATABASE()', snippet: 'DATABASE()', doc: 'Returns current default database name' },
    { name: 'USER()', snippet: 'USER()', doc: 'Returns current user name and host' },
    { name: 'LAST_INSERT_ID()', snippet: 'LAST_INSERT_ID()', doc: 'Returns AUTO_INCREMENT id generated by last query' },
    { name: 'MD5(...)', snippet: 'MD5(${1:str})', doc: 'Calculates MD5 checksum' },
    { name: 'SHA2(...)', snippet: 'SHA2(${1:str}, ${2:256})', doc: 'Calculates SHA-2 hash' },
    { name: 'UUID()', snippet: 'UUID()', doc: 'Generates Universally Unique Identifier' },
    { name: 'EXISTS(...)', snippet: 'EXISTS(${1:subquery})', doc: 'Tests existence of subquery rows' }
];

export class SqlCompletionItemProvider implements vscode.CompletionItemProvider {
    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | undefined> {
        if (document.languageId !== 'php') {
            return undefined;
        }

        const fullText = document.getText();
        const offset = document.offsetAt(position);

        const phpSql = getPhpSqlStringAtOffset(fullText, offset);
        if (!phpSql) {
            return undefined;
        }

        const relativeOffset = offset - phpSql.startOffset;
        const schema = schemaCacheManager.getCache();
        const parseResult = parseSql(phpSql.sqlText, relativeOffset, schema);
        const config = getDbConfig();

        const cursorCtx = parseResult.cursorContext;
        if (!cursorCtx) {
            return undefined;
        }

        const items: vscode.CompletionItem[] = [];
        const serverBadge = schema.serverInfo ? ` [${schema.serverInfo}]` : '';

        // 1. Dot completion after alias or table name e.g. `u.|` or `AgendaGrupa.|`
        if (cursorCtx.isAfterDot && cursorCtx.targetQualifier) {
            const qualifier = cursorCtx.targetQualifier;
            const targetTable = parseResult.aliases.get(qualifier) || qualifier;
            const tableMeta = schema.tables.get(targetTable.toLowerCase());

            if (tableMeta) {
                for (const col of tableMeta.columns.values()) {
                    const item = new vscode.CompletionItem(col.name, vscode.CompletionItemKind.Field);
                    item.detail = `${col.columnType} (${tableMeta.databaseName}.${tableMeta.name})${serverBadge}`;
                    
                    let docStr = `Column: **${col.name}**\nTable: **${tableMeta.name}** (DB: \`${tableMeta.databaseName}\`)\nType: \`${col.columnType}\`\nNullable: ${col.isNullable ? 'Yes' : 'No'}`;
                    if (col.comment) docStr += `\n\n**Comment**: _${col.comment}_`;
                    if (col.isPrimaryKey) docStr += '\n\n**Primary Key**: Yes';
                    if (col.isForeignKey && col.foreignKeyRef) docStr += `\n\n**Foreign Key** -> \`${col.foreignKeyRef.targetTable}.${col.foreignKeyRef.targetColumn}\``;
                    
                    item.documentation = new vscode.MarkdownString(docStr);
                    items.push(item);
                }
            }
            return items;
        }

        // 2. FROM clause with complete table e.g. `SELECT * FROM Uczestnik |`
        if (cursorCtx.clause === ClauseType.FROM && cursorCtx.isFromTableComplete) {
            const keywords = ['WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'CROSS JOIN', 'ORDER BY', 'GROUP BY', 'LIMIT'];
            for (const kw of keywords) {
                const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
                item.detail = 'SQL Clause';
                items.push(item);
            }
            return items;
        }

        // 3. Strict Clause Context: FROM, JOIN, LEFT JOIN, RIGHT JOIN, INNER JOIN, UPDATE, INSERT INTO
        if (
            cursorCtx.clause === ClauseType.FROM ||
            cursorCtx.clause === ClauseType.JOIN ||
            cursorCtx.clause === ClauseType.UPDATE ||
            cursorCtx.clause === ClauseType.INSERT_INTO
        ) {
            const addedTables = new Set<string>();
            for (const tableMeta of schema.tables.values()) {
                const uniqueKey = `${tableMeta.databaseName}.${tableMeta.name}`;
                if (addedTables.has(uniqueKey)) continue;
                addedTables.add(uniqueKey);

                const item = new vscode.CompletionItem(tableMeta.name, vscode.CompletionItemKind.Class);
                item.detail = `Table in ${tableMeta.databaseName} (${tableMeta.columns.size} cols)${serverBadge}`;
                
                let docStr = `Table: **${tableMeta.name}**\nDatabase: **${tableMeta.databaseName}**\nPrimary Keys: ${tableMeta.primaryKeys.join(', ') || 'None'}`;
                item.documentation = new vscode.MarkdownString(docStr);
                items.push(item);
            }
            return items;
        }

        // 4. ON Clause Completion (`ON |` or `JOIN ... ON |`)
        if (cursorCtx.clause === ClauseType.ON) {
            for (const tableAlias of cursorCtx.activeTables) {
                const tableMeta = schema.tables.get(tableAlias.tableName.toLowerCase());
                if (tableMeta && tableMeta.foreignKeys.length > 0) {
                    for (const fk of tableMeta.foreignKeys) {
                        const otherAlias = cursorCtx.activeTables.find(
                            t => t.tableName.toLowerCase() === fk.referencedTableName.toLowerCase()
                        );
                        if (otherAlias) {
                            const onCondition = `${tableAlias.alias}.${fk.columnName} = ${otherAlias.alias}.${fk.referencedColumnName}`;
                            const item = new vscode.CompletionItem(onCondition, vscode.CompletionItemKind.Value);
                            item.detail = `FK Condition: ${tableAlias.tableName} -> ${otherAlias.tableName}${serverBadge}`;
                            item.documentation = new vscode.MarkdownString(`ON clause auto-join based on FK constraint \`${fk.constraintName}\``);
                            items.push(item);
                        }
                    }
                }
            }
            return items;
        }

        // 5. SELECT clause immediately following closed parenthesis e.g. `SELECT AVG(column) |`
        if (cursorCtx.clause === ClauseType.SELECT && cursorCtx.isAfterSelectFunction) {
            const kwAs = new vscode.CompletionItem('AS', vscode.CompletionItemKind.Keyword);
            kwAs.detail = 'Alias specification';
            kwAs.insertText = new vscode.SnippetString('AS ${1:alias_name}');
            items.push(kwAs);

            const kwComma = new vscode.CompletionItem(',', vscode.CompletionItemKind.Operator);
            kwComma.detail = 'Column separator';
            items.push(kwComma);

            const kwFrom = new vscode.CompletionItem('FROM', vscode.CompletionItemKind.Keyword);
            kwFrom.detail = 'Table source clause';
            kwFrom.command = { command: 'editor.action.triggerSuggest', title: 'Trigger Table Suggestions' };
            items.push(kwFrom);

            return items;
        }

        // 6. WHERE clause immediately following a column name e.g. `SELECT * FROM Uczestnik WHERE archiwumId |`
        if (cursorCtx.clause === ClauseType.WHERE && cursorCtx.isAfterColumnInWhere) {
            const operators = [
                { name: '=', doc: 'Equal operator' },
                { name: '<>', doc: 'Not equal operator' },
                { name: '!=', doc: 'Not equal operator' },
                { name: '>', doc: 'Greater than operator' },
                { name: '<', doc: 'Less than operator' },
                { name: '>=', doc: 'Greater than or equal operator' },
                { name: '<=', doc: 'Less than or equal operator' },
                { name: 'IN (...)', snippet: 'IN (${1:val1}, ${2:val2})', doc: 'Match value in set' },
                { name: 'NOT IN (...)', snippet: 'NOT IN (${1:val1}, ${2:val2})', doc: 'Match value not in set' },
                { name: 'BETWEEN ... AND ...', snippet: 'BETWEEN ${1:min} AND ${2:max}', doc: 'Match value in range' },
                { name: 'LIKE', snippet: 'LIKE \'${1:%val%}\'', doc: 'Pattern matching' },
                { name: 'NOT LIKE', snippet: 'NOT LIKE \'${1:%val%}\'', doc: 'Pattern non-matching' },
                { name: 'IS NULL', doc: 'Matches NULL value' },
                { name: 'IS NOT NULL', doc: 'Matches non-NULL value' }
            ];

            for (const op of operators) {
                const item = new vscode.CompletionItem(op.name, vscode.CompletionItemKind.Operator);
                item.detail = op.doc;
                if (op.snippet) {
                    item.insertText = new vscode.SnippetString(op.snippet);
                }
                items.push(item);
            }
            return items;
        }

        // 7. WHERE clause: Suppress columns if expression is complete (e.g. `WHERE a.id <> 0 |`)
        if (cursorCtx.clause === ClauseType.WHERE && cursorCtx.isExpressionComplete) {
            const opAnd = new vscode.CompletionItem('AND', vscode.CompletionItemKind.Keyword);
            opAnd.detail = 'Logical AND operator';
            items.push(opAnd);

            const opOr = new vscode.CompletionItem('OR', vscode.CompletionItemKind.Keyword);
            opOr.detail = 'Logical OR operator';
            items.push(opOr);

            const clauseGroup = new vscode.CompletionItem('GROUP BY', vscode.CompletionItemKind.Keyword);
            items.push(clauseGroup);

            const clauseOrder = new vscode.CompletionItem('ORDER BY', vscode.CompletionItemKind.Keyword);
            items.push(clauseOrder);

            const clauseLimit = new vscode.CompletionItem('LIMIT', vscode.CompletionItemKind.Keyword);
            items.push(clauseLimit);

            return items;
        }

        // 8. Clause Context: SELECT, WHERE, ORDER BY, GROUP BY, SET
        if (
            cursorCtx.clause === ClauseType.SELECT ||
            cursorCtx.clause === ClauseType.WHERE ||
            cursorCtx.clause === ClauseType.ORDER_BY ||
            cursorCtx.clause === ClauseType.GROUP_BY ||
            cursorCtx.clause === ClauseType.SET
        ) {
            // Suggest MySQL / MariaDB Built-in functions in SELECT / WHERE
            for (const fn of MYSQL_BUILTIN_FUNCTIONS) {
                const fnItem = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
                fnItem.detail = `MySQL Function${serverBadge}`;
                fnItem.insertText = new vscode.SnippetString(fn.snippet);
                fnItem.documentation = new vscode.MarkdownString(fn.doc);
                fnItem.sortText = `2_${fn.name}`;
                items.push(fnItem);
            }

            // Suggest Table Aliases (e.g. `u`, `p`) if table is aliased
            for (const aliasObj of cursorCtx.activeTables) {
                if (aliasObj.alias !== aliasObj.tableName) {
                    const aliasItem = new vscode.CompletionItem(aliasObj.alias, vscode.CompletionItemKind.Variable);
                    const tableMeta = schema.tables.get(aliasObj.tableName.toLowerCase());
                    const dbStr = tableMeta ? ` (DB: ${tableMeta.databaseName})` : '';
                    aliasItem.detail = `Alias '${aliasObj.alias}' -> Table '${aliasObj.tableName}'${dbStr}${serverBadge}`;
                    aliasItem.documentation = new vscode.MarkdownString(`Table Alias: **${aliasObj.alias}**\nPoints to Table: **${aliasObj.tableName}**`);
                    aliasItem.sortText = `0_${aliasObj.alias}`;
                    items.push(aliasItem);
                }
            }

            // If activeTables is EMPTY (e.g. typing `SELECT AVG(a|)` before `FROM` exists), suggest ALL columns from all cached tables
            if (cursorCtx.activeTables.length === 0) {
                const addedCols = new Set<string>();
                for (const tableMeta of schema.tables.values()) {
                    for (const col of tableMeta.columns.values()) {
                        const uniqueKey = `${col.name.toLowerCase()}:${tableMeta.name.toLowerCase()}`;
                        if (addedCols.has(uniqueKey)) continue;
                        addedCols.add(uniqueKey);

                        const plainColItem = new vscode.CompletionItem(col.name, vscode.CompletionItemKind.Field);
                        plainColItem.detail = `${col.columnType} (${tableMeta.name})${serverBadge}`;
                        let plainDocStr = `Column: **${col.name}**\nTable: **${tableMeta.name}** (DB: \`${tableMeta.databaseName}\`)\nType: \`${col.columnType}\``;
                        if (col.comment) plainDocStr += `\n\n**Comment**: _${col.comment}_`;
                        plainColItem.documentation = new vscode.MarkdownString(plainDocStr);
                        plainColItem.sortText = `0_${col.name}`;
                        items.push(plainColItem);
                    }
                }
            } else {
                // Option combineSameColumns: group identical column names across active tables
                if (config.combineSameColumns && cursorCtx.activeTables.length > 1) {
                    const columnOccurrences = new Map<string, { colName: string; aliases: string[]; colType: string }>();

                    for (const aliasObj of cursorCtx.activeTables) {
                        const tableMeta = schema.tables.get(aliasObj.tableName.toLowerCase());
                        if (tableMeta) {
                            for (const col of tableMeta.columns.values()) {
                                const colLower = col.name.toLowerCase();
                                if (!columnOccurrences.has(colLower)) {
                                    columnOccurrences.set(colLower, { colName: col.name, aliases: [], colType: col.columnType });
                                }
                                columnOccurrences.get(colLower)!.aliases.push(aliasObj.alias);
                            }
                        }
                    }

                    for (const entry of columnOccurrences.values()) {
                        if (entry.aliases.length > 1) {
                            const item = new vscode.CompletionItem(entry.colName, vscode.CompletionItemKind.EnumMember);
                            item.detail = `Combined Column (in: ${entry.aliases.join(', ')})${serverBadge}`;
                            item.documentation = new vscode.MarkdownString(`Column **${entry.colName}** (\`${entry.colType}\`) present in tables/aliases: ${entry.aliases.join(', ')}`);
                            item.sortText = `0_${entry.colName}`;
                            items.push(item);
                        }
                    }
                }

                // Suggest UNPREFIXED (linear) columns AND qualified `alias.col`
                for (const aliasObj of cursorCtx.activeTables) {
                    const tableMeta = schema.tables.get(aliasObj.tableName.toLowerCase());
                    if (tableMeta) {
                        const hasAlias = aliasObj.alias !== aliasObj.tableName;

                        for (const col of tableMeta.columns.values()) {
                            const plainColItem = new vscode.CompletionItem(col.name, vscode.CompletionItemKind.Field);
                            plainColItem.detail = `${col.columnType} (${tableMeta.name})${serverBadge}`;
                            let plainDocStr = `Column: **${col.name}**\nTable: **${tableMeta.name}** (DB: \`${tableMeta.databaseName}\`)\nType: \`${col.columnType}\``;
                            if (col.comment) plainDocStr += `\n\n**Comment**: _${col.comment}_`;
                            plainColItem.documentation = new vscode.MarkdownString(plainDocStr);
                            plainColItem.sortText = `0_${col.name}`;
                            items.push(plainColItem);

                            if (hasAlias) {
                                const qualifiedName = `${aliasObj.alias}.${col.name}`;
                                const qualifiedColItem = new vscode.CompletionItem(qualifiedName, vscode.CompletionItemKind.Field);
                                qualifiedColItem.detail = `${col.columnType} (Alias '${aliasObj.alias}' -> Table '${tableMeta.name}')${serverBadge}`;
                                let qualDocStr = `Column: **${col.name}**\nAlias: **${aliasObj.alias}** (Table: \`${tableMeta.name}\`, DB: \`${tableMeta.databaseName}\`)\nType: \`${col.columnType}\``;
                                if (col.comment) qualDocStr += `\n\n**Comment**: _${col.comment}_`;
                                qualifiedColItem.documentation = new vscode.MarkdownString(qualDocStr);
                                qualifiedColItem.sortText = `0_${qualifiedName}`;
                                items.push(qualifiedColItem);
                            }
                        }
                    }
                }
            }
        }

        return items;
    }
}
