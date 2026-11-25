import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { decodeCsr, type CsrReport } from '@devtoolora/functions/crypto';
import { summarizeFindings } from '@devtoolora/functions/web';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, countLabel, jsonResultValue, pemSource } from '../shared';

const rsaSanCsr =
  '-----BEGIN CERTIFICATE REQUEST-----\nMIIC6DCCAdACAQAwPTEYMBYGA1UEAwwPYXBpLmV4YW1wbGUuY29tMRQwEgYDVQQK\nDAtEZXYgVG9vbG9yYTELMAkGA1UEBhMCVVMwggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQDF1CzDvW7DB29n46B+c5nHbzxq8YQrXuPEDmZgy2rKnqTWI0zf\nKVPxyVzr2XKfe0/UBOsvB22s8XdzhBARS+QNBjcapRyWYRTlK5ZCHl04x0ZFfuHb\nAWkly5mHW315Da6ZouMYto+2wbOgDqQAk6Yc8ECLERaDEZOsbg1eyj1X8Ud0S/Ip\nWurtq5wG6vommenNoUD4cnD6GAW7RhglTBk2CQ+xYNvUpoJjh+ouBGafc+4VkI6q\nkKUz11Pl0QAcc4nGuX8LbgwSrfZ/+xhNhB8soktdyAhdGGHglTdZGBiKQeXj8tjB\nV/7hcKDz2Vug1r+mgzhonsnqtyO1Zw/pe7L3AgMBAAGgZjBkBgkqhkiG9w0BCQ4x\nVzBVMDEGA1UdEQQqMCiCD2FwaS5leGFtcGxlLmNvbYIPd3d3LmV4YW1wbGUuY29t\nhwQKAAABMAsGA1UdDwQEAwIFoDATBgNVHSUEDDAKBggrBgEFBQcDATANBgkqhkiG\n9w0BAQsFAAOCAQEABurrRDDUcYBeDa0774YRIv6m5KL9saSHjE5i3OhLt274mT54\n332pRpYxk5FMXJV9GIcA3J3qCjPl3vvfGSh/PZ9F+Gf8JH/Hc6hvpdh/nK7Zpf71\nl6ge+jwy3GJbOTjkb6Uglptcx3YMj2TVakZ2IkQUHlsBNFovzdOb/rhpNEuX8BiD\nwm99qfBsqAhqMpOlJUG9Imv2y03SvI5RF9thyb5Vct13jNfcW6H4hqifeb2yNS8x\nrcMbsQY747auozWvYIvGNUD4HvaywWSIrnqELoY6Q3sAa0oaW66Q69KNwLstW33E\nIk9BZ4MHjGqH9s6/7aZhN1xo7+dUa1dEW3cDaQ==\n-----END CERTIFICATE REQUEST-----\n';
const ecPlainCsr =
  '-----BEGIN CERTIFICATE REQUEST-----\nMIHUMH0CAQAwGzEZMBcGA1UEAwwQZGV2LmV4YW1wbGUudGVzdDBZMBMGByqGSM49\nAgEGCCqGSM49AwEHA0IABK0t6y3lweSjFlZk2+udpwpdB3vuG2M/CrNs2hT2hgwT\nAp0Z3OSaGGJL6J0myRohOjtBX4ti1Vpa6E32zy92dhegADAKBggqhkjOPQQDAgNH\nADBEAiA/JWOjbzAqyuNoX4vh7htSaQShWGnAljkfA6hCU32lzwIgJ1RgUen144U5\nRPsLUhLSlWJN+pt8Pu3zAvoRQJXla2k=\n-----END CERTIFICATE REQUEST-----\n';
