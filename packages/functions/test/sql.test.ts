import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '@devtoolora/functions/errors';
import { formatSql, SQL_DIALECTS } from '@devtoolora/functions/format';
import type { SqlDialect } from '@devtoolora/functions/format';

describe('SQL formatting', () => {
  it('formats clauses and columns without splitting compound joins', async () => {
    assert.equal(
      await formatSql('select id,name from users where active=1;'),
      'SELECT\n  id,\n  name\nFROM\n  users\nWHERE\n  active = 1;',
    );

    assert.match(
      await formatSql('select u.id from users u left join orders o on u.id=o.user_id;'),
      /\n  LEFT JOIN orders o ON/,
    );
  });

  it('preserves string whitespace, escaped quotes and line-comment boundaries', async () => {
    const query =
      "select 'from users,  where id' as note, 'it''s  fine' as message -- from orders,  where active\nfrom users /* order by,  untouched */ where id=1;";
    const formatted = await formatSql(query);

    for (const literal of [
      "'from users,  where id'",
      "'it''s  fine'",
      '-- from orders,  where active',
      '/* order by,  untouched */',
    ]) {
      assert.ok(formatted.includes(literal), literal);
    }

    assert.match(formatted, /-- from orders,  where active\r?\nFROM/);

    assert.ok(
      (await formatSql("select 'from\n  users\t, where' as note;")).includes(
        "'from\n  users\t, where'",
      ),
    );

    assert.equal(await formatSql(formatted), formatted);
  });

  it('uses each dialect to preserve its quoting and placeholders without substitution', async () => {
    const queries: Record<SqlDialect, { protectedText: string[]; text: string }> = {
      bigquery: {
        protectedText: ['@id', '`project.dataset.users`', "'from,  where'"],
        text: "select @id, 'from,  where' from `project.dataset.users`;",
      },
      mysql: {
        protectedText: ['`from`', '`order`', '?', "'from,  where'"],
        text: "select `from`, ? as id from `order` where note = 'from,  where';",
      },
      plsql: {
        protectedText: [':id', "'from,  where'"],
        text: "select :id, 'from,  where' from dual;",
      },
      postgresql: {
        protectedText: ['$1', '$$from  users$$', '"from"'],
        text: 'select $1::text as message, $$from  users$$ as note, "from" from users;',
      },
      sql: {
        protectedText: ['"from"', "'from,  where'"],
        text: 'select "from", \'from,  where\' from users;',
      },
      sqlite: {
        protectedText: ['[from]', '[order]', '?1'],
        text: 'select [from], ?1 from [order];',
      },
      transactsql: {
        protectedText: ['[from]', '[order]', '@id'],
        text: 'select [from], @id from [order];',
      },
    };

    for (const dialect of SQL_DIALECTS) {
      const { protectedText, text } = queries[dialect];
      const formatted = await formatSql(text, { dialect });

      for (const literal of protectedText)
        assert.ok(formatted.includes(literal), `${dialect}: ${literal}`);
      assert.equal(await formatSql(formatted, { dialect }), formatted, dialect);
    }
  });

  it('changes indentation and keyword case without renaming identifiers or literals', async () => {
    const query = "Select UserName, 'SELECT  from' As note From UserData;";
    const lowercase = await formatSql(query, { indentation: 4, keywordCase: 'lower' });

    assert.equal(
      lowercase,
      "select\n    UserName,\n    'SELECT  from' as note\nfrom\n    UserData;",
    );

    const preserved = await formatSql(query, { indentation: 'tab', keywordCase: 'preserve' });

    assert.equal(preserved, "Select\n\tUserName,\n\t'SELECT  from' As note\nFrom\n\tUserData;");
  });

  it('handles CTEs, nested queries and multiple statements idempotently', async () => {
    const query =
      'with recent as (select id from users where active=1) select id from recent where id in (select user_id from orders); select count(*) from users;';
    const formatted = await formatSql(query, { dialect: 'postgresql' });

    assert.match(formatted, /^WITH\n  recent AS \(/);
    assert.match(formatted, /;\n\nSELECT/);
    assert.match(formatted, /\n\s+SELECT\n\s+user_id/);
    assert.equal(await formatSql(formatted, { dialect: 'postgresql' }), formatted);
  });

  it('reports required input and unsupported or malformed syntax with stable error codes', async () => {
    await assert.rejects(
      () => formatSql(' \n '),
      (error: unknown) => error instanceof FunctionError && error.code === 'REQUIRED_INPUT',
    );

    for (const query of [
      "select 'unterminated",
      'select (id from users;',
      'select [from] from [order];',
    ]) {
      await assert.rejects(
        () => formatSql(query),
        (error: unknown) =>
          error instanceof FunctionError &&
          error.code === 'INVALID_SQL' &&
          /selected dialect/.test(error.message),
      );
    }
  });

  it('reports a parse error as one short line with the source line, column and unexpected token', async () => {
    const cases: Array<[string, RegExp]> = [
      [
        'select from where (;',
        /^Could not format SQL \(sql\) at line 1, column 20: unexpected ";"\. Check the selected dialect/,
      ],
      [
        'select 1;\n\n  select (id\nfrom users;',
        /^Could not format SQL \(sql\) at line 4, column 11: unexpected ";"\./,
      ],
      [
        "select 'unterminated",
        /^Could not format SQL \(sql\) at line 1, column 8: unexpected "'unterminated"\./,
      ],
      ['select [from] from [order];', /at line 1, column 8: unexpected "\[from\]"\./],
      ['select (', /at line 1, column 9: unexpected end of input\./],
    ];

    for (const [query, expected] of cases) {
      await assert.rejects(
        () => formatSql(query),
        (error: unknown) =>
          error instanceof FunctionError &&
          error.code === 'INVALID_SQL' &&
          expected.test(error.message) &&
          !error.message.includes('\n') &&
          error.message.length < 200,
      );
    }

    assert.equal(await formatSql('\ufeffselect 1;'), 'SELECT\n  1;');
  });

  it('keeps MySQL DELIMITER blocks and procedure bodies intact and rejects DELIMITER in other dialects', async () => {
    const script =
      "DELIMITER //\nCREATE PROCEDURE p(IN a INT)\nBEGIN\n  SELECT 'a//b', `c//d`; -- note //\n  SELECT 2;\nEND //\nCREATE PROCEDURE q() BEGIN SELECT 3; END//\nDELIMITER ;\nCALL p(1);";
    const formatted = await formatSql(script, { dialect: 'mysql' });

    assert.equal(
      formatted,
      [
        'DELIMITER //',
        'CREATE PROCEDURE p (IN a INT) BEGIN',
        'SELECT',
        "  'a//b',",
        '  `c//d`;',
        '',
        '-- note //',
        'SELECT',
        '  2;',
        '',
        'END //',
        '',
        'CREATE PROCEDURE q () BEGIN',
        'SELECT',
        '  3;',
        '',
        'END //',
        '',
        'DELIMITER ;',
        'CALL p (1);',
      ].join('\n'),
    );

    assert.doesNotMatch(formatted, /\/ \//);
    assert.equal(await formatSql(formatted, { dialect: 'mysql' }), formatted);

    assert.match(
      await formatSql('delimiter $$\nselect 1 -- trailing\n$$\ndelimiter ;', {
        dialect: 'mysql',
        keywordCase: 'lower',
      }),
      /^delimiter \$\$\nselect\n  1 -- trailing\n\$\$\n\ndelimiter ;$/,
    );

    assert.equal(
      await formatSql('select delimiter from t;\nselect a,\ndelimiter d\nfrom t;', {
        dialect: 'mysql',
      }),
      'SELECT\n  delimiter\nFROM\n  t;\n\nSELECT\n  a,\n  delimiter d\nFROM\n  t;',
    );

    await assert.rejects(
      () =>
        formatSql('DELIMITER //\nCREATE PROCEDURE p() BEGIN SELECT (1; END //\nDELIMITER ;', {
          dialect: 'mysql',
        }),
      /at line 2, column 37: unexpected ";"/,
    );

    for (const dialect of SQL_DIALECTS.filter((entry) => entry !== 'mysql')) {
      await assert.rejects(
        () => formatSql(`select 1;\n${script}`, { dialect }),
        (error: unknown) =>
          error instanceof FunctionError &&
          error.code === 'UNSUPPORTED_SQL_DELIMITER' &&
          /DELIMITER at line 2 is a MySQL client command/.test(error.message),
      );
    }
  });

  it('formats a larger statement without altering its protected values', async () => {
    const query = `select ${Array.from({ length: 1000 }, (_, index) => `'from,  where ${index}' as column_${index}`).join(',')} from users;`;
    const formatted = await formatSql(query);

    assert.ok(formatted.includes("'from,  where 0'"));
    assert.ok(formatted.includes("'from,  where 999'"));
    assert.equal(await formatSql(formatted), formatted);
  });
});
