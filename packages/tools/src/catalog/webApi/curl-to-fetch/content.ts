import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'cURL commands describe command-line transfers; fetch takes a JavaScript request URL and options. This tool converts one supported literal HTTP(S) request in either direction: cURL → fetch writes a fetch snippet, and fetch → cURL writes a POSIX-shell command.',
        'The cURL tokenizer distinguishes single and double quotes, literal backslashes, empty arguments and escaped line continuations. The fetch reader decodes single, double and non-interpolated template strings without eval.',
        'Both directions keep the method, redirect policy, headers and text body. Unsupported flags or options, files, variables, multiple URLs or ambiguous fields stop the conversion instead of disappearing silently.',
      ],
      title: 'What is cURL ↔ fetch conversion?',
    },
    {
      content: [
        'Translate a small literal request from API docs or a terminal into JavaScript.',
        'Turn a fetch call from browser code into a command for terminal debugging.',
        'Inspect the body, default content type and redirect policy before adapting code.',
        'Use HTTP Request Builder for structured authoring, and a redactor before sharing generated credentials.',
      ],
      title: 'When to convert between cURL and fetch',
    },
  ],
  examples: [
    'cURL → fetch: curl https://example.com/ becomes GET with redirect: "manual".',
    "cURL → fetch: --data-raw '' stays an empty POST body, not a missing body.",
    'cURL → fetch: -d a=1 -d b=2 joins the text data as a=1&b=2, and --json adds application/json defaults.',
    'fetch → cURL: fetch("https://example.com/") uses GET and maps the default follow redirect to --location.',
    'fetch → cURL: a POST body without Content-Type gets text/plain;charset=UTF-8, matching a fetch string body rather than cURL form defaults.',
    "fetch → cURL: an apostrophe in O'Reilly is quoted safely; JSON.stringify(...), variable URLs and template interpolation are errors, not executed.",
  ],
  faq: [
    {
      answer:
        'cURL does not follow redirects unless you pass -L or --location, so the converter writes redirect: "manual" to keep that behavior. Add -L to the command to get redirect: "follow", which is the fetch default.',
      question: 'Why does the fetch call use redirect: "manual"?',
    },
    {
      answer:
        'cURL ignores CORS, but a browser blocks cross-origin requests the server does not allow and will not let scripts set headers such as Host or Cookie. Run the snippet in Node.js 18 or newer, or from a page on the API’s own origin.',
      question: 'Why does my converted fetch call fail with a CORS error?',
    },
    {
      answer:
        'Commands copied from browsers or docs often include flags such as --compressed, -b or -u that this converter does not translate. Remove them, or rewrite cookies and Basic auth as -H "Cookie: …" or -H "Authorization: Basic …" headers, then convert again.',
      question: 'Why does my copied command fail with Unsupported cURL option?',
    },
    {
      answer:
        'No. It parses the command or fetch call as text: nothing is executed, sent or read from disk, and variables such as $TOKEN are rejected rather than expanded. The output keeps any tokens you pasted.',
      question: 'Does the converter run the command or send the request?',
    },
    {
      answer:
        'That is cURL’s own default for -d, --data, --data-raw and --data-binary without a Content-Type header, and the converter makes it explicit. --json sets Content-Type and Accept to application/json instead.',
      question: 'Why does a -d body get Content-Type application/x-www-form-urlencoded?',
    },
    {
      answer:
        'They are rejected, because the reader accepts literals only and never evaluates JavaScript. Write the body as a quoted string and the headers as a plain object literal, then convert again.',
      question: 'Can fetch → cURL read JSON.stringify or a Headers object?',
    },
  ],
  help: 'Choose cURL → fetch or fetch → cURL, then paste one curl command or one fetch(...) call, or choose a sample. Simple assignment and await are accepted around fetch.\n\nKeep literal arguments quoted and use a backslash for a cURL line continuation. For fetch, use literal strings and a plain header object, without chained response handling.\n\nConvert and check the method, headers, body and redirect setting that were written out, including the defaults the tool made explicit.\n\nCopy or download fetch-request.js or curl-request.sh. Running the generated code is a separate step that can send credentials or change a server; the converter does neither.',
  notes: [
    'Input is limited to 65,536 UTF-16 characters. Commands and JavaScript are parsed as text, never executed.',
    'Generated code retains literal credentials and bodies. Review before copying, downloading or manually running it.',
    'CORS, browser-forbidden headers, cookies, TLS, proxies and redirect visibility can differ by runtime; conversion is not a network-equivalence guarantee.',
    'Duplicate headers, empty/removal headers and non-ASCII header values are outside this supported subset.',
    'No file is read, request sent or environment variable resolved. New native drafts omit the original input; old persisted drafts are not purged.',
    'cURL → fetch supports -X/--request, -H/--header, --url, -d/--data, --data-raw, --data-binary, --json, -L/--location, -g/--globoff and -I/--head. Only -s/--silent and -S/--show-error are ignored; bundles of these short switches such as -sSL work, while other flags such as proxies, forms, --compressed and --data-urlencode are errors.',
    "Single, double and bash $'...' quoting are read, including the $'...' escapes that Copy as cURL (bash) uses. File or stdin bodies, environment expansion, command substitution, shell operators, unescaped multiline commands and Windows shell syntax are not supported.",
    'fetch → cURL reads only literal method, headers, body and redirect options. Headers instances, variables, arrays, credentials, mode, cache and signal options are not supported.',
    'GET and HEAD bodies and CONNECT, TRACE and TRACK cannot be represented by fetch. Standard method names must be uppercase in a cURL command; fetch method names are normalized like the browser does.',
    'cURL text bodies default to application/x-www-form-urlencoded and a CLI-style manual redirect. Generated cURL uses --globoff so URLs are not treated as glob patterns.',
    'NUL and control bytes, unpaired surrogates, interpolated templates and unknown escapes cannot be converted safely and are rejected. This is not a general JavaScript interpreter.',
  ],
};
