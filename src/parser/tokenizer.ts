import { Token, TokenType } from '../types';

const KEYWORDS = new Set([
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'CROSS', 'OUTER',
    'ON', 'GROUP', 'BY', 'HAVING', 'LIMIT', 'UPDATE', 'SET', 'INSERT',
    'INTO', 'VALUES', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'WITH',
    'RECURSIVE', 'AS', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'EXISTS',
    'BETWEEN', 'REPLACE', 'UNION', 'ALL', 'ASC', 'DESC', 'OVER', 'PARTITION',
    'WINDOW', 'RETURNING', 'DUPLICATE', 'KEY', 'MATCH', 'AGAINST', 'REGEXP',
    'CAST', 'CONVERT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'GRANT', 'REVOKE',
    'SHOW', 'EXPLAIN', 'ANALYZE', 'OPTIMIZE', 'CHECK', 'TABLE', 'LOCK', 'TABLES',
    'UNLOCK', 'TRANSACTION', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'SIGNAL', 'RESIGNAL'
]);

function isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
}

function isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
}

function isAlphaNum(ch: string): boolean {
    return isAlpha(ch) || isDigit(ch);
}

/**
 * Manual SQL Tokenizer without regular expressions.
 */
export function tokenizeSql(sql: string): Token[] {
    const tokens: Token[] = [];
    const len = sql.length;
    let i = 0;

    while (i < len) {
        const start = i;
        const ch = sql[i];

        // Whitespace
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            while (i < len && (sql[i] === ' ' || sql[i] === '\t' || sql[i] === '\n' || sql[i] === '\r')) {
                i++;
            }
            tokens.push({
                type: TokenType.Whitespace,
                value: sql.substring(start, i),
                start,
                end: i
            });
            continue;
        }

        // Single-line comment -- or #
        if ((ch === '-' && i + 1 < len && sql[i + 1] === '-') || ch === '#') {
            while (i < len && sql[i] !== '\n' && sql[i] !== '\r') {
                i++;
            }
            tokens.push({
                type: TokenType.Whitespace,
                value: sql.substring(start, i),
                start,
                end: i
            });
            continue;
        }

        // Multi-line comment /* ... */
        if (ch === '/' && i + 1 < len && sql[i + 1] === '*') {
            i += 2;
            while (i < len && !(sql[i] === '*' && i + 1 < len && sql[i + 1] === '/')) {
                i++;
            }
            if (i < len) i += 2;
            tokens.push({
                type: TokenType.Whitespace,
                value: sql.substring(start, i),
                start,
                end: i
            });
            continue;
        }

        // Dot
        if (ch === '.') {
            i++;
            tokens.push({ type: TokenType.Dot, value: '.', start, end: i });
            continue;
        }

        // Comma
        if (ch === ',') {
            i++;
            tokens.push({ type: TokenType.Comma, value: ',', start, end: i });
            continue;
        }

        // Star
        if (ch === '*') {
            i++;
            tokens.push({ type: TokenType.Star, value: '*', start, end: i });
            continue;
        }

        // Equals
        if (ch === '=') {
            i++;
            tokens.push({ type: TokenType.Equals, value: '=', start, end: i });
            continue;
        }

        // Parentheses
        if (ch === '(') {
            i++;
            tokens.push({ type: TokenType.OpenParen, value: '(', start, end: i });
            continue;
        }
        if (ch === ')') {
            i++;
            tokens.push({ type: TokenType.CloseParen, value: ')', start, end: i });
            continue;
        }

        // Operators (<>, !=, <=, >=, <, >)
        if (ch === '<' || ch === '>' || ch === '!') {
            let op = ch;
            i++;
            if (i < len && (sql[i] === '=' || sql[i] === '>')) {
                op += sql[i];
                i++;
            }
            tokens.push({ type: TokenType.Operator, value: op, start, end: i });
            continue;
        }

        // Quoted Identifiers (backticks `` or double quotes "")
        if (ch === '`' || ch === '"') {
            const quote = ch;
            i++;
            while (i < len && sql[i] !== quote) {
                if (sql[i] === '\\' && i + 1 < len) i++;
                i++;
            }
            if (i < len) i++; // skip closing quote
            const val = sql.substring(start + 1, i - (sql[i - 1] === quote ? 1 : 0));
            tokens.push({
                type: TokenType.Identifier,
                value: val,
                start,
                end: i
            });
            continue;
        }

        // String Literals ('...')
        if (ch === '\'') {
            i++;
            while (i < len && sql[i] !== '\'') {
                if (sql[i] === '\\' && i + 1 < len) i++;
                i++;
            }
            if (i < len) i++; // skip closing quote
            tokens.push({
                type: TokenType.String,
                value: sql.substring(start, i),
                start,
                end: i
            });
            continue;
        }

        // Numbers
        if (isDigit(ch)) {
            while (i < len && (isDigit(sql[i]) || sql[i] === '.')) {
                i++;
            }
            tokens.push({
                type: TokenType.Number,
                value: sql.substring(start, i),
                start,
                end: i
            });
            continue;
        }

        // Identifiers or Keywords
        if (isAlpha(ch)) {
            while (i < len && isAlphaNum(sql[i])) {
                i++;
            }
            const val = sql.substring(start, i);
            const upperVal = val.toUpperCase();
            if (KEYWORDS.has(upperVal)) {
                tokens.push({
                    type: TokenType.Keyword,
                    value: upperVal,
                    start,
                    end: i
                });
            } else {
                tokens.push({
                    type: TokenType.Identifier,
                    value: val,
                    start,
                    end: i
                });
            }
            continue;
        }

        // Fallback for unknown character
        i++;
        tokens.push({
            type: TokenType.Unknown,
            value: ch,
            start,
            end: i
        });
    }

    tokens.push({
        type: TokenType.EOF,
        value: '',
        start: len,
        end: len
    });

    return tokens;
}
