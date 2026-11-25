import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'SQL is the language used to query and modify relational databases; a formatter makes its clauses, expressions and nested queries easier to read.\n\nThis tool changes layout and optionally keyword case without connecting to a database or executing the query.',
      title: 'What is SQL formatting?',
    },
    {
      content: [
        'Make a query from a log, ORM or database console readable before reviewing it.',
        'Apply consistent indentation and keyword case to SQL in documentation, tests or code reviews.',
        'Inspect joins, common table expressions, subqueries and multiple statements without replacing parameter placeholders.',
      ],
      title: 'When to use SQL Formatter',
    },
  ],
  examples: [
    "SELECT 'from users,  where id' AS note; → the quoted text stays exactly 'from users,  where id'.",
    'PostgreSQL: select $1::text as message, $$from  users$$ as note; → keeps $1 and the dollar-quoted literal.',
    'SQL Server: select [from], @id from [order] where [id]=@id; → preserves bracket-quoted identifiers and @id.',
    '2 spaces + UPPERCASE: select id,name from users; → SELECT, indented columns, FROM and an indented table name.',
    'MySQL: DELIMITER // … END // … DELIMITER ; → both DELIMITER lines and the // after END stay; the semicolons inside BEGIN … END stay in the procedure.',
    'select (id from users; → Could not format SQL (sql) at line 1, column 22: unexpected ";".',
  ],
  faq: [
    {
      answer:
        'No. It only changes layout and keyword case; the query is never sent to a database or executed. A query that formats cleanly can still contain errors your database will reject.',
      question: 'Does SQL Formatter run or validate my query?',
    },
    {
      answer:
        'Standard SQL recognizes only common syntax, so dialect features such as PostgreSQL $1 placeholders, SQL Server [bracketed] names and @variables, or :name parameters cause a parse error. Choose your database’s dialect and run again.',
      question: 'Why does formatting fail with Standard SQL when my query runs fine?',
    },
    {
      answer:
        'Yes. Paste several statements separated by semicolons; each one is formatted on its own, with a blank line between statements.',
      question: 'Can I format several SQL statements at once?',
    },
    {
      answer:
        'Yes, with the MySQL dialect. DELIMITER lines are kept and each statement ending in the custom delimiter, such as //, is formatted on its own, so the semicolons inside BEGIN … END stay in the procedure. The body is not indented as a block, and other dialects reject DELIMITER with an error.',
      question: 'Can it format stored procedures with DELIMITER?',
    },
    {
      answer:
        'No. Formatting runs locally in your browser, editor or desktop app, and the query text is never uploaded or executed.',
      question: 'Is my SQL sent to a server?',
    },
  ],
  help: 'Choose the SQL dialect matching your database. Standard SQL rejects dialect syntax such as $1, :name, @id or [bracketed] names.\n\nSelect 2 spaces, 4 spaces or Tabs for Indentation, and UPPERCASE, lowercase or Preserve for Keyword case.\n\nPaste one or more statements separated by semicolons, or apply a sample, then select Run SQL Formatter. String quotes, comments and parameter placeholders stay as written.\n\nReview the result, then copy it or save formatted.sql. If formatting fails, check the selected dialect and the syntax at the reported line and column.',
  notes: [
    'String contents and quoted identifiers are preserved; comments stay comments, including the newline ending a line comment, although comment indentation may change.',
    'Keyword case applies only to recognized SQL keywords; identifiers, string values and parameter placeholders are not renamed or substituted.',
    'Successful formatting is not database syntax validation, query optimization or a security check; the tool never runs a query.',
    'Copy keeps the complete formatted text; Save or Download exports the same UTF-8 content as formatted.sql.',
    'The supported dialects are Standard SQL, PostgreSQL, MySQL, SQLite, SQL Server T-SQL, BigQuery and Oracle SQL; choose a specific dialect for its quoting and placeholders.',
    'With MySQL, DELIMITER lines are kept and each statement ending in a custom delimiter such as // is formatted on its own, so a procedure body keeps its semicolons. Other dialects reject DELIMITER. BEGIN … END bodies are not indented as blocks, and dialect-specific extensions may also require manual formatting.',
  ],
};
