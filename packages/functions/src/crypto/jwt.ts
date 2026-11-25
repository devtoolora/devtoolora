import { utf8Bytes } from '../binary';
import { stringifyExactJson } from '../format/json';
import {
  inferJwtAlgorithm,
  isJwtAlgorithm,
  jwtAlgorithms,
  jwtKeyWarnings,
  jwtSignatureBytes,
  parseJwtKey,
  signJwtBytes,
  verifyJwtBytes,
  type JwtAlgorithm,
  type JwtSecretEncoding,
} from './jwtKeys';
import {
  base64UrlBytes,
  base64UrlText,
  describeTimes,
  headerWarnings,
  jwtError,
  parseHeaderJson,
  parsePayload,
  parseToken,
  signatureStatus,
  withoutAlgorithm,
  type ParsedToken,
} from './jwtParse';

export { jwtAlgorithms } from './jwtKeys';
export type { JwtAlgorithm, JwtSecretEncoding } from './jwtKeys';

export type JwtTiming = 'expired' | 'not yet valid' | 'valid';

export type DecodedJwt = {
  header: Record<string, unknown>;
  payload: unknown;
  signature: string;
  times: Record<string, string>;
  timing?: JwtTiming;
  warnings: string[];
};

export type JwtVerification = {
  algorithm: string;
  header: Record<string, unknown>;
  key: string;
  payload: unknown;
  reason?: string;
  signature: 'invalid' | 'valid';
  times: Record<string, string>;
  timing?: JwtTiming;
  valid: boolean;
  warnings: string[];
};

export type SignedJwt = {
  algorithm: JwtAlgorithm;
  header: Record<string, unknown>;
  key: string;
  payload: Record<string, unknown>;
  token: string;
  warnings: string[];
};

export type JwtTimeOptions = {
  clockToleranceSeconds?: number;
  nowSeconds?: number;
};

export type JwtKeyOptions = {
  algorithm?: 'auto' | JwtAlgorithm;
  secretEncoding?: JwtSecretEncoding;
};

const maxDurationSeconds = 100 * 365 * 86_400;

export function decodeJwt(token: string, options: JwtTimeOptions = {}): DecodedJwt {
  const parsed = parseToken(token);

  if (parsed.encrypted) {
    const enc = typeof parsed.header.enc === 'string' ? `, enc ${parsed.header.enc}` : '';

    return {
      header: parsed.header,
      payload: null,
      signature: 'not applicable (encrypted token)',
      times: {},
      warnings: [
        `This is an encrypted JWE (5 segments${enc}). Only its header is readable; the payload needs the recipient's key, and this tool does not decrypt.`,
        ...parsed.warnings,
      ],
    };
  }

  const time = describeTimes(parsed.payload, options);

  return {
    header: parsed.header,
    payload: parsed.payload,
    signature: signatureStatus(parsed),
    times: time.times,
    ...(time.timing ? { timing: time.timing } : {}),
    warnings: [...headerWarnings(parsed.header), ...parsed.warnings, ...time.warnings],
  };
}

