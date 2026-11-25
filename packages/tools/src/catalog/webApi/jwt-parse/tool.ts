import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import {
  decodeJwt,
  jwtAlgorithms,
  signJwt,
  verifyJwt,
  type JwtAlgorithm,
  type JwtSecretEncoding,
  type JwtTiming,
} from '@devtoolora/functions/crypto';
import { processJsonDocument, stringifyExactJson } from '@devtoolora/functions/format';
import { withToolError, withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

const jwtModeCondition = (modes: string[]) => ({ field: 'mode', is: modes });

const jwtDefaults = {
  algorithm: 'auto',
  clockTolerance: '0',
  expiresIn: '',
  header: '',
  issuedAt: 'false',
  key: '',
  secretEncoding: 'utf8',
};

export const jwtParseTool: ToolDefinition = {
  badge: { accent: 'calibration', icon: 'key-round' },
  id: 'jwt-parse',
  name: 'JWT Debugger',
  category: 'Web/API',
  description:
    'Decode, verify and sign JSON Web Tokens locally: HS, RS, PS, ES and EdDSA algorithms with secrets, PEM keys, certificates, JWK or JWKS, plus readable exp, nbf and iat times.',
  samples: [
    {
      fields: { ...jwtDefaults, mode: 'decode' },
      label: 'Decode an HS256 token',
      text: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEwMjQiLCJuYW1lIjoiQWRhIExvdmVsYWNlIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzYwMDAwMDAwLCJleHAiOjQxMDI0NDQ4MDB9.MAgQvtXTnxVPAgkGoQbNe4bVthJ_gL8HvqUMRjbSnP0',
    },
    {
      fields: { ...jwtDefaults, key: 'a-string-secret-at-least-256-bits-long', mode: 'verify' },
      label: 'Verify HS256 with a secret',
      text: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEwMjQiLCJuYW1lIjoiQWRhIExvdmVsYWNlIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzYwMDAwMDAwLCJleHAiOjQxMDI0NDQ4MDB9.MAgQvtXTnxVPAgkGoQbNe4bVthJ_gL8HvqUMRjbSnP0',
    },
    {
      fields: {
        ...jwtDefaults,
        key: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2kLL/IE2EVlnKDocdzvU\nmqwpTW28HiVDSbtZMHvboZtNf6h2M2KQYYZBkZSVB+oodaOHM5Yow/wS3hRru9zR\nLx9ah0wbGjkpiS/0/K86U0F0+Puyv6oUGGK/EIq7V0I8nwkqRRHVI/T608Kr6wiu\nHxh7cSqvfslfMAX5QEPamVhaaoBZNXRLixpas3v2Uk2X+5/6VYKj+X023Fo9qmWd\nGAF9UUqHcwZOti2ATFEs8CpeHcUqa5peZcKj1vk8a9lTqDytp9wUgiI6R0RpAkYk\nqlaI9PBTlpaaGxTBu5Wqn9OlmkExyzPv70FgAtqr/xyfRY7H4v5k3F0PhMecI5de\nuQIDAQAB\n-----END PUBLIC KEY-----',
        mode: 'verify',
      },
      label: 'Verify RS256 with a PEM public key',
      text: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InJzYS0yMDI2In0.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJhdWQiOiJhcGk6Ly9vcmRlcnMiLCJzdWIiOiJ1c2VyXzEwMjQiLCJzY29wZSI6Im9yZGVyczpyZWFkIiwiaWF0IjoxNzYwMDAwMDAwLCJuYmYiOjE3NjAwMDAwMDAsImV4cCI6NDEwMjQ0NDgwMH0.nVNAjbN271BD6Ivqv9F4kaQN2kW9-OHaIHWYaHL3xHbYY41VwgDx5aGGhptmgOZSCh8G7W2bDPFaUCW3bfD_aPTj7_jGAhPXJtfuiy3KJa75RhiXGk9CSiYH7HJhBhe_5sLfLcBXboRQhFHNO6LRoep-m35JYB25AloLfxgcdz1MfpYCPuvjBUY6a66KUVzANXIj8sKG2RQwJKZ53UXh8XEgW_adRtUf62zbtkcVAJbeKBgJTbTRrTtg8Q9j1I9N4MH1rnZrY6M76hJbk_m8_Hy3UnOAEqAPM1JjxmyL5EASRbaSEORvUW1riUA_G8eepyLR9B6SwB_32_AF_yyd1w',
    },
    {
      fields: {
        ...jwtDefaults,
        key: '{\n  "keys": [\n    {\n      "kty": "EC",\n      "x": "3PNQwTcFkWBU7Y3pBJrsyGEoCR8uvuxjFqIizshZEj4",\n      "y": "Aq4npyyUOjr_UuBVaoCTByzn4vsn2y8uvOeJxo3iEJM",\n      "crv": "P-256",\n      "kid": "ec-2026",\n      "alg": "ES256",\n      "use": "sig"\n    },\n    {\n      "kty": "RSA",\n      "n": "2kLL_IE2EVlnKDocdzvUmqwpTW28HiVDSbtZMHvboZtNf6h2M2KQYYZBkZSVB-oodaOHM5Yow_wS3hRru9zRLx9ah0wbGjkpiS_0_K86U0F0-Puyv6oUGGK_EIq7V0I8nwkqRRHVI_T608Kr6wiuHxh7cSqvfslfMAX5QEPamVhaaoBZNXRLixpas3v2Uk2X-5_6VYKj-X023Fo9qmWdGAF9UUqHcwZOti2ATFEs8CpeHcUqa5peZcKj1vk8a9lTqDytp9wUgiI6R0RpAkYkqlaI9PBTlpaaGxTBu5Wqn9OlmkExyzPv70FgAtqr_xyfRY7H4v5k3F0PhMecI5deuQ",\n      "e": "AQAB",\n      "kid": "rsa-2026",\n      "alg": "RS256",\n      "use": "sig"\n    }\n  ]\n}',
        mode: 'verify',
      },
      label: 'Verify ES256 with a JWKS',
      text: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImVjLTIwMjYifQ.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJzdWIiOiJzZXJ2aWNlLWJpbGxpbmciLCJpYXQiOjE3NjAwMDAwMDAsImV4cCI6NDEwMjQ0NDgwMH0.dd6ScrNUhjHdulT32pPr4xn3ik4_H-9lCmjU1v3TKYVswBpYK3oCPswqxnnqVG5-QyYbpIlOd---KJYBu65dvA',
    },
    {
      fields: {
        ...jwtDefaults,
        expiresIn: '1h',
        issuedAt: 'true',
        key: 'a-string-secret-at-least-256-bits-long',
        mode: 'sign',
      },
      label: 'Sign HS256 with iat and a 1 hour expiry',
      text: '{\n  "sub": "user_1024",\n  "name": "Ada Lovelace",\n  "role": "admin"\n}',
    },
    {
      fields: {
        ...jwtDefaults,
        expiresIn: '15m',
        key: '{"crv":"Ed25519","d":"hw41U1ylqxVr4VUGG0wWc33XPSuCDiU6intRwW_Z4Mo","x":"ENB9z7Nt7GVMElgn_pbcCrHlD6-Q6CO-ezbGOZtpV6U","kty":"OKP","kid":"ed-demo"}',
        mode: 'sign',
      },
      label: 'Sign EdDSA with a private JWK',
      text: '{\n  "iss": "https://auth.example.com",\n  "sub": "service-billing",\n  "scope": "invoices:write"\n}',
    },
  ],
  inputKind: 'text',
  inputPresentation: {
    byMode: { sign: { label: 'Payload JSON', placeholder: '{"sub":"user_123","role":"admin"}' } },
    label: 'JWT',
    placeholder: 'eyJhbGciOi… (a Bearer prefix is fine)',
  },
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  autoRun: true,
  freshResults: true,
  sensitiveInput: true,
  fields: [
    {
      defaultValue: 'decode',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Decode', value: 'decode' },
        { label: 'Verify', value: 'verify' },
        { label: 'Sign', value: 'sign' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      help: 'HMAC secret, PEM public or private key, certificate, JWK or JWKS. Not saved in drafts.',
      id: 'key',
      label: 'Secret or key',
      placeholder: 'Secret, -----BEGIN PUBLIC KEY-----, {"kty":…} or {"keys":[…]}',
      rows: 4,
      sensitive: true,
      type: 'textarea',
      visibleWhen: jwtModeCondition(['verify', 'sign']),
    },
    {
      defaultValue: 'auto',
      help: 'Verify: Auto uses the header alg only with a matching key; choose one to require it. Sign: Auto picks HS256 for a secret, RS256 for RSA, ES256/384/512 by curve and EdDSA for Ed25519.',
      id: 'algorithm',
      label: 'Algorithm',
      options: [
        { label: 'Auto', value: 'auto' },
        ...jwtAlgorithms
          .filter((algorithm) => algorithm !== 'Ed25519')
          .map((algorithm) => ({
            label: algorithm === 'EdDSA' ? 'EdDSA (Ed25519)' : algorithm,
            value: algorithm,
          })),
      ],
      type: 'select',
      visibleWhen: jwtModeCondition(['verify', 'sign']),
    },
    {
      defaultValue: 'utf8',
      help: 'How an HMAC secret is written. PEM and JWK keys ignore this.',
      id: 'secretEncoding',
      label: 'Secret encoding',
      options: [
        { label: 'Text (UTF-8)', value: 'utf8' },
        { label: 'Base64 or Base64URL', value: 'base64' },
        { label: 'Hex', value: 'hex' },
      ],
      type: 'select',
      visibleWhen: jwtModeCondition(['verify', 'sign']),
    },
    {
      defaultValue: '0',
      help: 'Seconds of leeway for exp, nbf and iat: 0–86400.',
      id: 'clockTolerance',
      label: 'Clock tolerance (seconds)',
      type: 'number',
      visibleWhen: jwtModeCondition(['decode', 'verify']),
    },
    {
      help: 'Optional JSON object merged into the header, such as {"kid":"key-1"}. alg and typ are set for you unless you give them here.',
      id: 'header',
      label: 'Extra header JSON',
      placeholder: '{"kid":"key-2026"}',
      rows: 2,
      type: 'textarea',
      visibleWhen: jwtModeCondition(['sign']),
    },
    {
      defaultValue: 'false',
      id: 'issuedAt',
      label: 'Set iat to now',
      type: 'checkbox',
      visibleWhen: jwtModeCondition(['sign']),
    },
    {
      help: 'Sets exp from now (or from iat): seconds, or a duration such as 15m, 1h30m or 7d. Replaces any exp in the payload.',
      id: 'expiresIn',
      label: 'Expires in',
      placeholder: '15m, 1h, 7d',
      type: 'text',
      visibleWhen: jwtModeCondition(['sign']),
    },
  ],
  keywords: [
    'jwt',
    'jwt decoder',
    'jwt decode',
    'jwt parser',
    'jwt verify',
    'jwt sign',
    'jwt debugger',
    'json web token',
    'jws',
    'jwks',
    'bearer token',
    'id token',
    'access token',
    'rs256',
    'es256',
    'hs256',
  ],
  relatedToolIds: [
    'base64-encode',
    'timestamp-convert',
    'pem-key-inspector',
    'certificate-inspector',
    'hmac',
    'http-headers-parser',
  ],
  resultActions: ['copy', 'replace', 'insert', 'scratch'],
  run: ({ fields, text }) => runJwt(text, fields),
};

export const jwtSignVerifyTool: ToolDefinition = {
  ...jwtParseTool,
  aliasOf: 'jwt-parse',
  badge: undefined,
  fields: jwtParseTool.fields?.map((field) =>
    field.id === 'mode' ? { ...field, defaultValue: 'verify' } : field,
  ),
  id: 'jwt-sign-verify',
  name: 'JWT Sign & Verify',
};

async function runJwt(text: string, fields: Record<string, string>): Promise<ToolResult> {
  const mode = fields.mode || 'decode';

  if (mode !== 'decode' && mode !== 'verify' && mode !== 'sign')
    throw new ToolError('Choose Decode, Verify or Sign.');

  const key = fields.key ?? '';
  const algorithm = fields.algorithm || 'auto';

  if (algorithm !== 'auto' && !(jwtAlgorithms as readonly string[]).includes(algorithm))
    throw new ToolError(`Choose Auto or one of ${jwtAlgorithms.join(', ')}.`);

  const secretEncoding = fields.secretEncoding || 'utf8';

  if (secretEncoding !== 'utf8' && secretEncoding !== 'base64' && secretEncoding !== 'hex')
    throw new ToolError('Choose Text, Base64 or Hex secret encoding.');

  const options = {
    algorithm: algorithm as 'auto' | JwtAlgorithm,
    secretEncoding: secretEncoding as JwtSecretEncoding,
  };

  if (mode === 'sign') return signResult(text, key, options, fields);

  const clockToleranceSeconds = integerField(
    fields.clockTolerance,
    'Clock tolerance',
    0,
    0,
    86_400,
  );

  if (mode === 'verify' && key.trim()) {
    const result = await withToolErrorAsync(() =>
      verifyJwt(text, key, { ...options, clockToleranceSeconds }),
    );
    const timing = verifiedTimingNotes[result.timing ?? 'valid'] ?? '';
    const summary =
      result.signature === 'invalid'
        ? `Invalid: ${result.reason ?? 'the signature does not match.'}`
        : `${result.valid ? 'Valid' : 'Signature valid'} ${result.algorithm} signature${timing ? `, ${timing}` : ''}${expiryText(result.times)}.`;

    return jwtOutput(result, summary);
  }

  const decoded = withToolError(() => decodeJwt(text, { clockToleranceSeconds }));
  const timing = decodedTimingNotes[decoded.timing ?? 'valid'] ?? '';
  const summary =
    mode === 'verify'
      ? 'Decoded only: enter the secret or key to verify the signature.'
      : `Decoded, signature not verified${timing}${expiryText(decoded.times)}.`;

  return jwtOutput(decoded, summary);
}

async function signResult(
  source: string,
  key: string,
  options: { algorithm: 'auto' | JwtAlgorithm; secretEncoding: JwtSecretEncoding },
  fields: Record<string, string>,
): Promise<ToolResult> {
  if (!key.trim()) throw new ToolError('Enter an HMAC secret or a private key to sign with.');

  const signed = await withToolErrorAsync(() =>
    signJwt(source, key, {
      ...options,
      expiresIn: fields.expiresIn,
      header: fields.header,
      issuedAt: fields.issuedAt === 'true',
    }),
  );

  return {
    language: 'plaintext',
    summary: [
      `Signed with ${signed.algorithm}${expiryNote(signed.payload.exp)}.`,
      ...signed.warnings,
    ].join(' '),
    text: signed.token,
  };
}

function expiryNote(exp: unknown): string {
  if (exp === undefined) return ' · no exp, so it never expires';

  const date = typeof exp === 'number' ? new Date(exp * 1000) : undefined;

  return date && !Number.isNaN(date.getTime())
    ? ` · expires ${date.toISOString().replace('.000Z', 'Z')}`
    : ' · exp is not a date it can show';
}

const verifiedTimingNotes: Partial<Record<JwtTiming, string>> = {
  expired: 'but the token has expired',
  'not yet valid': 'but the token is not valid yet (nbf)',
};

const decodedTimingNotes: Partial<Record<JwtTiming, string>> = {
  expired: ' · expired',
  'not yet valid': ' · not valid yet',
};

function jwtOutput(value: object, summary: string): ToolResult {
  const text = stringifyExactJson(value, 2);

  return {
    jsonTree: {
      expandedLevels: 2,
      nodes: processJsonDocument(text, { collectTree: true, mode: 'minify' }).nodes,
    },
    language: 'json',
    summary,
    text,
  };
}

function expiryText(times: Record<string, string>): string {
  const relative = times.exp?.match(/\((.+)\)$/)?.[1];

  if (!relative) return '';

  return relative.endsWith('ago') ? ` · exp ${relative}` : ` · expires ${relative}`;
}

function integerField(
  value: string | undefined,
  label: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const input = value?.trim() ?? '';

  if (!input) return fallback;
  if (!/^\d{1,6}$/.test(input) || Number(input) < min || Number(input) > max)
    throw new ToolError(`${label} must be a whole number from ${min} to ${max}.`);

  return Number(input);
}
