# Change Log

All notable changes to the **SQLer** extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

---

## [0.0.14] - 2026-07-30

### Added - Initial Pre-release
- **Multi-Server & Multi-Database Connections**: Native support for array configuration (`sqler.connections`) in VS Code `settings.json`.
- **Intelligent Autocomplete & Priority Sorting**:
  - Columns & Aliases appear at the top (`0_`), followed by Tables (`1_`), Built-in Functions (`2_`), and Keywords (`3_`).
  - Function Snippets with automatic placeholders (`AVG()`, `COUNT()`, `SUM()`, `GROUP_CONCAT()`, `JSON_TABLE()`, `ROW_NUMBER() OVER()`, etc.).
  - Context-aware keyword suggestions (`AS`, `,`, `FROM` after function parentheses).
  - Suppression of column suggestions in `WHERE` after column identifier, offering strictly comparison operators (`=`, `<>`, `!=`, `IN`, `BETWEEN`, `LIKE`, `IS NULL`, `IS NOT NULL`).
  - Automated `ON` clause foreign key join condition suggestions.
- **Smart Quick Fixes 💡**: Levenshtein fuzzy string distance matching proposing one-click fixes for misspelled table or column names (`Ctrl+.`).
- **SQL Injection Security Linter**: Real-time warning diagnostics flagging unsafe variable concatenation in SQL strings (`"WHERE id = " . $id`).
- **Tiered Hover Documentation**:
  - Compact TypeScript/PHP style codeblock signature header on top.
  - Full schema details (Database, Nullable, Primary Key, Foreign Key References, Default Value, Comment) below separator line.
  - Comprehensive English documentation and usage examples for all SQL keywords and built-in functions.
- **Go To Definition (`F12`)**: Press `F12` or `Ctrl+Click` on any table name or alias to inspect table schema definitions.
- **SQL Formatter (`SQLer: Format SQL Query`)**: Formats SQL strings inside PHP code with proper indentation and line breaks.
- **Live Query Execution (`▶ Run SQL Query`)**: CodeLens button executing SQL queries against configured database connection with interactive Webview HTML table results.