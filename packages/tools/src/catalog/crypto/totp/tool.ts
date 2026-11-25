import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { base64Encode, utf8Bytes } from '@devtoolora/functions/binary';
import {
  buildOtpauthUri,
  generateTotp,
  parseTotpInput,
  parseTotpTime,
  validateTotp,
  type TotpConfig,
} from '@devtoolora/functions/crypto';
import { createQrSvg } from '@devtoolora/functions/qr';
import { withToolErrorAsync } from '../../../adapters/errors';
import { numericField } from '../../../adapters/fields';
import { browserSafeCapabilities, cryptoTextResult } from '../shared';

const algorithms = ['SHA-1', 'SHA-256', 'SHA-512'] as const;
const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const sampleDefaults = {
  account: '',
  algorithm: 'SHA-1',
  code: '',
  digits: '6',
  issuer: '',
  mode: 'generate',
  period: '30',
  time: '59',
  window: '1',
};

export const totpTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Generate and validate time-based one-time passwords (RFC 6238) from a Base32 secret or an otpauth URI, with an otpauth URI and QR code to enroll an authenticator app.',
  fields: [
    {
      defaultValue: 'generate',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Generate', value: 'generate' },
        { label: 'Validate', value: 'validate' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '',
      id: 'code',
      label: 'Code to check',
      type: 'text',
      visibleWhen: { field: 'mode', is: ['validate'] },
    },
    {
      defaultValue: '6',
      id: 'digits',
      label: 'Digits',
      options: [
        { label: '6', value: '6' },
        { label: '8', value: '8' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    { defaultValue: '30', id: 'period', label: 'Period (seconds)', type: 'number' },
    {
      defaultValue: 'SHA-1',
      id: 'algorithm',
      label: 'Algorithm',
      options: algorithms.map((algorithm) => ({ label: algorithm, value: algorithm })),
      type: 'select',
    },
    {
      defaultValue: '1',
      id: 'window',
      label: 'Window (steps each way)',
      type: 'number',
      visibleWhen: { field: 'mode', is: ['validate'] },
    },
    {
      defaultValue: '',
      id: 'time',
      label: 'Time (Unix seconds or ISO 8601; blank = now)',
      type: 'text',
    },
    { defaultValue: '', id: 'issuer', label: 'Issuer', type: 'text' },
    { defaultValue: '', id: 'account', label: 'Account', type: 'text' },
  ],
  freshResults: true,
  id: 'totp',
  inputKind: 'text',
  inputPresentation: {
    label: 'Secret or otpauth URI',
    placeholder: 'Base32 secret such as JBSWY3DPEHPK3PXP, or an otpauth://totp/ URI',
  },
  keywords: ['totp', 'otp', '2fa', 'mfa', 'authenticator', 'rfc 6238', 'otpauth', 'one-time'],
  name: 'TOTP Generator & Validator',
  outputKind: 'text',
  relatedToolIds: ['qr-code-generator', 'hmac', 'random-token'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => withToolErrorAsync(() => runTotp(text, fields)),
  runRequires: [{ anyOf: ['code'], when: { field: 'mode', is: ['validate'] } }],
  samples: [
    {
      fields: { ...sampleDefaults, digits: '8' },
      label: 'RFC 6238 SHA-1 at 59 s',
      text: rfcSecret,
    },
    {
      fields: { ...sampleDefaults, time: '1111111109' },
      label: 'otpauth URI at a fixed time',
      text: 'otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&digits=8&period=60&algorithm=SHA256',
    },
    {
      fields: {
        ...sampleDefaults,
        account: 'alice@example.com',
        issuer: 'Example',
        time: '1234567890',
      },
      label: 'Bare secret with issuer and account',
      text: 'jbsw y3dp ehpk 3pxp',
    },
    {
      fields: { ...sampleDefaults, algorithm: 'SHA-256', digits: '8' },
      label: 'SHA-256, 8 digits',
      text: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA',
    },
    {
      fields: { ...sampleDefaults, code: '94287082', digits: '8', mode: 'validate' },
      label: 'Validate the RFC code',
      text: rfcSecret,
    },
    {
      fields: { ...sampleDefaults, code: '94287082', digits: '8', mode: 'validate', time: '89' },
      label: 'Validate one step late',
      text: rfcSecret,
    },
  ],
  sensitiveInput: true,
  supportsSelection: false,
};

async function runTotp(text: string, fields: Record<string, string>): Promise<ToolResult> {
  const mode = fields.mode || 'generate';

  if (mode !== 'generate' && mode !== 'validate')
    throw new ToolError('Choose Generate or Validate.');

  if ((fields.issuer ?? '').length > 256) throw new ToolError('Issuer exceeds 256 characters.');
  if ((fields.account ?? '').length > 256) throw new ToolError('Account exceeds 256 characters.');

  const algorithm = algorithms.find((candidate) => candidate === (fields.algorithm || 'SHA-1'));

  if (!algorithm) throw new ToolError('Choose SHA-1, SHA-256 or SHA-512.');
  if ((fields.digits || '6') !== '6' && fields.digits !== '8')
    throw new ToolError('Digits must be 6 or 8.');

  const config = parseTotpInput(text, {
    account: fields.account?.trim() || undefined,
    algorithm,
    digits: fields.digits === '8' ? 8 : 6,
    issuer: fields.issuer?.trim() || undefined,
    period: fields.period?.trim() ? Number(fields.period) : 30,
  });
  const time = parseTotpTime(fields.time ?? '', Math.floor(Date.now() / 1000));

  return mode === 'generate' ? generateResult(config, time) : validateResult(config, fields, time);
}

async function generateResult(config: TotpConfig, time: number): Promise<ToolResult> {
  const { code, next, previous, secondsRemaining, step } = await generateTotp(config, time);
  const uri = buildOtpauthUri(config);
  const lines = [
    `Code: ${code}`,
    `Previous: ${previous ?? '-'}`,
    `Next: ${next}`,
    `Seconds remaining: ${secondsRemaining}`,
    `Step: ${step}`,
    `URI: ${uri}`,
  ].join('\n');
  const svg = await createQrSvg(uri, { size: 256 }).catch(() => undefined);
  const summary = `TOTP · ${config.algorithm} · ${config.digits} digits · ${config.period} s · ${secondsRemaining} s left`;

  return {
    ...cryptoTextResult('totp', lines, summary),
    ...(svg && { previewDataUri: `data:image/svg+xml;base64,${base64Encode(utf8Bytes(svg))}` }),
  };
}

async function validateResult(
  config: TotpConfig,
  fields: Record<string, string>,
  time: number,
): Promise<ToolResult> {
  const window = numericField(fields.window?.trim() || undefined, 'Window', 0, 10, 1);

  if (!fields.code?.trim()) throw new ToolError('Code to check is required.');

  const { offset, valid } = await validateTotp(config, fields.code, time, window);
  const text = valid
    ? `Valid · step offset ${offset}`
    : `Invalid · no match within ${window} ${window === 1 ? 'step' : 'steps'} each way`;

  return cryptoTextResult('totp', text, valid ? `Valid · offset ${offset}` : 'Invalid');
}
