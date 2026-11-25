import { ToolDefinition } from '@devtoolora/core';
import { scorePassword as scorePasswordValue } from '@devtoolora/functions/crypto';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, jsonResultValue } from '../shared';

export const passwordStrengthTool: ToolDefinition = {
  id: 'password-strength',
  keywords: ['password checker', 'password strength', 'weak password', 'security'],
  name: 'Password Strength',
  category: 'Crypto',
  description:
    'Inspect a masked password with an honest local checklist; no breach check, crack-time estimate or strength certification.',
  autoRun: false,
  fields: [{ id: 'password', label: 'Password', required: true, type: 'password' }],
  inputKind: 'none',
  outputKind: 'json',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  relatedToolIds: ['password-generator', 'random-token'],
  samples: [
    {
      fields: { password: 'correct horse battery staple 42!' },
      label: 'Long demonstration phrase',
    },
    { fields: { password: 'Password123!' }, label: 'Common pattern' },
    { fields: { password: 'Aa1!Aa1!Aa1!Aa1!Aa1!' }, label: 'Repeated block' },
    { fields: { password: ' leading spaces ' }, label: 'Leading spaces' },
    { fields: { password: '🐎kůň漢字42!' }, label: 'Unicode code points' },
    { fields: { password: '     ' }, label: 'Whitespace only' },
  ],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text, fields }) =>
    withToolError(() =>
      jsonResultValue(
        scorePasswordValue(fields.password ?? text),
        'Heuristic checklist only; no breach check, crack-time estimate or security certification.',
        'password-strength',
      ),
    ),
};
