import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A key pair is a private key you keep secret and a public key you share. Whatever the private key signs, the public key can verify, and nobody can forge a signature without the private key.',
        'This tool generates RSA (2048, 3072 or 4096 bits), ECDSA (P-256, P-384 or P-521) and Ed25519 pairs with the Web Crypto API. You can export them as PEM (PKCS#8 private key, SPKI public key) or as JSON Web Keys.',
        'Keys are generated in your browser and are never uploaded. They are not saved anywhere, so copy or save the result before you leave.',
      ],
      title: 'What is a key pair generator?',
    },
    {
      content: [
        'Create a signing key for JWTs, for example RS256, ES256 or EdDSA, and paste it into a JWT tool or your configuration.',
        'Make throwaway keys for tests, fixtures and local development.',
        'Inspect or convert one key later: paste a single PEM block into the PEM Key Inspector, or a single PEM block or JWK into the JWK ↔ PEM Converter. JWK output is ready for a JWKS document. Do not use generated keys for production secrets you cannot rotate.',
      ],
      title: 'When to use Key Pair Generator',
    },
  ],
  examples: [
    'RSA 2048 as PEM → a -----BEGIN PRIVATE KEY----- block followed by a -----BEGIN PUBLIC KEY----- block.',
    'RSA 3072 as JWK → kty RSA with n, e (AQAB), d, p, q, dp, dq and qi in the private key.',
    'ECDSA P-256 as PEM → a short key suited to ES256 JWTs.',
    'ECDSA P-384 as JWK → kty EC, crv P-384, with x and y (and d for the private key).',
    'Ed25519 as PEM → the smallest PEM pair, used for EdDSA signatures.',
    'Ed25519 as JWK → kty OKP, crv Ed25519, with x and d.',
  ],
  faq: [
    {
      answer:
        'Ed25519 or ECDSA P-256 are small, fast and widely supported. Use RSA 2048 or 3072 when a system only accepts RSA. RSA 4096 is slower to generate and rarely needed.',
      question: 'Which algorithm should I choose?',
    },
    {
      answer:
        'No. Keys are created by the Web Crypto API in your browser. Nothing is uploaded and nothing is kept after you close the page, so save the private key somewhere safe.',
      question: 'Are my keys sent or stored anywhere?',
    },
    {
      answer:
        'Older browsers do not support Ed25519 in Web Crypto. The tool then reports that this browser cannot generate Ed25519 keys; pick RSA or ECDSA instead.',
      question: 'Why does Ed25519 fail in my browser?',
    },
    {
      answer:
        'PEM is the text format used by OpenSSL, SSH tooling and most servers. JWK is JSON, used by JWT, JWKS and Web Crypto. Both describe the same key, so pick whichever your consumer needs.',
      question: 'Should I export PEM or JWK?',
    },
  ],
  help: 'Choose the algorithm: RSA, ECDSA or Ed25519.\n\nFor RSA pick the key size, for ECDSA pick the curve.\n\nChoose PEM or JWK as the output format and run the tool.\n\nCopy or save the result. The private key comes first, then the public key.',
  notes: [
    'Private keys are exported as unencrypted PKCS#8 PEM and public keys as SPKI PEM.',
    'JWK output lists privateKey and publicKey objects; alg, ext and key_ops are removed so the keys work with any consumer.',
    'RSA keys use the RSASSA-PKCS1-v1_5 algorithm with SHA-256 and the public exponent 65537 (AQAB).',
    'ECDSA keys support the NIST curves P-256, P-384 and P-521.',
    'RSA 4096 can take several seconds, so the tool does not run automatically: press Run.',
    'Ed25519 needs a recent browser; if it is missing the tool says so and you can pick RSA or ECDSA.',
    'Every run creates a new pair, so results change each time.',
  ],
};