export async function verifyJwt(
  token: string,
  keySource: string,
  options: JwtTimeOptions & JwtKeyOptions = {},
): Promise<JwtVerification> {
  const parsed = parseToken(token);

  if (parsed.encrypted)
    throw jwtError('This is an encrypted JWE, not a signed JWT, so it has no signature to verify.');
  if (parsed.segments.length !== 3)
    throw jwtError('Verification needs all three segments: header.payload.signature.');

  const headerAlgorithm = parsed.header.alg;
  const expected =
    options.algorithm && options.algorithm !== 'auto' ? options.algorithm : undefined;
  const time = describeTimes(parsed.payload, options);
  const result = (
    signature: 'invalid' | 'valid',
    algorithm: string,
    key: string,
    reason?: string,
    keyWarnings: string[] = [],
  ) => verificationResult(parsed, time, { algorithm, key, keyWarnings, reason, signature });

  if (headerAlgorithm === 'none')
    return result(
      'invalid',
      'none',
      'not used',
      'Unsigned tokens (alg "none") are never accepted.',
    );

  assertVerifiableAlgorithm(headerAlgorithm, expected);

  const algorithm = expected ?? (headerAlgorithm as JwtAlgorithm);
  const key = parseJwtKey(keySource, {
    kid: parsed.header.kid,
    secretEncoding: options.secretEncoding,
  });

  if (expected && headerAlgorithm !== expected) {
    return result(
      'invalid',
      expected,
      key.description,
      `The header says ${headerAlgorithm}, but ${expected} was expected. Accepting the header's choice is how algorithm-substitution attacks work.`,
    );
  }

  const keyWarnings = [
    ...jwtKeyWarnings(key, algorithm),
    ...keyIdWarnings(key.jwk?.kid, parsed.header.kid),
  ];
  const rejection = critReason(parsed.header) ?? signatureLengthReason(parsed.signature, algorithm);

  if (rejection) return result('invalid', algorithm, key.description, rejection, keyWarnings);

  const signingInput = utf8Bytes(`${parsed.segments[0]}.${parsed.segments[1]}`);
  const valid = await verifyJwtBytes(key, algorithm, signingInput, parsed.signature);

  return result(
    valid ? 'valid' : 'invalid',
    algorithm,
    key.description,
    valid
      ? undefined
      : 'The signature does not match this key. Check the key, the secret encoding and that the token was not edited.',
    keyWarnings,
  );
}

type VerificationOutcome = {
  algorithm: string;
  key: string;
  keyWarnings: string[];
  reason?: string;
  signature: 'invalid' | 'valid';
};

function verificationResult(
  parsed: ParsedToken,
  time: ReturnType<typeof describeTimes>,
  outcome: VerificationOutcome,
): JwtVerification {
  const { algorithm, key, keyWarnings, reason, signature } = outcome;

  return {
    valid:
      signature === 'valid' &&
      !time.hasMalformedTime &&
      time.timing !== 'expired' &&
      time.timing !== 'not yet valid',
    signature,
    ...(time.timing ? { timing: time.timing } : {}),
    algorithm,
    key,
    ...(reason ? { reason } : {}),
    header: parsed.header,
    payload: parsed.payload,
    times: time.times,
    warnings: [
      ...headerWarnings(parsed.header),
      ...parsed.warnings,
      ...keyWarnings,
      ...time.warnings,
    ],
  };
}

function assertVerifiableAlgorithm(headerAlgorithm: unknown, expected: JwtAlgorithm | undefined) {
  if (typeof headerAlgorithm !== 'string' || !headerAlgorithm)
    throw jwtError(
      'The header has no alg, so the signature algorithm is unknown. Choose one under Algorithm.',
    );
  if (!expected && !isJwtAlgorithm(headerAlgorithm))
    throw jwtError(
      `Header alg "${headerAlgorithm}" is not supported. Supported: ${jwtAlgorithms.join(', ')}.`,
    );
}

function keyIdWarnings(keyKid: unknown, tokenKid: unknown) {
  return typeof keyKid === 'string' && typeof tokenKid === 'string' && keyKid !== tokenKid
    ? [`The key's kid "${keyKid}" differs from the token's kid "${tokenKid}".`]
    : [];
}

// RFC 7515 §4.1.11: this tool understands no extension, so it must reject any crit.
function critReason(header: Record<string, unknown>) {
  return header.crit === undefined
    ? undefined
    : 'The header has crit, and this tool processes no critical extensions, so RFC 7515 requires rejecting the token.';
}

function signatureLengthReason(signature: Uint8Array, algorithm: JwtAlgorithm) {
  const expectedBytes = jwtSignatureBytes(algorithm);

  if (expectedBytes === undefined || signature.length === expectedBytes) return undefined;

  const hint =
    signature.length > expectedBytes - 4 && signature[0] === 0x30
      ? ', probably DER-encoded instead of raw R||S'
      : '';

  return `${algorithm} signatures are ${expectedBytes} bytes; this one is ${signature.length}${hint}.`;
}

