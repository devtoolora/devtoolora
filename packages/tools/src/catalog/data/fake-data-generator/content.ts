import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'The fake data generator produces synthetic records for tests, demos and mock APIs. Describe one field per line, such as email: email or age: integer(18,90), and every record gets plausible values. With an empty field list it returns the built-in user fixture with id, name, email and active.\n\nOutput is seeded: the same field list, seed and count produce byte-identical results. Each field draws from its own random stream, so adding, removing or reordering one field leaves the values of the other fields unchanged, and a larger count keeps the earlier records as a prefix.\n\nName, email and username in one record belong to the same person, and city, country and country code describe the same place. Emails use the reserved example.test domain, phones the fictional 555-01xx range and IPv4 addresses the documentation networks, so no real person, mailbox or host is targeted.',
      title: 'What is the fake data generator?',
    },
    {
      content: [
        'Seed a local database, a Storybook story or a mock API response with realistic-looking records.',
        'Reproduce a bug with a recorded seed instead of a fresh random dataset.',
        'Export the same records as JSON, JSON Lines or CSV for an import test, a stream pipeline or a spreadsheet preview.',
      ],
      title: 'When to generate fake data',
    },
    {
      content: [
        'People and companies: sequence(start,step), uuid, name, firstName, lastName, email, username, phone, company, jobTitle.',
        'Places: address, city, country, countryCode, postcode.',
        'Values: integer(min,max), float(min,max,decimals), boolean(probability), enum(a,b,c), date(from,to), datetime(from,to).',
        'Text and web: word, sentence, paragraph, url, ipv4, color.',
        'Defaults: integer 0–1000, float 0–1000 with 2 decimals, boolean 0.5, date 2020-01-01 to 2026-12-31, and datetime over the same range in UTC. Append ? to any type, as in phone?, for about one null in five.',
      ],
      title: 'Field types',
    },
  ],
  examples: [
    'email: email → "ada.lovelace.1@example.test"; the number is the record position, so emails are unique within one batch.',
    'age: integer(18,90) → whole numbers from 18 through 90, inclusive.',
    'price: float(1,500,2) → numbers such as 249.37 with at most two decimals.',
    'status: enum(active,pending,banned) → one of the three strings, picked per record.',
    'nickname: firstName? → about one record in five is null; the other records keep the same values as without ?.',
    'joined: date(2024-01-01,2024-12-31) → YYYY-MM-DD dates within 2024.',
    'Empty field list, seed 42, count 5 → the same five users as the former Seeded Fake Data tool.',
  ],
  faq: [
    {
      answer:
        'Keep the same field list, Seed and Count. Generation is deterministic, so the same inputs always give byte-identical output, and raising Count only appends records after the existing ones.',
      question: 'How do I get the same fake data every time?',
    },
    {
      answer:
        'No. Emails use the reserved example.test domain, phone numbers fall in the fictional 555-0100 to 555-0199 range and IPv4 addresses come from documentation networks such as 192.0.2.0/24.',
      question: 'Are the generated emails and phone numbers real?',
    },
    {
      answer:
        'Types include name, email, uuid, integer(min,max), float(min,max,decimals), boolean(probability), enum(a,b), date, datetime, address, city, company, url and more. Common aliases work too, such as int, bool, zip, oneOf, serial and fullName.',
      question: 'Which field types can I use?',
    },
    {
      answer:
        'Random values come from a stream derived from the seed and the field name, so a renamed integer, uuid or enum field gets new values. The name, firstName, lastName, email, username, city, country and countryCode types use shared per-record streams and keep theirs.',
      question: 'Why did values change after I renamed a field?',
    },
    {
      answer:
        'Append ? to the type, as in nickname: firstName?. About one record in five then gets null; JSON keeps null and CSV writes an empty cell.',
      question: 'How do I make a field sometimes null?',
    },
    {
      answer:
        'No. It uses a seeded, reproducible generator that is not cryptographically secure. Use Password Generator or Token Generator for secrets.',
      question: 'Can I use it to generate passwords or tokens?',
    },
  ],
  help: 'Write one field per line as name: type, or apply a sample. Lines starting with # are comments. Leave the list empty for the built-in user fixture.\n\nSet the seed (0–4294967295), the record count (1–1000) and the output format. Add arguments in parentheses, such as integer(1,100) or date(2024-01-01,2024-12-31), and append ? to allow occasional nulls.\n\nReview the result as code or as a table. Change the seed for a different dataset; change only the count to shorten or extend it.\n\nCopy or save the file. Keep the field list and seed with long-lived fixtures, or commit the generated file to your test project.',
  notes: [
    'Everything runs locally. No real accounts are created, contacted or validated.',
    'The pseudo-random generator is reproducible, not cryptographically secure. Do not use it for passwords, tokens or anonymizing real data.',
    'Names come from fixed lists of 24 first and 24 last names, so they repeat in larger batches. Emails and usernames include the record position and are unique within one batch, not across batches.',
    'Phones are North American numbers in the fictional 555-0100 to 555-0199 range. Street addresses and postcodes are random and do not belong to the generated city.',
    'Enum values are strings separated by commas or |, so a value cannot contain those characters. Field names must be unique; they become JSON keys and CSV headers.',
    'CSV uses commas, CRLF line endings, lowercase true and false, and an empty cell for null. JSON and JSON Lines keep numbers, booleans and null as JSON types.',
    'The built-in user fixture keeps the values and key order of Seeded Fake Data, so files saved from that tool stay reproducible. Custom field lists use a separate generator.',
    'Limits: 100 fields, 1000 records, 20,000 characters of field list and 5,000,000 output characters. Larger output is rejected, never truncated.',
  ],
};
