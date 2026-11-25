import { ToolDefinition } from '@devtoolora/core';
import { hashTool } from './hash/tool';
import { hmacTool } from './hmac/tool';
import { uuidTool } from './uuid/tool';
import { ulidTool } from './ulid/tool';
import { randomTokenTool } from './random-token/tool';
import { passwordGeneratorTool } from './password-generator/tool';
import { passwordStrengthTool } from './password-strength/tool';
import { certificateInspectorTool } from './certificate-inspector/tool';
import { certificateChainAnalyzerTool } from './certificate-chain-analyzer/tool';
import { pemKeyInspectorTool } from './pem-key-inspector/tool';
import { aesDecryptTool, aesEncryptTool } from './aes-encrypt/tool';
import { pbkdf2Tool } from './pbkdf2/tool';
import { keyPairGeneratorTool } from './key-pair-generator/tool';
import { sshKeyGeneratorTool } from './ssh-key-generator/tool';
import { totpTool } from './totp/tool';
import { jwkToPemTool, pemToJwkTool } from './jwk-to-pem/tool';
import { checksumTool, crc32Tool } from './checksum/tool';
import { bip39Tool } from './bip39/tool';
import { dicewareTool } from './diceware/tool';
import { csrDecoderTool } from './csr-decoder/tool';
import { argon2HashTool } from './argon2-hash/tool';
import { bcryptHashTool } from './bcrypt-hash/tool';

export * from './hash/tool';
export * from './hmac/tool';
export * from './uuid/tool';
export * from './ulid/tool';
export * from './random-token/tool';
export * from './password-generator/tool';
export * from './password-strength/tool';
export * from './certificate-inspector/tool';
export * from './certificate-chain-analyzer/tool';
export * from './pem-key-inspector/tool';
export * from './aes-encrypt/tool';
export * from './pbkdf2/tool';
export * from './key-pair-generator/tool';
export * from './ssh-key-generator/tool';
export * from './totp/tool';
export * from './jwk-to-pem/tool';
export * from './checksum/tool';
export * from './bip39/tool';
export * from './diceware/tool';
export * from './csr-decoder/tool';
export * from './argon2-hash/tool';
export * from './bcrypt-hash/tool';

export const browserCryptoTools: ToolDefinition[] = [
  hashTool,
  hmacTool,
  uuidTool,
  ulidTool,
  randomTokenTool,
  passwordGeneratorTool,
  passwordStrengthTool,
  certificateInspectorTool,
  certificateChainAnalyzerTool,
  pemKeyInspectorTool,
  aesEncryptTool,
  aesDecryptTool,
  pbkdf2Tool,
  keyPairGeneratorTool,
  sshKeyGeneratorTool,
  totpTool,
  jwkToPemTool,
  pemToJwkTool,
  checksumTool,
  crc32Tool,
  bip39Tool,
  dicewareTool,
  csrDecoderTool,
  bcryptHashTool,
  argon2HashTool,
];
