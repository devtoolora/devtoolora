import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  {
    alert: /65,536/,
    id: 'cookie-parser',
    name: 'Cookie Parser & Set-Cookie Builder',
    oversizeInput: 65_537,
  },
  { alert: /65,536/, id: 'csp-analyzer', name: 'CSP Builder & Analyzer', oversizeInput: 65_537 },
  {
    alert: /scheme/,
    autoRun: true,
    fields: [{ kind: 'text', label: /^Allowed origins/, value: 'example.com' }],
    id: 'cors-builder',
    inputless: true,
    name: 'CORS Header Builder',
  },
  {
    alert: /not a request/,
    id: 'security-headers-analyzer',
    invalidText: 'GET / HTTP/1.1\nHost: x',
    name: 'Security Headers Analyzer',
  },
  {
    alert: /500,000/,
    id: 'robots-txt',
    name: 'robots.txt Generator & Tester',
    oversizeInput: 500_001,
  },
  {
    alert: /Base URL/,
    id: 'sitemap-xml',
    invalidText: '/relative',
    name: 'sitemap.xml Generator & Validator',
  },
  {
    alert: /start with/,
    id: 'redirect-rules',
    invalidText: 'old new',
    name: 'Redirect Rule Generator',
  },
  {
    alert: /absolute/,
    autoRun: true,
    fields: [{ kind: 'text', label: /^Destination URL/, value: 'example.com' }],
    id: 'utm-builder',
    inputless: true,
    name: 'UTM Link Builder',
  },
  {
    alert: /absolute/,
    autoRun: true,
    fields: [{ kind: 'text', label: /^URL$/, value: 'example.com' }],
    id: 'json-ld-generator',
    inputless: true,
    name: 'JSON-LD Structured Data Generator',
  },
  {
    alert: /CSS color/,
    autoRun: true,
    fields: [{ kind: 'text', label: /^Theme color/, value: 'blueish' }],
    id: 'web-manifest-generator',
    inputless: true,
    name: 'Web App Manifest Generator',
  },
  {
    alert: /Name: value/,
    id: 'email-header-analyzer',
    invalidText: 'not a header',
    name: 'Email Header Analyzer',
  },
  {
    alert: /v=spf1/,
    id: 'email-auth-records',
    invalidText: 'hello',
    name: 'SPF, DKIM & DMARC Record Builder & Parser',
  },
  {
    alert: /Supported schemes/,
    id: 'connection-string',
    invalidText: 'nope',
    name: 'Connection String Builder & Parser',
  },
  {
    alert: /curl command/,
    id: 'curl-to-code',
    invalidText: 'wget https://x',
    name: 'cURL to Code',
  },
];

defineToolSmokeTests('Web and HTTP tools', tools);
