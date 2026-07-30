import {
    Token,
    TokenType,
    ClauseType,
    TableAlias,
    DiagnosticError,
    ParsedSqlResult,
    CursorContext,
    SchemaCacheData
} from '../types';
import { tokenizeSql } from './tokenizer';

/**
 * Manual SQL parser that tracks clauses, table aliases, diagnostic validation,
 * and context at the cursor position.
 */
export function parseSql(
    sqlText: string,
    cursorOffset?: number,
    schemaCache?: SchemaCacheData
): ParsedSqlResult {
    const rawTokens = tokenizeSql(sqlText);
    const tokens = rawTokens.filter(t => t.type !== TokenType.Whitespace);

    const aliases = new Map<string, string>(); // alias -> tableName
    const tables: TableAlias[] = [];
    const errors: DiagnosticError[] = [];

    let currentClause = ClauseType.None;
    let i = 0;
    const len = tokens.length;

    function peek(offset = 0): Token {
        if (i + offset < len) return tokens[i + offset];
        return tokens[len - 1];
    }

    function getIdentifier(token: Token): string {
        return token.value;
    }

    let lastJoinedTable: string | undefined;

    while (i < len && peek().type !== TokenType.EOF) {
        const token = peek();

        if (token.type === TokenType.Keyword) {
            const kw = token.value;
            if (kw === 'SELECT') {
                currentClause = ClauseType.SELECT;
                i++;
                continue;
            } else if (kw === 'FROM') {
                currentClause = ClauseType.FROM;
                i++;
                continue;
            } else if (kw === 'JOIN' || kw === 'INNER' || kw === 'LEFT' || kw === 'RIGHT' || kw === 'CROSS') {
                currentClause = ClauseType.JOIN;
                i++;
                if (kw === 'LEFT' || kw === 'RIGHT' || kw === 'INNER' || kw === 'CROSS') {
                    if (peek().value === 'OUTER') i++;
                    if (peek().value === 'JOIN') i++;
                }
                continue;
            } else if (kw === 'ON') {
                currentClause = ClauseType.ON;
                i++;
                continue;
            } else if (kw === 'WHERE') {
                currentClause = ClauseType.WHERE;
                i++;
                continue;
            } else if (kw === 'GROUP') {
                currentClause = ClauseType.GROUP_BY;
                i++;
                if (peek().value === 'BY') i++;
                continue;
            } else if (kw === 'ORDER') {
                currentClause = ClauseType.ORDER_BY;
                i++;
                if (peek().value === 'BY') i++;
                continue;
            } else if (kw === 'LIMIT') {
                currentClause = ClauseType.LIMIT;
                i++;
                continue;
            } else if (kw === 'UPDATE') {
                currentClause = ClauseType.UPDATE;
                i++;
                continue;
            } else if (kw === 'SET') {
                currentClause = ClauseType.SET;
                i++;
                continue;
            } else if (kw === 'INSERT') {
                currentClause = ClauseType.INSERT_INTO;
                i++;
                if (peek().value === 'INTO') i++;
                continue;
            } else if (kw === 'WITH') {
                i++;
                if (peek().value === 'RECURSIVE') i++;
                currentClause = ClauseType.FROM; // Treat CTE names as tables
                continue;
            } else if (kw === 'DELETE') {
                currentClause = ClauseType.FROM;
                i++;
                if (peek().value === 'FROM') i++;
                continue;
            } else if (kw === 'VALUES') {
                currentClause = ClauseType.VALUES;
                i++;
                continue;
            }
        }

        // Parse Table References in FROM, JOIN, UPDATE, INSERT
        if (
            currentClause === ClauseType.FROM ||
            currentClause === ClauseType.JOIN ||
            currentClause === ClauseType.UPDATE ||
            currentClause === ClauseType.INSERT_INTO
        ) {
            if (token.type === TokenType.Identifier || token.type === TokenType.Keyword) {
                let tableName = getIdentifier(token);
                let rawName = tableName;
                const tokenStart = token.start;
                const tokenEnd = token.end;
                i++;

                if (peek().type === TokenType.Dot) {
                    i++; // skip dot
                    if (peek().type === TokenType.Identifier || peek().type === TokenType.Keyword) {
                        tableName = getIdentifier(peek());
                        rawName = `${rawName}.${tableName}`;
                        i++;
                    }
                }

                let aliasName = tableName;
                if (peek().value === 'AS') {
                    i++;
                    if (peek().type === TokenType.Identifier || peek().type === TokenType.Keyword) {
                        aliasName = peek().value;
                        i++;
                    }
                } else if (
                    (peek().type === TokenType.Identifier || peek().type === TokenType.Keyword) &&
                    !['WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'GROUP', 'ORDER', 'LIMIT', 'SET', 'VALUES', 'HAVING', 'UNION', 'CROSS', 'OUTER'].includes(peek().value)
                ) {
                    aliasName = peek().value;
                    i++;
                }

                aliases.set(aliasName, tableName);
                if (aliasName !== tableName) {
                    aliases.set(tableName, tableName);
                }

                const tableAliasObj: TableAlias = {
                    alias: aliasName,
                    tableName,
                    rawName
                };
                tables.push(tableAliasObj);
                if (currentClause === ClauseType.JOIN) {
                    lastJoinedTable = tableName;
                }

                if (schemaCache && schemaCache.tables.size > 0) {
                    if (!schemaCache.tables.has(tableName.toLowerCase())) {
                        errors.push({
                            message: `Unknown table '${tableName}'`,
                            start: tokenStart,
                            end: tokenEnd,
                            type: 'unknown_table'
                        });
                    }
                }

                if (currentClause === ClauseType.FROM) {
                    if (peek().type === TokenType.Comma) {
                        i++;
                    } else {
                        currentClause = ClauseType.None;
                    }
                } else if (currentClause === ClauseType.JOIN || currentClause === ClauseType.UPDATE || currentClause === ClauseType.INSERT_INTO) {
                    currentClause = ClauseType.None;
                }
                continue;
            }
        }

        i++;
    }

    // Second pass for qualified column diagnostics and table validation
    if (schemaCache && schemaCache.tables.size > 0) {
        for (let idx = 0; idx < tokens.length; idx++) {
            const tok = tokens[idx];
            if (tok.type === TokenType.Identifier || tok.type === TokenType.Keyword) {
                if (idx + 1 < tokens.length && tokens[idx + 1].type === TokenType.Dot) {
                    const qualifier = tok.value;
                    if (idx + 2 < tokens.length) {
                        const thirdTok = tokens[idx + 2];
                        if (thirdTok.type === TokenType.Identifier || thirdTok.type === TokenType.Keyword || thirdTok.type === TokenType.Star) {
                            const colName = thirdTok.value;
                            if (colName !== '*') {
                                const resolvedTable = aliases.get(qualifier) || (schemaCache.tables.has(qualifier.toLowerCase()) ? qualifier : undefined);
                                if (!resolvedTable) {
                                    errors.push({
                                        message: `Unknown alias or table '${qualifier}'`,
                                        start: tok.start,
                                        end: tok.end,
                                        type: 'unknown_alias'
                                    });
                                } else {
                                    const tableMeta = schemaCache.tables.get(resolvedTable.toLowerCase());
                                    if (tableMeta && !tableMeta.columns.has(colName.toLowerCase())) {
                                        errors.push({
                                            message: `Unknown column '${colName}' in table '${resolvedTable}'`,
                                            start: thirdTok.start,
                                            end: thirdTok.end,
                                            type: 'unknown_column'
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let cursorContext: CursorContext | undefined;
    if (cursorOffset !== undefined) {
        cursorContext = determineCursorContext(sqlText, rawTokens, cursorOffset, tables, aliases, lastJoinedTable);
    }

    return {
        aliases,
        tables,
        errors,
        cursorContext
    };
}

function determineCursorContext(
    sqlText: string,
    rawTokens: Token[],
    cursorOffset: number,
    activeTables: TableAlias[],
    aliases: Map<string, string>,
    lastJoinedTable?: string
): CursorContext {
    let clause = ClauseType.None;
    let isAfterDot = false;
    let targetQualifier: string | undefined;
    let currentWord = '';

    for (const tok of rawTokens) {
        if (tok.start > cursorOffset) break;

        if (tok.type === TokenType.Keyword) {
            const kw = tok.value;
            if (kw === 'SELECT') clause = ClauseType.SELECT;
            else if (kw === 'FROM') clause = ClauseType.FROM;
            else if (kw === 'JOIN' || kw === 'LEFT' || kw === 'RIGHT' || kw === 'INNER') clause = ClauseType.JOIN;
            else if (kw === 'ON') clause = ClauseType.ON;
            else if (kw === 'WHERE') clause = ClauseType.WHERE;
            else if (kw === 'GROUP') clause = ClauseType.GROUP_BY;
            else if (kw === 'ORDER') clause = ClauseType.ORDER_BY;
            else if (kw === 'LIMIT') clause = ClauseType.LIMIT;
            else if (kw === 'UPDATE') clause = ClauseType.UPDATE;
            else if (kw === 'SET') clause = ClauseType.SET;
            else if (kw === 'INSERT') clause = ClauseType.INSERT_INTO;
        }
    }

    const textBefore = sqlText.substring(0, cursorOffset);
    let idx = cursorOffset - 1;

    while (idx >= 0 && (/[a-zA-Z0-9_$]/.test(sqlText[idx]))) {
        idx--;
    }
    currentWord = sqlText.substring(idx + 1, cursorOffset);

    if (idx >= 0 && sqlText[idx] === '.') {
        isAfterDot = true;
        let qIdx = idx - 1;
        while (qIdx >= 0 && (/[a-zA-Z0-9_$]/.test(sqlText[qIdx]))) {
            qIdx--;
        }
        targetQualifier = sqlText.substring(qIdx + 1, idx);
    }

    // Check if in WHERE clause cursor follows a column identifier e.g. `WHERE archiwumId |`
    let isExpressionComplete = false;
    let isAfterColumnInWhere = false;
    let isAfterSelectFunction = false;

    if (clause === ClauseType.WHERE) {
        const tokensBefore = rawTokens.filter(t => t.type !== TokenType.Whitespace && t.start < cursorOffset);
        if (tokensBefore.length > 0) {
            const lastTok = tokensBefore[tokensBefore.length - 1];

            // If last token before cursor is an identifier or keyword (not an operator or value)
            if (lastTok.type === TokenType.Identifier || lastTok.type === TokenType.Keyword) {
                if (tokensBefore.length >= 2) {
                    const secondLast = tokensBefore[tokensBefore.length - 2];
                    if (
                        secondLast.value === 'WHERE' ||
                        secondLast.value === 'AND' ||
                        secondLast.value === 'OR' ||
                        secondLast.type === TokenType.Dot
                    ) {
                        isAfterColumnInWhere = true;
                    }
                } else {
                    isAfterColumnInWhere = true;
                }
            }

            if (tokensBefore.length >= 3 && !isAfterColumnInWhere) {
                const prevTok = tokensBefore[tokensBefore.length - 2];
                if (
                    (lastTok.type === TokenType.Number || lastTok.type === TokenType.String || lastTok.type === TokenType.Identifier) &&
                    (prevTok.type === TokenType.Equals || prevTok.type === TokenType.Operator || prevTok.value === 'IS' || prevTok.value === 'LIKE' || prevTok.value === 'IN')
                ) {
                    isExpressionComplete = true;
                }
            }
        }
    }

    // Check if in SELECT clause cursor follows a closed parenthesis e.g. `SELECT AVG(column) |`
    if (clause === ClauseType.SELECT) {
        const tokensBefore = rawTokens.filter(t => t.type !== TokenType.Whitespace && t.start < cursorOffset);
        if (tokensBefore.length > 0) {
            const lastTok = tokensBefore[tokensBefore.length - 1];
            if (lastTok.type === TokenType.CloseParen) {
                isAfterSelectFunction = true;
            }
        }
    }

    // Check if FROM table is complete without trailing comma e.g. `SELECT * FROM Uczestnik |`
    let isFromTableComplete = false;
    if (clause === ClauseType.FROM && activeTables.length > 0) {
        const tokensBefore = rawTokens.filter(t => t.type !== TokenType.Whitespace && t.start < cursorOffset);
        const lastTok = tokensBefore[tokensBefore.length - 1];
        if (lastTok && lastTok.type !== TokenType.Comma) {
            isFromTableComplete = true;
        }
    }

    let joinLeftTable: string | undefined;
    if (activeTables.length > 0) {
        joinLeftTable = activeTables[0].tableName;
    }

    return {
        clause,
        isAfterDot,
        targetQualifier,
        currentWord,
        activeTables,
        joinLeftTable,
        joinRightTable: lastJoinedTable,
        isExpressionComplete,
        isAfterColumnInWhere,
        isFromTableComplete,
        isAfterSelectFunction
    };
}
