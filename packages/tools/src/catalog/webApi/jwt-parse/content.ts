import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A JSON Web Token (JWT, RFC 7519) is three Base64URL segments joined by dots: a header that names the algorithm, a payload of claims such as sub, iss and exp, and a signature. Anyone can decode the first two segments; only the signature proves who issued the token and that nobody changed it.\n\nDecode shows the header, the claims and readable times. Verify checks the signature with an HMAC secret, a PEM public key or certificate, a JWK or a whole JWKS, and checks exp and nbf against the clock. Sign creates a new token from claims JSON.\n\nSupported algorithms are HS256, HS384, HS512, RS256, RS384, RS512, PS256, PS384, PS512, ES256, ES384, ES512 and EdDSA with Ed25519. Encrypted JWE tokens show their header only.',
      title: 'What is a JWT?',
    },
    {
      content: [
        'Read what an access or ID token claims when an API answers 401 or 403: audience, scopes, issuer and expiry.',
        'Confirm that a token verifies against your identity provider’s JWKS before you debug your middleware.',
        'Create test tokens for local development with a short expiry, a kid and the algorithm your API expects.',
      ],
      title: 'When to use JWT Debugger',
    },
    {
      content: [
        'valid is true only when the signature matches and the token is inside its exp and nbf window, allowing for the clock tolerance. signature and timing say which check failed, and reason explains a failed signature.',
        'times lists iat, nbf, exp and auth_time in UTC ISO 8601 with a relative time, so 1760000000 reads as 2025-10-09T08:53:20Z.',
        'warnings flag unsigned alg "none" tokens, a missing exp, millisecond timestamps, short HMAC secrets, small RSA keys and kid mismatches.',
      ],
      title: 'Reading the result',
    },
  ],
  examples: [
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.… → header {"alg":"HS256"}, payload {"sub":"1"}, signature not verified.',
    'Verify with the matching secret → valid: true, signature: "valid", key: "HMAC secret · 38 bytes from UTF-8 text".',
    'Verify with a JWKS from /.well-known/jwks.json → the key whose kid matches the token header is used.',
    'An HS256 token checked against an RSA public key → refused as an algorithm-confusion attempt.',
    'exp: 1700003600 → "2023-11-14T23:13:20Z (… ago)" and timing: "expired", so valid is false even with a correct signature.',
    'Sign {"sub":"user_1"} with Set iat and Expires in 15m → iat is now and exp is 900 seconds later.',
    'Bearer eyJ… or Authorization: Bearer eyJ… → the prefix is removed before decoding.',
  ],
  faq: [
    {
      answer:
        'No. Decode only reads the Base64URL header and payload, and the summary says the signature was not verified. Choose Verify and enter the secret, public key, certificate, JWK or JWKS to check it.',
      question: 'Does decoding a JWT verify its signature?',
    },
    {
      answer:
        'The token, secret and key are processed on your device with Web Crypto, and the debugger makes no network request. A live token is still a credential, so prefer test or expired tokens and clear the field when you are done.',
      question: 'Is it safe to paste a production token here?',
    },
    {
      answer:
        'No, it never downloads keys. Open your provider’s jwks_uri, often /.well-known/jwks.json, and paste the JSON: the key whose kid matches the token header is used, or the only signing key when the token has no kid.',
      question: 'Can it fetch the JWKS from my identity provider?',
    },
    {
      answer:
        'valid also requires the token to be inside its exp and nbf window. An expired token reports signature "valid" with timing "expired"; if the clocks only differ by a few seconds, raise Clock tolerance.',
      question: 'Why is valid false when the signature is valid?',
    },
    {
      answer:
        'HS256, HS384 and HS512 accept only a shared secret, because treating a public key as an HMAC secret is the algorithm-confusion attack. Enter the secret the issuer signed with, and set Secret encoding if it is Base64 or hex.',
      question: 'Why is my HS256 token refused when I paste a public key?',
    },
    {
      answer:
        'No. A five-segment JWE shows only its header, with a warning that the payload needs the recipient’s key. There is no decryption, and Verify refuses it because a JWE has no signature.',
      question: 'Can it decrypt an encrypted JWE token?',
    },
  ],
  help: 'Choose Decode, Verify or Sign. For Decode and Verify, paste a JWT, with or without a Bearer prefix; for Sign, enter the claims as JSON. Results update as you type.\n\nFor Verify, enter the HMAC secret, PEM public key, certificate, JWK or JWKS. Algorithm Auto takes the algorithm from the token header; choose one to require it. Set Secret encoding when the secret is Base64 or hex.\n\nFor Sign, enter an HMAC secret or a private key as PEM or JWK; Auto picks the algorithm from the key. Optionally add header parameters such as kid, Set iat and Expires in.\n\nCopy the result. Decoded and verified tokens are shown as a JSON tree; a signed token is plain text, ready for an Authorization: Bearer header.',
  notes: [
    'Everything runs locally with Web Crypto. Tokens, secrets and keys are not uploaded, and the key field is not saved in drafts.',
    'Decoding is not verification: anyone can write any claims into a token. Trust the claims only after Verify reports valid.',
    'Auto follows the header alg only with a matching key type. An HS256 header with a public key is refused, which blocks the classic algorithm-confusion attack; choose the algorithm to pin it.',
    'Tokens with alg "none" are never valid, and Sign does not create them. A token with a crit header is never valid either, because this tool processes no critical extensions (RFC 7515).',
    'Numbers a double cannot hold, such as 12345678901234567890, keep their exact digits: Sign puts them in the signed token, and Decode and Verify show them as the token holds them. Sign stops on a number such as 1e400 or 1e-400. A duplicate key keeps its last value, with a warning.',
    'Verifying with a private key works too: its public half is derived locally.',
    'RFC 7518 asks for HMAC secrets at least as long as the hash: 32 bytes for HS256, 48 for HS384 and 64 for HS512. Shorter secrets still verify, with a warning.',
    'Keys can be PEM PUBLIC KEY, RSA PUBLIC KEY, CERTIFICATE (the first one in a chain), PRIVATE KEY, RSA PRIVATE KEY or EC PRIVATE KEY, a JWK or a JWKS. Encrypted private keys, OpenSSH keys, ES256K and Ed448 are not supported.',
    'Claims such as iss, aud and scope are shown but not checked; compare them with what your API expects.',
  ],
};
