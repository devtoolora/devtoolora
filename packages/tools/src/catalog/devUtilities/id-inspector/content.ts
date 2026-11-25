import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Inspect reads one ID per line and detects the format by shape. A UUID has 32 hex digits, with hyphens, braces or a urn:uuid: prefix. A ULID has 26 Crockford base32 characters in any case. A KSUID has 27 base62 characters. A Snowflake has 1 to 20 decimal digits and fits in 64 bits. Every other line is listed as unrecognized, not as an error, because Nano IDs and other random IDs carry no data.\n\nBlank lines are skipped, and each result keeps the line number of its input.',
      title: 'Which IDs are detected?',
    },
    {
      content:
        'A UUID shows its version, its variant and whether it is the nil or max UUID. Versions 1 and 6 show the timestamp, the clock sequence and the node. Version 7 shows its Unix millisecond timestamp. Other versions, such as the random version 4, hold no time.\n\nA ULID shows its millisecond timestamp and 80 bits of randomness in hex. A KSUID shows its timestamp (seconds since 2014-05-13, epoch 1400000000) and its 128-bit payload in hex. A Snowflake shows its timestamp, the two 5-bit IDs (worker and process) and the 12-bit sequence.',
      title: 'What is decoded from each ID?',
    },
    {
      content:
        'A Snowflake stores milliseconds since an epoch that depends on the platform. Discord counts from 2015-01-01 and Twitter from 2010-11-04. Choose Custom and enter the epoch in milliseconds for other platforms. A wrong epoch still decodes, but to the wrong date.\n\nGenerate makes Nano IDs, UUID v7 and KSUIDs from the browser random generator. Nano ID picks characters by rejection sampling, so every character of the alphabet is equally likely. UUID v7 has no counter, so two IDs from the same millisecond are not ordered.',
      title: 'Epochs and generation',
    },
  ],
  examples: [
    '017F22E2-79B0-7CC3-98C4-DC0C0C07398F → UUID v7 from 2022-02-22T19:22:22.000Z',
    'C232AB00-9414-11EC-B3C8-9F6BDECED846 → UUID v1 with clock sequence 13256',
    '01ARZ3NDEKTSV4RRFFQ69G5FAV → ULID from 2016-07-30T23:54:10.259Z',
    '0ujtsYcgvSTl8PAuAdqWYSMnLOv → KSUID from 2017-10-10T04:00:47.000Z',
    '175928847299117063 with the Discord epoch → 2016-04-30T11:18:25.796Z',
    'V1StGXR8_Z5jdHi6B-myT → unrecognized, a Nano ID holds no data',
  ],
  faq: [
    {
      answer:
        'A Nano ID, a UUID v4 and other random IDs hold no timestamp or fields, so there is nothing to decode. A UUID v4 still shows its version and variant, and a Nano ID is listed as unrecognized.',
      question: 'Why is my ID unrecognized?',
    },
    {
      answer:
        'The Snowflake format has no marker for its platform, so the epoch must be chosen. Discord and Twitter are built in. For others, such as Instagram or a custom service, pick Custom and enter its epoch in milliseconds.',
      question: 'Which epoch do I choose for a Snowflake?',
    },
    {
      answer:
        'The version 1 timestamp counts 100 nanosecond ticks since 1582-10-15, and the result is rounded down to the millisecond. Version 6 holds the same time with its bytes reordered, so both decode to the same date.',
      question: 'How are UUID v1 and v6 timestamps read?',
    },
    {
      answer:
        'No. The generators run in the browser, and the random bytes come from the Web Crypto random generator. UUID v4 and ULID have their own generators in the UUID Generator and ULID Generator tools.',
      question: 'Are the generated IDs sent anywhere?',
    },
    {
      answer:
        'A 21-character Nano ID with the default 64-character alphabet has 126 bits of randomness, about the same as a UUID v4 with 122 bits. A shorter size or a smaller alphabet lowers that, so keep it long enough for how many IDs you make.',
      question: 'How long should a Nano ID be?',
    },
  ],
  help: 'Choose Inspect to decode IDs, or Generate to make new ones.\n\nFor Inspect, paste one ID per line as the main input. UUIDs may have hyphens, braces or a urn:uuid: prefix. For a Snowflake, choose the Discord or Twitter epoch, or Custom with an epoch in milliseconds.\n\nFor Generate, choose Nano ID, UUID v7 or KSUID and the count. A Nano ID also takes a size and an alphabet.\n\nRun the tool. Inspect returns a JSON array with one entry per line, and Generate returns one ID per line. Copy the result or save it as ids.json or ids.txt.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: inspect reads 1,000 lines of at most 100 characters; generate makes 1-100 IDs, a Nano ID size of 2-256 and an alphabet of 2-256 characters.',
    'Unrecognized lines are reported with a reason, not as an error.',
    'UUID v7 has no counter, so IDs made in the same millisecond are not ordered.',
  ],
};
