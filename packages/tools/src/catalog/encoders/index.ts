import { ToolDefinition } from '@devtoolora/core';
import { base64EncodeTool, base64DecodeTool } from './base64-encode/tool';
import { urlEncodeTool, urlDecodeTool } from './url-encode/tool';
import { htmlEntitiesTool } from './html-entities/tool';
import { basicAuthTool } from './basic-auth/tool';
import { textBinaryTool } from './text-binary/tool';
import { unicodeEscapeTool } from './unicode-escape/tool';
import { hexTextTool } from './hex-text/tool';
import { asciiTextTool } from './ascii-text/tool';
import { caesarCipherTool } from './caesar-cipher/tool';
import { morseCodeTool } from './morse-code/tool';
import {
  ascii85EncodeTool,
  base32EncodeTool,
  base45EncodeTool,
  base58EncodeTool,
  baseNEncoderTool,
} from './base-n-encoder/tool';
import { unicodeNormalizerTool } from './unicode-normalizer/tool';
import { jsonStringEscapeTool, stringEscaperTool } from './string-escaper/tool';
import { punycodeConverterTool } from './punycode-converter/tool';
import { quotedPrintableTool } from './quoted-printable/tool';
import { unicodeInspectorTool } from './unicode-inspector/tool';
import { classicCiphersTool, vigenereCipherTool } from './classic-ciphers/tool';
import { natoPhoneticTool } from './nato-phonetic/tool';

export * from './base64-encode/tool';
export * from './url-encode/tool';
export * from './html-entities/tool';
export * from './basic-auth/tool';
export * from './text-binary/tool';
export * from './unicode-escape/tool';
export * from './hex-text/tool';
export * from './ascii-text/tool';
export * from './caesar-cipher/tool';
export * from './morse-code/tool';
export * from './base-n-encoder/tool';
export * from './unicode-normalizer/tool';
export * from './string-escaper/tool';
export * from './punycode-converter/tool';
export * from './quoted-printable/tool';
export * from './unicode-inspector/tool';
export * from './classic-ciphers/tool';
export * from './nato-phonetic/tool';

export const encoderTools: ToolDefinition[] = [
  base64EncodeTool,
  base64DecodeTool,
  urlEncodeTool,
  urlDecodeTool,
  htmlEntitiesTool,
  basicAuthTool,
  textBinaryTool,
  unicodeEscapeTool,
  hexTextTool,
  asciiTextTool,
  caesarCipherTool,
  morseCodeTool,
  baseNEncoderTool,
  base32EncodeTool,
  base58EncodeTool,
  base45EncodeTool,
  ascii85EncodeTool,
  unicodeNormalizerTool,
  stringEscaperTool,
  jsonStringEscapeTool,
  punycodeConverterTool,
  quotedPrintableTool,
  unicodeInspectorTool,
  classicCiphersTool,
  vigenereCipherTool,
  natoPhoneticTool,
];
