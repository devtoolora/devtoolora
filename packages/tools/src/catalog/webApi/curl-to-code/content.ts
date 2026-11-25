import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'cURL is how most API documentation and browser dev tools share a request. To use that request in an application you usually need the same call in the language you work in. This tool reads one curl command and writes the equivalent code for Python requests, Node.js fetch, Go net/http, PHP cURL or Java HttpClient.',
        'The command is parsed the same way as in the cURL ↔ Fetch Converter: method, headers, body and the -L flag are read, and anything that cannot be represented faithfully, such as file bodies, shell expansion or several URLs, is rejected with a message instead of being dropped silently.',
        'Redirects follow cURL: without -L the generated code does not follow them, with -L it does. Headers a client library sets on its own, such as Host and Content-Length, are left out and listed in a comment so you can see what was skipped.',
      ],
      title: 'What is cURL to Code?',
    },
    {
      content: [
        'Turn a curl command copied from browser dev tools or API docs into a snippet you can paste into a script or a test.',
        'Compare how the same request looks in several languages, for example when you port a client from PHP to Go. The language aliases open the tool with the language preselected.',
        'Check what a command really sends before running it: the output shows the method, every header and the exact body. Use the Request Builder to compose a request from scratch and the Raw HTTP Request Inspector to read a request that is already on the wire.',
      ],
      title: 'When to use cURL to Code',
    },
  ],
  examples: [
    "curl -X POST 'https://api.example.com/items' -H 'Content-Type: application/json' --data-raw '{\"name\":\"Ada\"}' → Python requests.request call with a headers dict and allow_redirects=False.",
    'curl -L \'https://example.com/\' → Node.js fetch with redirect: "follow".',
    "curl -X PUT 'https://api.example.com/items/7' -H 'Authorization: Bearer TOKEN' --data-raw '{\"done\":true}' → Go http.NewRequest with strings.NewReader and one Header.Add per header.",
    "curl 'https://example.com/login' -d user=ada -d 'note=a b' → PHP curl_setopt calls with CURLOPT_POST and CURLOPT_POSTFIELDS user=ada&note=a b.",
    'curl -X DELETE \'https://api.example.com/items/7\' → Java HttpClient with .method("DELETE", noBody()).',
    "curl -X HEAD -L 'https://example.com/' → PHP with CURLOPT_NOBODY and CURLOPT_FOLLOWLOCATION.",
  ],
  faq: [
    {
      answer:
        'Without -L cURL stops at the first response, so the generated code switches redirect handling off: allow_redirects=False in Python, redirect: "manual" in fetch, a CheckRedirect function in Go, Redirect.NEVER in Java. PHP already behaves that way.',
      question: 'Why does the code not follow redirects?',
    },
    {
      answer:
        'Host and Content-Length are set by the HTTP client from the URL and the body, and setting them by hand is wrong or ignored. Java also leaves out Connection, Expect and Upgrade, which its HttpClient refuses. The dropped names are listed in a comment.',
      question: 'Why were some headers left out?',
    },
    {
      answer:
        'No. The command is parsed in your browser and the code is only text. Nothing is sent, but the output keeps tokens and cookies from the command, so share it with care.',
      question: 'Does the tool send the request?',
    },
    {
      answer:
        'Pass the body inline with -d, --data-raw, --data-binary or --json. Bodies read from a file or stdin (@file) are rejected because no file is read, and GET or HEAD requests cannot carry a body in fetch.',
      question: 'How do I send a body?',
    },
  ],
  help: 'Paste one curl command and choose the target language.\n\nThe code appears on the right. Python uses requests, Node.js uses fetch, Go uses net/http, PHP uses cURL and Java uses HttpClient.\n\nIf a header was skipped because the client sets it itself, a comment above the request names it. Unsupported cURL options are reported instead of ignored.\n\nCopy the snippet or download it as request.py, request.js, request.go, request.php or Main.java.',
  notes: [
    'Input is at most 65,536 characters and must be one POSIX-style curl command without a shell wrapper.',
    'Supported options are -X, -H, -d, --data, --data-raw, --data-binary, --json, --url, -L, -I, -s, -S and -g; any other option is rejected.',
    'Strings are escaped for each language: backslash, quote, newline, return and tab everywhere, other control characters as \\x.. in Go and PHP and \\u.... in Java, and the dollar sign in PHP.',
    'PHP uses CURLOPT_POST for POST, CURLOPT_NOBODY for HEAD and CURLOPT_CUSTOMREQUEST for every other method.',
    'Node.js output is identical to the cURL ↔ Fetch Converter.',
    'The generated code prints the status code and the response body and does not handle retries, timeouts or non-text responses; the Python version sets a 30 second timeout.',
    'Nothing is sent and no URL is contacted.',
  ],
};
