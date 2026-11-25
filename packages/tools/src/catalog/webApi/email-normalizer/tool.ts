import { ToolDefinition } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

export const emailNormalizerTool: ToolDefinition = {
  id: 'email-normalizer',
  keywords: ['email address', 'gmail', 'canonical', 'plus addressing', 'lowercase'],
  name: 'Email Normalizer',
  category: 'Web/API',
  description: 'Normalize and inspect an email address.',
  samples: [
    { label: 'Gmail plus alias', text: 'Ada.Lovelace+demo@gmail.com' },
    { label: 'Generic case preservation', text: 'Ada.Lovelace+demo@Example.com' },
    { label: 'Custom Workspace domain', text: 'a.b@custom-workspace.example' },
    { label: 'Googlemail alias', text: 'Ada@googlemail.com' },
    { label: 'Outer whitespace', text: '  Ada@Example.com  ' },
    { label: 'Subdomain mailbox', text: 'Support.Team@mail.example.com' },
  ],
  inputKind: 'text',
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  relatedToolIds: ['url-parse', 'query-string-parser'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) =>
    identityOutput(
      JSON.stringify(normalizeEmail(text), null, 2),
      'email-report.json',
      'Suggested spelling only · not proof of delivery, ownership or account equivalence.',
      true,
    ),
};

function normalizeEmail(text: string): Record<string, string | boolean> {
  return withToolError(() => webFunctions.normalizeEmail(text));
}