const challengeCsr =
  '-----BEGIN CERTIFICATE REQUEST-----\nMIIC5jCCAc4CAQAwaTEaMBgGA1UEAwwRdXRmOC5leGFtcGxlLnRlc3QxIzAhBgNV\nBAoMGsW9bHXFpW91xI1rw70ga8WvxYggcy5yLm8uMSYwDwYDVQQLDAhQbGF0Zm9y\nbTATBgoJkiaJk/IsZAEBDAVkZXY0MjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCC\nAQoCggEBAIZO0R714bbgwyfzB3e8Yit7mvFIOeKeQ/RshtlyLmovwvxTQfpuZwUc\ncBm5L9Dt1Hn0NA8yjzdLvBPhceos80vJ7upzDzUfbsU54BM2Ia/EXDscYEaGFOzH\nzQMuamkzQ+yqLGw4Z5I4XUe+hSG43a72fClu+EXmNVNGGngWLbeAaMptWzEhZSZe\n7033mB7J8LTI5IH3g8NYYFMUkMiDUiPoEbRnzks/ISEsAYsBAQLLI5HaJu8kuGBB\nGYz4h3At1qH784n1ypKq0qoN6ofTcivcFz7ROJ4TH4aX7Uip3Arv57KanmD56qF0\nGbVaz+brMBN2am02yplF1eVy/vV+2G0CAwEAAaA4MBYGCSqGSIb3DQEJBzEJDAdo\ndW50ZXIyMB4GCSqGSIb3DQEJAjERDA9EZXYgVG9vbG9yYSBsYWIwDQYJKoZIhvcN\nAQELBQADggEBACB+Z5Q2W9blBt7+oJlmhTVS57L70jBfE9sX6K2Pvpd+lypZvnSB\nsW30GtHMHgnhF7d7xlgxULJrNTO60irgUI5gXuCQ/Mia3xFgyuRW+7I0N9InmfKf\nW3v244lPraY0cP07LmfQ8ggB4CyEUIvmLL0bUgiHCqfVDwj0FrzlkNCAiS7vQOzW\nBZ3Lds4U1YWu0yfBVyH3bQBw7zqu8vsT3xJe7Mo80Wdas8NtDEoIvSIRP1mzIMvv\nH+XQooHkcNxK9w1+2kil+r2FLLGNP1MNJSU4WuowWZ0cJ0NMnRGvTxSPHYoBx82q\nWQkwjNB0wkXEY9DbV5nUM3q4GPHl6CQ6JJ8=\n-----END CERTIFICATE REQUEST-----\n';
const sha1Csr =
  '-----BEGIN CERTIFICATE REQUEST-----\nMIICYzCCAUsCAQAwHjEcMBoGA1UEAwwTbGVnYWN5LmV4YW1wbGUudGVzdDCCASIw\nDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANeEemGmVDN2UQ9j3ApYbI1Y3hNR\n3TK+QuXQKJwpdwnRpRf7puNVd2ctPMIr1dYp8wvgq7URkZ4/hM4T6M3WlyoT5jR0\nSMlY/wTJXPykZF8hvILvPS7O5aCr2R9NiWnqA9nVfVSlxYSkSC5gaNAtuec8PKD4\noM4KtT3TpsJx7pPPj60Nw7rn0iOUscjY9lWAeJBF1De3eNhf1i25wdXS50aW1Wp9\n9oPazmAFWTN67/fI4bRN/a6prh0LYAnOe3XfgJtg86Crkx2OwTwvMwElROZGI13u\nUNLgKMn1hc+w6Mxd7Qieb8WYyfnRAIgJFOoAkD10iz1RLfZlsef91m/NSZECAwEA\nAaAAMA0GCSqGSIb3DQEBBQUAA4IBAQBf/qoCgLp6aZop0ahKrRNTbyaUnsyrXCZI\nBbh0bRQ1DO9Q4xpiGyeb7Pgrtka+dPBea/LVXn3ESHLpP/LprtxEKMO2fON5D2Yz\nOK8QTdv1JxFiqOQER+61gaf3LIqQRBZOXVl3XE2Ie9fyCQNXoF6FbGWBUSfZX8tM\nrFUWwMFzKoVeYMgEAlKkW4mEbCmjHOxLi0wHpxjHJm0qqklYHYbLGSHBJQwzzAxr\n1wZjhu3JlA3LEfLz962fSjaXZP1f1cWQXNBDRnsbmhHK2B8hKa672pmBfNdOO6OA\nVDpy7S2Bd724rzzESUG6FuB++pDBdGzJGtI2fVdQlGO+Hlqs5R1x\n-----END CERTIFICATE REQUEST-----\n';
