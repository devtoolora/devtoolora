import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  {
    alert: /1,048,576/,
    id: 'aes-encrypt',
    name: 'AES Encrypt & Decrypt',
    oversizeInput: 1_048_577,
  },
  {
    alert: /between 1 and 10,000,000/,
    fields: [{ kind: 'number', label: /^Iterations/, value: '0' }],
    id: 'pbkdf2',
    inputless: true,
    name: 'PBKDF2 Key Derivation',
  },
  {
    fields: [{ kind: 'select', label: /^Algorithm/, value: 'Ed25519' }],
    id: 'key-pair-generator',
    inputless: true,
    name: 'Key Pair Generator',
    result: /BEGIN PRIVATE KEY/,
  },
  {
    id: 'ssh-key-generator',
    inputless: true,
    name: 'SSH Key Pair Generator',
    result: /ssh-ed25519 /,
  },
  { alert: /Base32/, id: 'totp', invalidText: '!!!', name: 'TOTP Generator & Validator' },
  { alert: /Paste a JWK/, id: 'jwk-to-pem', invalidText: 'hello', name: 'JWK ↔ PEM Converter' },
  { alert: /1,048,576/, id: 'checksum', name: 'Checksum Calculator', oversizeInput: 1_048_577 },
  {
    alert: /1,024/,
    id: 'bip39',
    name: 'BIP39 Mnemonic Generator & Validator',
    oversizeInput: 1_025,
  },
  {
    alert: /five dice digits/,
    id: 'diceware',
    invalidText: '1234',
    name: 'Diceware Passphrase Generator',
  },
  { alert: /CERTIFICATE REQUEST/, id: 'csr-decoder', invalidText: 'hello', name: 'CSR Decoder' },
];

defineToolSmokeTests('Crypto and keys', tools);