export async function signJwt(
  payloadText: string,
  keySource: string,
  options: JwtKeyOptions & {
    expiresIn?: string;
    header?: string;
    issuedAt?: boolean;
    nowSeconds?: number;
  } = {},
): Promise<SignedJwt> {
  const { value: payload, warnings: payloadWarnings } = parsePayload(payloadText);
  const { value: extraHeader, warnings: headerJsonWarnings } = parseHeaderJson(
    options.header ?? '',
  );
  const key = parseJwtKey(keySource, {
    kid: extraHeader.kid,
    secretEncoding: options.secretEncoding,
  });
  const requested =
    options.algorithm && options.algorithm !== 'auto' ? options.algorithm : undefined;
  const headerAlgorithm = extraHeader.alg;

  if (headerAlgorithm === 'none')
    throw jwtError(
      'Unsigned tokens (alg "none") are not created here; choose a signing algorithm.',
    );
  if (headerAlgorithm !== undefined && !isJwtAlgorithm(headerAlgorithm))
    throw jwtError(
      `Header alg "${String(headerAlgorithm)}" is not supported. Supported: ${jwtAlgorithms.join(', ')}.`,
    );
  if (requested && headerAlgorithm !== undefined && headerAlgorithm !== requested)
    throw jwtError(
      `The header JSON says ${headerAlgorithm}, but ${requested} is selected. Remove alg from the header or choose ${headerAlgorithm}.`,
    );

  const algorithm =
    requested ?? (headerAlgorithm as JwtAlgorithm | undefined) ?? inferJwtAlgorithm(key);
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (options.issuedAt) payload.iat = now;

  const duration = options.expiresIn?.trim() ? parseJwtDuration(options.expiresIn) : undefined;

  if (duration !== undefined)
    payload.exp = (typeof payload.iat === 'number' ? payload.iat : now) + duration;

  const kid = key.jwk?.kid;
  const header: Record<string, unknown> = {
    alg: algorithm,
    typ: 'JWT',
    ...withoutAlgorithm(extraHeader),
    ...(typeof kid === 'string' && kid && extraHeader.kid === undefined ? { kid } : {}),
  };
  const signingInput = `${base64UrlText(stringifyExactJson(header))}.${base64UrlText(stringifyExactJson(payload))}`;
  const signature = await signJwtBytes(key, algorithm, utf8Bytes(signingInput));

  return {
    algorithm,
    header,
    key: key.description,
    payload,
    token: `${signingInput}.${base64UrlBytes(signature)}`,
    warnings: [...payloadWarnings, ...headerJsonWarnings, ...jwtKeyWarnings(key, algorithm)],
  };
}

export function parseJwtDuration(value: string): number {
  const input = value.trim().toLowerCase();
  const units: Record<string, number> = {
    d: 86_400,
    h: 3600,
    m: 60,
    s: 1,
    w: 604_800,
    y: 31_536_000,
  };
  let seconds = 0;

  if (/^\d+$/.test(input)) seconds = Number(input);
  else if (/^(?:\d+\s*[smhdwy]\s*)+$/.test(input)) {
    for (const match of input.matchAll(/(\d+)\s*([smhdwy])/g)) {
      const factor = units[match[2]!];

      if (factor === undefined)
        throw jwtError('Expires in must be seconds or a duration such as 15m, 1h30m, 7d or 2w.');

      seconds += Number(match[1]) * factor;
    }
  } else throw jwtError('Expires in must be seconds or a duration such as 15m, 1h30m, 7d or 2w.');
  if (seconds <= 0 || seconds > maxDurationSeconds)
    throw jwtError('Expires in must be between 1 second and 100 years.');

  return seconds;
}
