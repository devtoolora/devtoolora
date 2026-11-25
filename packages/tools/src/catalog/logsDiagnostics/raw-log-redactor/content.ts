import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Raw log redaction masks recognizable credential patterns in unstructured text: common fields, authorization/cookie headers, sensitive query parameters, command-line flags, URL credentials, Bearer tokens, JWT-shaped tokens and PEM private key blocks.',
        'It is a heuristic transformation, not a full parser for every log format, and not proof that all secrets were found.',
        'A built-in or additional name matches the whole key or its last part after _, - or ., so github_token, user_password and x-api-key are masked. A name followed by more text, as in tokenizer or password_policy, is a different key and stays.',
        'When unsure where a value ends, it masks more. An unquoted value runs to the next whitespace, and an unterminated quote, bracket or private key block masks everything after it, with a warning in the summary that names the line where it starts.',
        'Additional comma-separated names are escaped as literal regex names. Matching is case-insensitive; the substitution count measures replacement passes, not distinct secrets.',
      ],
      title: 'What is raw log redaction?',
    },
    {
      content: [
        'Prepare a reviewed diagnostic sample for support.',
        'Mask known credential fields before sharing a log excerpt.',
        'Use Secret Redactor for dotenv-specific syntax and manually inspect all remaining text.',
      ],
      title: 'When to use Raw Log Redactor',
    },
  ],
  examples: [
    'password=demo → password=<redacted>.',
    'Authorization: Bearer demo → Authorization: <redacted>.',
    'GET /v1?api_key=demo-key&page=1 → GET /v1?api_key=<redacted>&page=1.',
    '{"token":"demo\\"secret","user":"ada"} → {"token":"<redacted>","user":"ada"}.',
    'DATABASE_URL=postgres://demo:demo@localhost/app with additional name DATABASE_URL → DATABASE_URL=<redacted>.',
    '{\\"password\\":\\"demo\\"} and {\'password\': \'demo\'} → the value becomes <redacted> and the quotes stay.',
    '{"token":["demo"],"user":"ada"} → {"token":<redacted>,"user":"ada"}.',
    'postgres://admin:demo@db.example.com/app → postgres://admin:<redacted>@db.example.com/app.',
    'password=demo,more;text → password=<redacted>; the whole unquoted value goes.',
    'ada@example.com from 10.0.0.1 → unchanged; emails and IP addresses are not anonymized.',
    'github_token=demo and {"api_token": "demo"} → both values become <redacted>; tokenizer=on stays.',
    '--password demo and --api-key=demo → the values become <redacted>; --password-file ./pw stays.',
    '-----BEGIN PRIVATE KEY----- … -----END PRIVATE KEY----- → <redacted-private-key>; a certificate block stays.',
  ],
  faq: [
    {
      answer:
        'JWT-shaped tokens, PEM private key blocks, Authorization and Cookie headers, URL credentials, Bearer tokens, curl -u passwords, long flags such as --password x, and values of names such as password, pwd, token, secret and api_key, alone or as the last part of a key such as DB_PASS, in key=value, key: value, JSON and query-string form. JSON numbers, arrays and objects are masked whole.',
      question: 'What does the log redactor mask?',
    },
    {
      answer:
        'Yes. A name matches the whole key or its last part after _, - or ., so github_token, user_password and x-api-key are masked. A name followed by more text, as in tokenizer or password_policy, is a different setting and stays. camelCase and PascalCase keys that end in a name, such as clientSecret, refreshToken or ClientSecret, are masked as well.',
      question: 'Are compound keys such as github_token redacted?',
    },
    {
      answer:
        'No. Only credential-like values are targeted; emails, IP addresses, user names and IDs stay visible. Review the output for personal data before sharing it.',
      question: 'Are emails and IP addresses removed?',
    },
    {
      answer:
        'It counts replacement passes, not unique secrets. One value can be counted more than once when several patterns match it, so do not use the number as an audit.',
      question: 'What does the redaction count mean?',
    },
    {
      answer:
        'No. Redaction runs locally with regular expressions and makes no network request. The result can still contain secrets the patterns missed, so read it before sharing.',
      question: 'Is my log sent anywhere for redaction?',
    },
  ],
  help: 'Paste a small log excerpt and add unconventional sensitive field names.\n\nRun redaction and inspect every remaining line.\n\nCopy or download the transformed text only after review.\n\nDo not replace a production log archive with the redacted example.',
  notes: [
    'Input is limited to 1,048,576 UTF-16 characters. No network requests or execution of log contents occur.',
    'Reports and transformed logs may still contain names, paths, identifiers or personal data. Review before copying or sharing.',
    'No general value-content secret classifier or encoded-credential detection is claimed. Other PEM blocks, such as certificates and public keys, stay visible.',
    'Headers may consume the rest of their source line, an unquoted value can take the fields glued to it, and text after an unterminated quote or bracket is lost; output is not guaranteed to remain valid JSON.',
    'Additional names are limited to 4,096 characters and cannot be supplied as regex expressions.',
    'A URL keeps its user name when it also has a password; a lone name before @, as in https://token@host/, is masked because it is often a token.',
    'Short flags such as -phunter2 are not detected, because they cannot be told apart from other flags.',
    'Also not recognized: XML elements, user:password@host without a scheme, and names outside the list. Add such a name as an additional name when it appears as key=value.',
    'A key named exactly pwd stays when its value is a path that starts with /, ~ or a drive such as C:\\, because PWD is the working directory in an env dump. Any other pwd value is masked.',
    'The name pass counts only as a long flag or as the last part of a key, such as DB_PASS; a plain pass=3 or compass=north stays.',
    'camelCase and PascalCase keys that end in Token, Secret, Password, Passwd, ApiKey, AccessKey, SecretKey, PrivateKey, Pwd, Pass or Passphrase are masked too, such as clientSecret, RefreshToken and csrfToken; tokenType and sortKey stay.',
    'Replacement counts may include repeat passes over already-masked values; they are not an audit count of unique credentials.',
    'Source input is omitted from new native VS Code drafts; old persisted drafts are not purged automatically.',
  ],
};
