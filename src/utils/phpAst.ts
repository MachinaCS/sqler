import { PhpSqlString } from '../types';

const SQL_KEYWORDS = [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'REPLACE',
    'CREATE',
    'ALTER',
    'DROP',
    'TRUNCATE',
    'WITH'
];

/**
 * Extracts SQL strings from a PHP document.
 * Checks for string literals (double quotes, single quotes, heredoc/nowdoc)
 * whose content starts with an allowed SQL keyword (case-insensitive).
 */
export function extractPhpSqlStrings(text: string): PhpSqlString[] {
    const results: PhpSqlString[] = [];
    const len = text.length;
    let i = 0;
    let inPhp = false;

    while (i < len) {
        // Simple PHP tag check
        if (!inPhp) {
            if (text.startsWith('<?php', i) || text.startsWith('<?=', i) || text.startsWith('<?', i)) {
                inPhp = true;
                if (text.startsWith('<?php', i)) { i += 5; continue; }
                if (text.startsWith('<?=', i)) { i += 3; continue; }
                if (text.startsWith('<?', i)) { i += 2; continue; }
            }
            i++;
            continue;
        }

        // Check for end php tag
        if (text.startsWith('?>', i)) {
            inPhp = false;
            i += 2;
            continue;
        }

        // Ignore single-line comments // or #
        if (text.startsWith('//', i) || text[i] === '#') {
            while (i < len && text[i] !== '\n' && text[i] !== '\r') {
                i++;
            }
            continue;
        }

        // Ignore multi-line comments /* */
        if (text.startsWith('/*', i)) {
            i += 2;
            while (i < len && !text.startsWith('*/', i)) {
                i++;
            }
            i += 2;
            continue;
        }

        // Check for double quote string "..."
        if (text[i] === '"') {
            const startQuote = i;
            i++;
            const contentStart = i;
            let escaped = false;
            while (i < len) {
                if (escaped) {
                    escaped = false;
                } else if (text[i] === '\\') {
                    escaped = true;
                } else if (text[i] === '"') {
                    break;
                }
                i++;
            }
            const contentEnd = i;
            const sqlText = text.substring(contentStart, contentEnd);
            checkAndAddSqlString(sqlText, contentStart, contentEnd, results);
            i++; // skip closing quote
            continue;
        }

        // Check for single quote string '...'
        if (text[i] === '\'') {
            const startQuote = i;
            i++;
            const contentStart = i;
            let escaped = false;
            while (i < len) {
                if (escaped) {
                    escaped = false;
                } else if (text[i] === '\\') {
                    escaped = true;
                } else if (text[i] === '\'') {
                    break;
                }
                i++;
            }
            const contentEnd = i;
            const sqlText = text.substring(contentStart, contentEnd);
            checkAndAddSqlString(sqlText, contentStart, contentEnd, results);
            i++; // skip closing quote
            continue;
        }

        // Check for Heredoc / Nowdoc <<<
        if (text.startsWith('<<<', i)) {
            i += 3;
            // skip optional quotes around identifier e.g. <<<'SQL' or <<<"SQL" or <<<SQL
            while (i < len && (text[i] === ' ' || text[i] === '\t')) { i++; }
            let quoteChar = '';
            if (text[i] === '\'' || text[i] === '"') {
                quoteChar = text[i];
                i++;
            }
            const idStart = i;
            while (i < len && /[a-zA-Z0-9_]/.test(text[i])) {
                i++;
            }
            const identifier = text.substring(idStart, i);
            if (quoteChar && text[i] === quoteChar) {
                i++;
            }
            // skip to newline
            while (i < len && text[i] !== '\n' && text[i] !== '\r') {
                i++;
            }
            if (text[i] === '\r') i++;
            if (text[i] === '\n') i++;

            const contentStart = i;
            // Find ending identifier at start of line (allowing indentation in PHP 7.3+)
            let contentEnd = contentStart;
            while (i < len) {
                const lineStart = i;
                // skip leading whitespace on line
                while (i < len && (text[i] === ' ' || text[i] === '\t')) { i++; }
                if (text.substring(i, i + identifier.length) === identifier &&
                    (i + identifier.length === len || !/[a-zA-Z0-9_]/.test(text[i + identifier.length]))) {
                    contentEnd = lineStart;
                    // move past closing identifier
                    i += identifier.length;
                    break;
                }
                // find end of line
                while (i < len && text[i] !== '\n' && text[i] !== '\r') {
                    i++;
                }
                if (text[i] === '\r') i++;
                if (text[i] === '\n') i++;
            }
            const sqlText = text.substring(contentStart, contentEnd);
            checkAndAddSqlString(sqlText, contentStart, contentEnd, results);
            continue;
        }

        i++;
    }

    return results;
}

function checkAndAddSqlString(
    sqlText: string,
    startOffset: number,
    endOffset: number,
    results: PhpSqlString[]
) {
    const trimmed = sqlText.trimStart();
    if (!trimmed) return;

    // Find the first word
    let firstWord = '';
    let j = 0;
    while (j < trimmed.length && !/\s/.test(trimmed[j])) {
        firstWord += trimmed[j];
        j++;
    }

    const upperFirstWord = firstWord.toUpperCase();
    if (SQL_KEYWORDS.includes(upperFirstWord)) {
        results.push({
            sqlText,
            startOffset,
            endOffset
        });
    }
}

/**
 * Gets the SQL string at a specific document offset if the offset is inside it.
 */
export function getPhpSqlStringAtOffset(text: string, offset: number): PhpSqlString | null {
    const strings = extractPhpSqlStrings(text);
    for (const str of strings) {
        if (offset >= str.startOffset && offset <= str.endOffset) {
            return str;
        }
    }
    return null;
}
