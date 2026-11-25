import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A connection string packs everything a client needs to reach a database into one URL: scheme, optional user and password, one or more hosts with ports, a database name and query options. PostgreSQL, MySQL, MongoDB and Redis all use this shape, with small differences in what the path and options mean.',
        'The parser reads the scheme, splits the authority at its last @, percent-decodes the credentials and lists every host with its port and whether the default port applies. It reports the options in order and whether TLS is on, optional or off, then adds findings such as credentials in the URL or a connection that can be unencrypted.',
        'The builder does the reverse. Pick a dialect, fill in the fields and it prints the URI with percent-encoded credentials, the JDBC form for PostgreSQL and MySQL, and a ready .env line.',
      ],
      title: 'What is a connection string?',
    },
    {
      content: [
        'Check which host, port and database a pasted DATABASE_URL really points to, and whether TLS is requested.',
        'Find out why a password with @, / or : breaks a URL: it must be percent-encoded, and the builder does that for you.',
        'Produce the URI, JDBC and .env variants of one connection without hand-editing each. Use URL Parse for generic URLs, Secret Redactor before sharing a real string and Dotenv Formatter to tidy the result.',
      ],
      title: 'When to use Connection String Builder & Parser',
    },
  ],
  examples: [
    'postgres://app:s3cr%40t@db.example.com:5433/appdb?sslmode=require → PostgreSQL, port 5433, TLS on, password s3cr@t.',
    'jdbc:postgresql://localhost/app → default port 5432, TLS optional, a medium finding: libpq defaults to prefer, which can fall back to unencrypted.',
    'mongodb://a.example:27017,b.example:27018/app?replicaSet=rs0 → two hosts and the replicaSet option.',
    'rediss://:pw@cache.example:6380/2 → Redis database 2 over TLS with a password and no user.',
    'mysql://u@h/db?ssl-mode=REQUIRED → TLS on, no password.',
    'Build PostgreSQL with user app, password s3cr@t and TLS → postgresql://app:s3cr%40t@db.example.com:5432/appdb?sslmode=require plus JDBC and DATABASE_URL lines.',
  ],
  faq: [
    {
      answer:
        'Because @, / and : have a meaning in a URL. A raw @ in the password makes the host ambiguous. Percent-encode the password (@ becomes %40, / becomes %2F) or let the builder do it.',
      question: 'Why must special characters in the password be percent-encoded?',
    },
    {
      answer:
        'rediss and mongodb+srv use TLS unless tls or ssl is false. TLS is on for sslmode require, verify-ca or verify-full, for sslMode or ssl-mode REQUIRED, VERIFY_CA or VERIFY_IDENTITY, or with no mode when ssl, useSSL or tls is true. disable and DISABLED are off. prefer, allow, PREFERRED and a PostgreSQL or MySQL string with no TLS option are optional: those connections can fall back to unencrypted.',
      question: 'How is TLS detected?',
    },
    {
      answer:
        'No. The URI, JDBC and .env lines are shown with the password exactly as you entered it, percent-encoded where needed. Everything runs locally, but treat the output as a secret.',
      question: 'Does it hide the password?',
    },
    {
      answer:
        'A mongodb+srv URL resolves its hosts and port through DNS SRV records, so a port in the URL is a mistake. Use mongodb:// when you need explicit ports.',
      question: 'Why does mongodb+srv reject a port?',
    },
  ],
  help: 'Choose Parse to analyze a pasted connection string or Build to write one from fields.\n\nIn Parse mode paste a postgres, postgresql, jdbc:postgresql, mysql, jdbc:mysql, mongodb, mongodb+srv, redis or rediss URL.\n\nIn Build mode pick the dialect and enter host, optional port, credentials, database and options, one key=value per line.\n\nCopy or download the result. Passwords are not redacted.',
  notes: [
    'Input is at most 8,192 characters. Passwords are shown exactly as pasted. Build mode rejects a host containing / ? # @ , or spaces.',
    'Parsing splits the authority at the last @ and the user from the password at the first colon; both are percent-decoded. A raw @ or / before the last @ is rejected.',
    'Default ports are 5432 for PostgreSQL, 3306 for MySQL, 27017 for MongoDB and 6379 for Redis; the report marks each host that uses one.',
    'JDBC strings for PostgreSQL and MySQL may carry user and password as query options; the report reads them as credentials.',
    'The builder always writes the port, appends the TLS option first and your options after it, and uses rediss:// for Redis with TLS. MySQL requires TLS with ssl-mode=REQUIRED in the URI and sslMode=REQUIRED in the JDBC form.',
    'The builder percent-encodes the database name and each option name and value, so enter them unencoded.',
    'The .env line is NAME="uri" with " and \\ escaped; the name is DATABASE_URL, MONGODB_URI or REDIS_URL.',
    'No SQL Server, SQLite, ODBC or LDAP strings, and no connection is opened or tested.',
  ],
};
