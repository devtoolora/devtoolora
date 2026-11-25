import { ToolDefinition } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

export const userAgentParserTool: ToolDefinition = {
  id: 'user-agent-parser',
  name: 'User-Agent Parser',
  category: 'Web/API',
  description:
    'Identify the browser, engine, operating system, device type and common bots from a User-Agent string.',
  samples: [
    {
      label: 'Chrome on macOS',
      text: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    {
      label: 'Edge on Windows',
      text: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.67',
    },
    {
      label: 'Firefox on Linux',
      text: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
    },
    {
      label: 'Safari on iPhone',
      text: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
    },
    {
      label: 'Samsung Internet on an Android tablet',
      text: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Safari/537.36',
    },
    {
      label: 'Googlebot crawler',
      text: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
  ],
  inputKind: 'text',
  inputPresentation: {
    label: 'User-Agent',
    placeholder: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) …',
  },
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  autoRun: true,
  freshResults: true,
  keywords: [
    'user agent',
    'user-agent',
    'ua parser',
    'browser detection',
    'bot detection',
    'navigator.useragent',
  ],
  relatedToolIds: ['http-headers-parser', 'raw-http-request-inspector'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) => {
    const report = parseUserAgent(text);
    const browser = report.browser as { name: string; version: string };

    return identityOutput(
      JSON.stringify(report, null, 2),
      'user-agent.json',
      `${browser.name}${browser.version ? ` ${browser.version}` : ''} · ${String(report.os)}${report.osVersion ? ` ${String(report.osVersion)}` : ''} · ${String(report.device)} · best-effort pattern match, not identity.`,
      true,
    );
  },
};

function parseUserAgent(text: string): Record<string, unknown> {
  return withToolError(() => webFunctions.parseUserAgent(text));
}
