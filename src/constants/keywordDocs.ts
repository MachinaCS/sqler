export interface KeywordDoc {
    title: string;
    description: string;
    example: string;
}

export const KEYWORDS_DOCS: Record<string, KeywordDoc> = {
    // Basic Statements & Clauses
    'SELECT': {
        title: 'SELECT Clause',
        description: 'Retrieves data rows from one or more tables or expressions.',
        example: 'SELECT id, first_name FROM users'
    },
    'FROM': {
        title: 'FROM Clause',
        description: 'Specifies the source table(s) or view(s) from which to retrieve data.',
        example: 'FROM users u'
    },
    'WHERE': {
        title: 'WHERE Clause',
        description: 'Filters rows returned by query based on logical search conditions.',
        example: 'WHERE status = 1 AND country_id = 48'
    },
    'JOIN': {
        title: 'JOIN Clause',
        description: 'Combines records from two tables based on a related column equality condition.',
        example: 'INNER JOIN countries c ON c.id = u.country_id'
    },
    'LEFT': {
        title: 'LEFT JOIN Clause',
        description: 'Returns all records from the left table and matched records from the right table.',
        example: 'LEFT JOIN user_types ut ON ut.id = u.type_id'
    },
    'RIGHT': {
        title: 'RIGHT JOIN Clause',
        description: 'Returns all records from the right table and matched records from the left table.',
        example: 'RIGHT JOIN events e ON e.id = u.event_id'
    },
    'INNER': {
        title: 'INNER JOIN Clause',
        description: 'Returns records that have matching values in both tables.',
        example: 'INNER JOIN countries c ON c.id = u.country_id'
    },
    'CROSS': {
        title: 'CROSS JOIN Clause',
        description: 'Produces a Cartesian product of two joined tables.',
        example: 'CROSS JOIN categories c'
    },
    'ON': {
        title: 'ON Clause',
        description: 'Specifies the join equality condition connecting two tables.',
        example: 'ON c.id = u.country_id'
    },
    'GROUP': {
        title: 'GROUP BY Clause',
        description: 'Groups rows sharing a property into summary rows (e.g. SUM, COUNT).',
        example: 'GROUP BY u.country_id, u.type_id'
    },
    'HAVING': {
        title: 'HAVING Clause',
        description: 'Filters groups created by GROUP BY based on aggregate values.',
        example: 'HAVING SUM(o.total_amount) > 500'
    },
    'ORDER': {
        title: 'ORDER BY Clause',
        description: 'Sorts query result set by one or more columns ascending (ASC) or descending (DESC).',
        example: 'ORDER BY u.last_name ASC, u.first_name DESC'
    },
    'LIMIT': {
        title: 'LIMIT Clause',
        description: 'Constrains the number of rows returned by query result set.',
        example: 'LIMIT 10 OFFSET 0'
    },
    'UPDATE': {
        title: 'UPDATE Statement',
        description: 'Modifies existing record values in a table.',
        example: 'UPDATE users SET status = 1 WHERE id = 10'
    },
    'INSERT': {
        title: 'INSERT INTO Statement',
        description: 'Inserts new rows of data into a table.',
        example: 'INSERT INTO users (first_name, email) VALUES (\'John\', \'john@example.com\')'
    },
    'DELETE': {
        title: 'DELETE Statement',
        description: 'Removes existing rows of data from a table.',
        example: 'DELETE FROM users WHERE status = 0'
    },
    'WITH': {
        title: 'WITH Clause (CTE)',
        description: 'Specifies a temporary named result set (Common Table Expression).',
        example: 'WITH user_summary AS (SELECT * FROM users) SELECT * FROM user_summary'
    },
    'RECURSIVE': {
        title: 'RECURSIVE Keyword',
        description: 'Enables recursive Common Table Expression (CTE) execution for hierarchical data.',
        example: 'WITH RECURSIVE category_tree AS (...) SELECT * FROM category_tree'
    },
    'CREATE': {
        title: 'CREATE Statement',
        description: 'Creates a new database object (table, view, index, procedure, trigger).',
        example: 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100))'
    },
    'ALTER': {
        title: 'ALTER Statement',
        description: 'Modifies the structure of an existing database object.',
        example: 'ALTER TABLE users ADD COLUMN phone VARCHAR(20)'
    },
    'DROP': {
        title: 'DROP Statement',
        description: 'Permanently deletes a database object (table, view, index, procedure).',
        example: 'DROP TABLE IF EXISTS old_users'
    },
    'TRUNCATE': {
        title: 'TRUNCATE Statement',
        description: 'Removes all rows from a table without logging individual row deletions.',
        example: 'TRUNCATE TABLE logs'
    },
    'REPLACE': {
        title: 'REPLACE Statement',
        description: 'Inserts new row or deletes old row matching primary key and inserts new row.',
        example: 'REPLACE INTO settings (key_name, val) VALUES (\'site_name\', \'My App\')'
    },
    'UNION': {
        title: 'UNION Operator',
        description: 'Combines result sets of two or more SELECT queries into a single result set.',
        example: 'SELECT email FROM users UNION SELECT email FROM customers'
    },
    'ALL': {
        title: 'ALL Keyword',
        description: 'Includes duplicate rows in UNION operations or compares value against all subquery results.',
        example: 'SELECT email FROM users UNION ALL SELECT email FROM customers'
    },
    'OVER': {
        title: 'OVER Clause',
        description: 'Specifies window partitioning and ordering for window functions.',
        example: 'ROW_NUMBER() OVER(PARTITION BY department_id ORDER BY salary DESC)'
    },
    'PARTITION': {
        title: 'PARTITION BY Clause',
        description: 'Divides query result set into partitions for window function processing.',
        example: 'SUM(amount) OVER(PARTITION BY category_id)'
    },
    'RETURNING': {
        title: 'RETURNING Clause (MariaDB)',
        description: 'Returns inserted, updated, or deleted rows directly from statement execution.',
        example: 'INSERT INTO users (first_name) VALUES (\'John\') RETURNING id'
    },
    'MATCH': {
        title: 'MATCH...AGAINST (Full-Text Search)',
        description: 'Performs full-text search against text columns with full-text index.',
        example: 'WHERE MATCH(title, body) AGAINST(\'database search\')'
    },
    'AGAINST': {
        title: 'AGAINST Keyword',
        description: 'Specifies search string pattern for full-text MATCH query.',
        example: 'AGAINST(\'search term\' IN BOOLEAN MODE)'
    },

    // Functions Documentation
    'COUNT': {
        title: 'COUNT() Function',
        description: 'Returns the total count of rows or non-NULL values matching search criteria.',
        example: 'SELECT COUNT(*) FROM users WHERE status = 1'
    },
    'SUM': {
        title: 'SUM() Function',
        description: 'Calculates total sum of numeric column values across grouped rows.',
        example: 'SELECT SUM(total_amount) FROM orders'
    },
    'AVG': {
        title: 'AVG() Function',
        description: 'Calculates arithmetic average value of numeric column.',
        example: 'SELECT AVG(price) FROM products'
    },
    'MIN': {
        title: 'MIN() Function',
        description: 'Returns minimum value of column across dataset.',
        example: 'SELECT MIN(age) FROM users'
    },
    'MAX': {
        title: 'MAX() Function',
        description: 'Returns maximum value of column across dataset.',
        example: 'SELECT MAX(salary) FROM employees'
    },
    'GROUP_CONCAT': {
        title: 'GROUP_CONCAT() Function',
        description: 'Concatenates non-NULL column values from grouped rows into a single string.',
        example: 'SELECT GROUP_CONCAT(name SEPARATOR \', \') FROM tags'
    },
    'ROW_NUMBER': {
        title: 'ROW_NUMBER() Window Function',
        description: 'Assigns unique sequential integer to each row within partition.',
        example: 'SELECT ROW_NUMBER() OVER(ORDER BY created_at DESC) FROM logs'
    },
    'RANK': {
        title: 'RANK() Window Function',
        description: 'Assigns rank value to each row within partition, producing rank gaps for ties.',
        example: 'SELECT RANK() OVER(ORDER BY score DESC) FROM leaderboard'
    },
    'DENSE_RANK': {
        title: 'DENSE_RANK() Window Function',
        description: 'Assigns rank value to each row within partition without rank gaps for ties.',
        example: 'SELECT DENSE_RANK() OVER(ORDER BY score DESC) FROM leaderboard'
    },
    'LAG': {
        title: 'LAG() Window Function',
        description: 'Accesses data from a previous row at a specified offset without self-join.',
        example: 'SELECT LAG(price, 1) OVER(ORDER BY created_at) FROM price_history'
    },
    'LEAD': {
        title: 'LEAD() Window Function',
        description: 'Accesses data from a subsequent row at a specified offset without self-join.',
        example: 'SELECT LEAD(price, 1) OVER(ORDER BY created_at) FROM price_history'
    },
    'CASE': {
        title: 'CASE Expression',
        description: 'Evaluates conditional expressions and returns a matching value.',
        example: 'CASE WHEN status = 1 THEN \'Active\' ELSE \'Inactive\' END'
    },
    'COALESCE': {
        title: 'COALESCE() Function',
        description: 'Returns first non-NULL argument from provided parameter list.',
        example: 'SELECT COALESCE(phone, mobile, \'No Contact\') FROM users'
    },
    'IFNULL': {
        title: 'IFNULL() Function',
        description: 'Returns second argument if first argument evaluates to NULL.',
        example: 'SELECT IFNULL(discount, 0) FROM orders'
    },
    'CONCAT': {
        title: 'CONCAT() Function',
        description: 'Concatenates two or more string arguments into a single string.',
        example: 'SELECT CONCAT(first_name, \' \', last_name) FROM users'
    },
    'JSON_EXTRACT': {
        title: 'JSON_EXTRACT() Function',
        description: 'Extracts data from JSON document at path expression.',
        example: 'SELECT JSON_EXTRACT(settings, \'$.theme\') FROM user_configs'
    },
    'JSON_TABLE': {
        title: 'JSON_TABLE() Function',
        description: 'Converts JSON document data into tabular relational format.',
        example: 'SELECT * FROM JSON_TABLE(json_col, \'$[*]\' COLUMNS(id INT PATH \'$.id\')) AS jt'
    },
    'NOW': {
        title: 'NOW() Function',
        description: 'Returns current date and time as YYYY-MM-DD HH:MM:SS format.',
        example: 'SELECT NOW()'
    },
    'DATE_ADD': {
        title: 'DATE_ADD() Function',
        description: 'Adds specified time interval to date value.',
        example: 'SELECT DATE_ADD(NOW(), INTERVAL 7 DAY)'
    },
    'TIMESTAMPDIFF': {
        title: 'TIMESTAMPDIFF() Function',
        description: 'Returns integer difference between two datetime expressions in requested units.',
        example: 'SELECT TIMESTAMPDIFF(DAY, created_at, NOW()) FROM users'
    },
    'ST_DISTANCE': {
        title: 'ST_Distance() GIS Function',
        description: 'Calculates shortest distance between two geometry shapes.',
        example: 'SELECT ST_Distance(point1, point2) FROM locations'
    },
    'MD5': {
        title: 'MD5() Cryptographic Function',
        description: 'Calculates 128-bit MD5 hash checksum string.',
        example: 'SELECT MD5(\'my_password\')'
    },
    'SHA2': {
        title: 'SHA2() Cryptographic Function',
        description: 'Calculates SHA-2 (SHA-224, SHA-256, SHA-384, SHA-512) hash checksum string.',
        example: 'SELECT SHA2(\'my_password\', 256)'
    },
    'UUID': {
        title: 'UUID() Function',
        description: 'Generates Universal Unique Identifier 128-bit string.',
        example: 'SELECT UUID()'
    }
};