const newHeaderCsr =
  '-----BEGIN NEW CERTIFICATE REQUEST-----\nMIIC6DCCAdACAQAwPTEYMBYGA1UEAwwPYXBpLmV4YW1wbGUuY29tMRQwEgYDVQQK\nDAtEZXYgVG9vbG9yYTELMAkGA1UEBhMCVVMwggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQDF1CzDvW7DB29n46B+c5nHbzxq8YQrXuPEDmZgy2rKnqTWI0zf\nKVPxyVzr2XKfe0/UBOsvB22s8XdzhBARS+QNBjcapRyWYRTlK5ZCHl04x0ZFfuHb\nAWkly5mHW315Da6ZouMYto+2wbOgDqQAk6Yc8ECLERaDEZOsbg1eyj1X8Ud0S/Ip\nWurtq5wG6vommenNoUD4cnD6GAW7RhglTBk2CQ+xYNvUpoJjh+ouBGafc+4VkI6q\nkKUz11Pl0QAcc4nGuX8LbgwSrfZ/+xhNhB8soktdyAhdGGHglTdZGBiKQeXj8tjB\nV/7hcKDz2Vug1r+mgzhonsnqtyO1Zw/pe7L3AgMBAAGgZjBkBgkqhkiG9w0BCQ4x\nVzBVMDEGA1UdEQQqMCiCD2FwaS5leGFtcGxlLmNvbYIPd3d3LmV4YW1wbGUuY29t\nhwQKAAABMAsGA1UdDwQEAwIFoDATBgNVHSUEDDAKBggrBgEFBQcDATANBgkqhkiG\n9w0BAQsFAAOCAQEABurrRDDUcYBeDa0774YRIv6m5KL9saSHjE5i3OhLt274mT54\n332pRpYxk5FMXJV9GIcA3J3qCjPl3vvfGSh/PZ9F+Gf8JH/Hc6hvpdh/nK7Zpf71\nl6ge+jwy3GJbOTjkb6Uglptcx3YMj2TVakZ2IkQUHlsBNFovzdOb/rhpNEuX8BiD\nwm99qfBsqAhqMpOlJUG9Imv2y03SvI5RF9thyb5Vct13jNfcW6H4hqifeb2yNS8x\nrcMbsQY747auozWvYIvGNUD4HvaywWSIrnqELoY6Q3sAa0oaW66Q69KNwLstW33E\nIk9BZ4MHjGqH9s6/7aZhN1xo7+dUa1dEW3cDaQ==\n-----END NEW CERTIFICATE REQUEST-----\n';

export const csrDecoderTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Decode a PKCS#10 certificate signing request: subject, public key, requested SANs, key usage and extended key usage, with the self-signature verified and common problems flagged. Runs locally.',
  fields: [
    {
      accept: '.csr,.pem,.req',
      id: 'csrFile',
      label: 'CSR file',
      maxBytes: 1024 * 1024,
      type: 'file',
    },
  ],
  freshResults: true,
  id: 'csr-decoder',
  inputKind: 'optionalText',
  inputPresentation: {
    label: 'PEM certificate request',
    placeholder: 'Paste a -----BEGIN CERTIFICATE REQUEST----- block',
  },
  keywords: [
    'csr',
    'pkcs10',
    'certificate request',
    'certificate signing request',
    'san',
    'openssl req',
  ],
  name: 'CSR Decoder',
  outputKind: 'json',
  relatedToolIds: ['certificate-inspector', 'pem-key-inspector', 'certificate-chain-analyzer'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolErrorAsync(async () =>
      csrResult(await decodeCsr(pemSource(text, fields.csrFile, 'CSR'))),
    ),
  runRequires: [{ anyOf: ['$text', 'csrFile'] }],
  samples: [
    { fields: { csrFile: '' }, label: 'RSA with SANs and key usage', text: rsaSanCsr },
    { fields: { csrFile: '' }, label: 'EC P-256 without SANs', text: ecPlainCsr },
    { fields: { csrFile: '' }, label: 'UTF-8 subject and challengePassword', text: challengeCsr },
    { fields: { csrFile: '' }, label: 'Legacy SHA-1 signature', text: sha1Csr },
    { fields: { csrFile: '' }, label: 'NEW CERTIFICATE REQUEST header', text: newHeaderCsr },
    {
      fields: { csrFile: '' },
      label: 'With a leading comment line',
      text: `# generated with openssl req -new\n${rsaSanCsr}`,
    },
  ],
  supportsSelection: true,
};

function csrResult(report: CsrReport): ToolResult {
  const commonName = report.subjectAttributes.find((attribute) => attribute.name === 'CN');
  const { algorithm, details } = report.publicKey;
  const key =
    algorithm === 'RSA'
      ? `RSA ${details.bits}-bit`
      : [algorithm ?? 'unknown key', details.curve].filter(Boolean).join(' ');
  const signature =
    report.signatureValid === 'not verified'
      ? 'signature not verified'
      : `signature ${report.signatureValid ? 'valid' : 'invalid'}`;
  const summary = [
    'CSR',
    commonName ? `CN=${commonName.value}` : 'no CN',
    key,
    countLabel(report.extensions.subjectAltNames.length, 'SAN'),
    signature,
    summarizeFindings(report.findings),
  ].join(' · ');

  return jsonResultValue(report, summary, 'csr');
}
