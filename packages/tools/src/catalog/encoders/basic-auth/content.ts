import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'HTTP Basic authentication puts a Base64-encoded username:password value in the Authorization request header.\n\nBase64 is reversible encoding, not encryption; the generated header contains reusable credentials and must be treated like a password.',
      title: 'What is Basic authentication?',
    },
    {
      content: [
        'Prepare a header for a test API that explicitly accepts HTTP Basic authentication over HTTPS.',
        'Create a reproducible request fixture using demo credentials rather than a real account.',
        'Compare the generated value with a request builder or the Base64 text converter when troubleshooting authentication.',
      ],
      title: 'When to use Basic Auth Generator',
    },
  ],
  examples: [
    'Username demo + password secret → Authorization: Basic ZGVtbzpzZWNyZXQ=',
    'Username user + password pass → Authorization: Basic dXNlcjpwYXNz',
    'Username Aladdin + password open sesame → Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==',
    'Username user + password a:b → Authorization: Basic dXNlcjphOmI= (user:a:b; only the first colon separates the username)',
  ],
  faq: [
    {
      answer:
        'Only over HTTPS. The header is just Base64 of username:password, so anyone who sees an unencrypted request can decode the credentials, and the client sends them again with every request.',
      question: 'Is Basic authentication secure?',
    },
    {
      answer:
        'Yes, without any key. Remove the "Basic " prefix and decode the rest as Base64: ZGVtbzpzZWNyZXQ= becomes demo:secret. Treat a copied header like the password it contains.',
      question: 'Can a Basic Auth header be decoded?',
    },
    {
      answer:
        'The server splits the decoded value at the first colon: everything before it is the username and everything after it is the password. A colon in the password is fine, but one in the username would move part of the name into the password.',
      question: 'Why is a colon not allowed in the username?',
    },
    {
      answer:
        'Pass the whole line with -H, for example curl -H "Authorization: Basic ZGVtbzpzZWNyZXQ=" https://api.example.com/. The option -u demo:secret makes curl build the same header itself.',
      question: 'How do I use the header with curl?',
    },
    {
      answer:
        'No. It only builds the header text on your device; it makes no network request and cannot tell whether a server would accept the username and password.',
      question: 'Does this tool send my credentials anywhere?',
    },
  ],
  help: 'Enter the Username exactly as the server expects it; it cannot contain a colon, and leading or trailing spaces are kept.\n\nEnter the Password; spaces and colons are allowed, or apply a sample such as Demo credentials to try the tool with fake values.\n\nRun the generator and copy the complete Authorization header into your HTTP client or request builder.\n\nClear the inputs when finished; this tool generates text locally and does not test the credentials or contact the server.',
  notes: [
    'Use HTTPS and avoid sharing the output in logs, screenshots or public examples; anyone with the header can recover the credentials.',
    'This generator requires non-empty fields and uses UTF-8; the server must accept that character encoding for non-ASCII credentials.',
    'Usernames cannot contain a colon, and neither field can contain ASCII control characters; leading and trailing spaces are not trimmed.',
    'Password fields are not saved or restored in VS Code drafts; use Clear to remove the current form values and result.',
  ],
};
