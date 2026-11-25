import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { numericField } from '../../adapters/fields';
import type { TokenOptions } from '@devtoolora/functions/crypto';
import { base64Decode, bytesToUtf8 } from '@devtoolora/functions/binary';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { processJsonDocument } from '@devtoolora/functions/format';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export function tokenOptions(fields: Record<string, string>): TokenOptions {
  if (fields.mode !== undefined && fields.mode !== 'bytes' && fields.mode !== 'custom')
    throw new ToolError('Choose custom alphabet or encoded bytes mode.');
  if (
    fields.mode === 'bytes' &&
    fields.encoding !== undefined &&
    !['hex', 'base64', 'base64url'].includes(fields.encoding)
  )
    throw new ToolError('Choose hex, base64 or base64url encoding.');

  return fields.mode === 'bytes'
    ? {
        mode: 'bytes',
        count: clampCount(fields.count),
        byteCount: numericField(fields.bytes, 'Bytes', 1, 256, 32),
        encoding:
          fields.encoding === 'base64' || fields.encoding === 'base64url' ? fields.encoding : 'hex',
      }
    : {
        mode: 'custom',
        count: clampCount(fields.count),
        length: numericField(fields.length, 'Length', 1, 512, 32),
        lowercase: groupFlag(fields.lowercase, true),
        uppercase: groupFlag(fields.uppercase, true),
        numbers: groupFlag(fields.numbers, true),
        symbols: groupFlag(fields.symbols, false),
      };
}

export function algorithmName(algorithm: string): string {
  return (
    (
      {
        md5: 'MD5',
        sha1: 'SHA-1',
        sha256: 'SHA-256',
        sha384: 'SHA-384',
        sha512: 'SHA-512',
      } as Record<string, string>
    )[algorithm] ?? algorithm.toUpperCase()
  );
}

export function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

export function clampCount(value: string | undefined): number {
  return numericField(value, 'Count', 1, 100, 1);
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ToolError(`${label} input is required.`);
  }

  return trimmed;
}

function groupFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value !== 'true' && value !== 'false')
    throw new ToolError('Character group flags must be true or false.');

  return value === 'true';
}

export function cryptoTextResult(id: string, text: string, summary: string): ToolResult {
  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName: `${id}.txt`,
      mimeType: 'text/plain;charset=utf-8',
    },
    language: 'plaintext',
    summary,
    text,
  };
}

export function pemSource(text: string, fileData: string | undefined, label: string): string {
  if (fileData?.trim()) {
    const match = fileData.match(/^data:[^;]+;base64,(.+)$/);

    if (!match) throw new ToolError(`${label} file data is invalid.`);

    let bytes: Uint8Array;

    try {
      bytes = base64Decode(match[1]!);
    } catch {
      throw new ToolError(`${label} file data is invalid.`);
    }

    if (bytes.length > 1024 * 1024) throw new ToolError('PEM file must be no larger than 1 MiB.');

    return bytesToUtf8(bytes);
  }

  return requireText(text, label);
}

export function jsonResultValue(value: unknown, summary: string, id: string): ToolResult {
  const text = JSON.stringify(value, null, 2);

  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName: `${id}.json`,
      mimeType: 'application/json;charset=utf-8',
    },
    jsonTree: { nodes: processJsonDocument(text, { collectTree: true, mode: 'minify' }).nodes },
    text,
    language: 'json',
    summary,
  };
}

