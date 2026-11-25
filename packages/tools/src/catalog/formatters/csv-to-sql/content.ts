import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        "CSV to SQL reads the first CSV record as the column list and writes one INSERT ... VALUES statement per batch of data rows. Every value is written as a string literal, so the database converts it to the column type when it stores it, the same way it would for a quoted literal typed by hand.\n\nQuoting follows the chosen dialect. PostgreSQL and SQLite quote names with \"double quotes\", MySQL with `backticks` and SQL Server with [brackets]; the closing quote inside a name is doubled. In values a single quote ' is doubled, MySQL also doubles backslashes, and SQL Server values with non-ASCII characters get the N'...' prefix so they keep their characters.",
      title: 'How CSV becomes INSERT statements',
    },
    {
      content: [
        'Seed a development or test database from a spreadsheet export.',
        'Load a small lookup table without an import wizard.',
        'Turn a CSV attached to a ticket into a reviewable SQL script.',
        'Move a few rows between databases of different vendors.',
      ],
      title: 'When to generate INSERT statements',
    },
  ],
  examples: [
    "id,name / 1,O'Neil / 2, → INSERT INTO \"users\" (\"id\", \"name\") VALUES ('1', 'O''Neil'), ('2', NULL);",
    "MySQL a\\'b → 'a\\\\''b' (backslash and quote both escaped).",
    "SQL Server Zürich → N'Zürich'; Prague → 'Prague'.",
    'Rows per INSERT 1 with 2 rows → 2 INSERT statements.',
  ],
  faq: [
    {
      answer:
        "No. Every value is a quoted string literal, such as '42'. PostgreSQL, MySQL, SQLite and SQL Server convert a string literal to the column type when they insert it, so numeric, date and boolean columns work when the text is in a format the database accepts.",
      question: 'Are numbers written without quotes?',
    },
    {
      answer:
        "With Empty cells as NULL on (the default), an empty cell and a cell missing from a short row become NULL. Off, they become ''. A row with more cells than the header is an error, because those cells have no column.",
      question: 'What happens to empty cells and short rows?',
    },
    {
      answer:
        "Values are escaped for the chosen dialect: ' is doubled everywhere, MySQL also doubles \\, and names are quoted with the dialect's quotes. A value or header with a NUL character is an error, because NUL cannot be written safely. For production data, prefer a parameterized import such as COPY, LOAD DATA or a driver with bound parameters.",
      question: 'Is the output safe from SQL injection?',
    },
    {
      answer:
        'MySQL reads \\ as an escape character inside string literals by default, so the tool doubles it to keep the value exact. If your server runs with the NO_BACKSLASH_ESCAPES SQL mode, use the PostgreSQL or SQLite dialect for values instead, or each backslash is stored twice.',
      question: 'Why are backslashes doubled for MySQL?',
    },
    {
      answer:
        'Each statement lists 1-1,000 rows; the default is 100. SQL Server accepts at most 1,000 rows in one VALUES list. Smaller batches give smaller statements, larger ones fewer round trips.',
      question: 'How do I choose the rows per INSERT?',
    },
  ],
  help: 'Paste CSV with a header row, or pick a sample.\n\nChoose the SQL dialect and enter the table name, such as users or public.users.\n\nSet Rows per INSERT and whether empty cells become NULL.\n\nCopy the SQL or save it as a .sql file.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 characters, 100,000 data rows, 10,000 columns and 1,000,000 cells including the header; 1-1,000 rows per INSERT; at most 20,000,000 characters of SQL output.',
    'All values are string literals; the database converts them to the column types. Prefer a parameterized import (COPY, LOAD DATA or bound parameters) for production data.',
    "Escaping per dialect: ' is doubled everywhere, MySQL also doubles \\, and SQL Server literals with non-ASCII characters use N'...'.",
    'PostgreSQL output assumes standard_conforming_strings is on, the default since PostgreSQL 9.1.',
    'MySQL output assumes a UTF-8 client character set; multibyte character sets such as GBK, SJIS and Big5 break backslash escaping.',
    'SQL Server: a value with a backslash right before a line break is an error, because SQL Server would drop both characters. Run the output as a plain script, not through sqlcmd variable substitution; in sqlcmd and SSMS a line of a multi-line value that starts with GO may split the batch.',
    'The header names the columns. An empty, repeated or NUL-containing header name is an error, and so is a NUL character in a value. The table name must be a name or schema.name of letters, digits, _ and $.',
    'Short rows are padded with NULL, or with empty strings when Empty cells as NULL is off; a row longer than the header is an error.',
    'The separator (comma, semicolon, tab or pipe) is detected from the first 20 records, and a leading byte order mark is ignored. CRLF and LF record endings behave the same.',
  ],
};