export const demoChain =
  '-----BEGIN CERTIFICATE-----\nMIIDqjCCApKgAwIBAgIUbnNxtt+TJrVPfC5PHYXh2PpfIlQwDQYJKoZIhvcNAQEL\nBQAwQzEeMBwGA1UEAwwVRGV2IFRvb2xvcmEgRGVtbyBSb290MRQwEgYDVQQKDAtE\nZXYgVG9vbG9yYTELMAkGA1UEBhMCVVMwHhcNMjYxMTA4MTI1NDM2WhcNMzYxMTA1\nMTI1NDM2WjA8MRcwFQYDVQQDDA5hcGkubG9jYWwudGVzdDEUMBIGA1UECgwLRGV2\nIFRvb2xvcmExCzAJBgNVBAYTAlVTMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB\nCgKCAQEAsiVUmQM3aFrB47xmje5jIoFLkFPO8VVk+hzYtZb4DAGpVWFED5of4Scj\nUMJlw5trq+G7QV0oc0Z3VWVIY2jwp5uJwECsktcstImW/CRb1ZLsWScGXr6XrlaX\nI4m76sS1kbQzRvBJYCQ4MOJBUFpukr/PUmXrRKVvbpmqShx+JHNHmTLF3vXBD9zI\nFyr/n6Gi6r7r0FPkqZv3mOtP0vSl3plYhBNafx9GCxj9GkXKGYlImi3ESk67am34\n6AcuBjQn16LmI2wkaDeX93o4hNgoxBa2LRXsZWGolL73d6/FCyMrNe25SZ/ueZIV\nCa7uN2mf/EVTQwqSCrOjxZQ/2LAaZQIDAQABo4GcMIGZMAwGA1UdEwEB/wQCMAAw\nDgYDVR0PAQH/BAQDAgWgMBMGA1UdJQQMMAoGCCsGAQUFBwMBMCQGA1UdEQQdMBuC\nDmFwaS5sb2NhbC50ZXN0gglsb2NhbGhvc3QwHQYDVR0OBBYEFOMy0BuXIZnSbpWo\nFZLllWs97E3nMB8GA1UdIwQYMBaAFLThud6PBk+f8Sas/korbzNIu3qKMA0GCSqG\nSIb3DQEBCwUAA4IBAQCiXo8ooVd+ZoNsEKUDo7G3DkicuHZovU8gBdBaiGuAKBhG\nat44kCX0FkK3+5PGtgQtHVBvdBUAE38r6W98AJqzGTj56djwkDXPy7R4diwAzl7v\n+4xMaA7BdFPhkJTee/Lh/shytPGcMwNo9yhBAoE6r6xIWSjS3jlnNPrMsxfaLhn6\n7xFQOf06Q50x/1Z/v0sZ8xnwk5pO+dB9eDlnz8xsapXUp4uZ+hscXU06vapjaj2a\nIsnxL550wsMISTRQZpamu1z8QE9jgLyL83le3tkuxKfE87ajW2uNY7pWe7ENuQNH\n78RUNFS60zh2zWBsd5xh189SZVFv5kV6uGQOeRko\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIIDdzCCAl+gAwIBAgIURJhpiYHPwF7TqOSochLNVtXcVgYwDQYJKoZIhvcNAQEL\nBQAwQzEeMBwGA1UEAwwVRGV2IFRvb2xvcmEgRGVtbyBSb290MRQwEgYDVQQKDAtE\nZXYgVG9vbG9yYTELMAkGA1UEBhMCVVMwHhcNMjYxMTA4MTI1NDM2WhcNMzYxMTA1\nMTI1NDM2WjBDMR4wHAYDVQQDDBVEZXYgVG9vbG9yYSBEZW1vIFJvb3QxFDASBgNV\nBAoMC0RldiBUb29sb3JhMQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQAD\nggEPADCCAQoCggEBAOWC4QWYo6ikhiWcMTiriyKPpXDQrhGGqsf5u7575gby6tI3\nHw3DhjTiI8RTViC4JVjEdA9yuwqGg2g5js25aW2M/cNBeCUHsu00FES0mDPUtfRK\nNgNoV9paKiptyzlDSEJh4Ni9WnbWp/PELeUjiy6kJmOY99v/yPwKLgFLvMRwjKLF\nbTjI9pTI1xXQUbZ4sfs0H6iv6El2j5ccm/IDvd6feILaC0lCyyOuF4TTqqkH8FnG\njXk/RlIcis6z1NJSixoxl4LX060RT3XyKMy2WytC/mRRQBqipgRrSkE5DOFINsyc\nubQcRF/N2/kAXXEIGXTSBzGwh3qaw5kYUxph1S8CAwEAAaNjMGEwHQYDVR0OBBYE\nFLThud6PBk+f8Sas/korbzNIu3qKMB8GA1UdIwQYMBaAFLThud6PBk+f8Sas/kor\nbzNIu3qKMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMA0GCSqGSIb3\nDQEBCwUAA4IBAQBWUmtvjiYNYkL0+0Lu+tQgLhh/k5l4WhjL+sgtE2sMt9nTTqPY\n7HQ36AH0jqA/RBZPvl6UcxX7jC4hmgiSXR3UUtrf+Jd/b8HZfJNagL2FCqnSWShA\nVEkYzM7XDnqEbqsCGnehNKOR493LHKFdg6ac5pwgIKzx2ihUtxAGuvH+w3mh1zUC\nLrjZu205iuD1JXt+6oP6TV9S/Onr2h244QnVQbkowpCLZlONxxEIYpDoyj4Kxf4t\nj5A3ya40F6xsDyZ8B14vlLaY3fmrXNffk5tXitVDY3Hnj9aEY3GRtzDHklSm6nSN\n5AGPluD063QJeIi5/S6KuAjnzdsB2M2rEwqI\n-----END CERTIFICATE-----\n';
export const demoCertificates =
  demoChain.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
export const demoLeaf = demoCertificates[0] ?? '';
export const demoRoot = demoCertificates[1] ?? '';
