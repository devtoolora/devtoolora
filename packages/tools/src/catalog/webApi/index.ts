import { ToolDefinition } from '@devtoolora/core';
import { colorConverterTool } from './color-converter/tool';
import { urlParseTool } from './url-parse/tool';
import { jwtParseTool, jwtSignVerifyTool } from './jwt-parse/tool';
import { timestampConvertTool } from './timestamp-convert/tool';
import { httpStatusTool } from './http-status/tool';
import { mimeLookupTool } from './mime-lookup/tool';
import { userAgentParserTool } from './user-agent-parser/tool';
import { emailNormalizerTool } from './email-normalizer/tool';
import { metaTagGeneratorTool, openGraphPreviewTool } from './meta-tag-generator/tool';
import { queryStringParserTool } from './query-string-parser/tool';
import { httpHeadersParserTool } from './http-headers-parser/tool';
import { curlToFetchTool, fetchToCurlTool } from './curl-to-fetch/tool';
import { httpRequestBuilderTool } from './http-request-builder/tool';
import { rawHttpRequestInspectorTool } from './raw-http-request-inspector/tool';
import { connectionStringTool } from './connection-string/tool';
import {
  curlToCodeTool,
  curlToGoTool,
  curlToJavaTool,
  curlToPhpTool,
  curlToPythonTool,
} from './curl-to-code/tool';
import { cookieParserTool } from './cookie-parser/tool';
import { corsBuilderTool } from './cors-builder/tool';
import { robotsTxtTool } from './robots-txt/tool';
import { redirectRulesTool } from './redirect-rules/tool';
import { utmBuilderTool } from './utm-builder/tool';
import { jsonLdGeneratorTool } from './json-ld-generator/tool';
import { emailHeaderAnalyzerTool } from './email-header-analyzer/tool';
import { dmarcRecordTool, emailAuthRecordsTool, spfRecordTool } from './email-auth-records/tool';
import { webManifestGeneratorTool } from './web-manifest-generator/tool';
import { sitemapXmlTool } from './sitemap-xml/tool';
import { securityHeadersAnalyzerTool } from './security-headers-analyzer/tool';
import { cspAnalyzerTool } from './csp-analyzer/tool';

export * from './url-parse/tool';
export * from './jwt-parse/tool';
export * from './timestamp-convert/tool';
export * from './http-status/tool';
export * from './mime-lookup/tool';
export * from './color-converter/tool';
export * from './user-agent-parser/tool';
export * from './email-normalizer/tool';
export * from './meta-tag-generator/tool';
export * from './query-string-parser/tool';
export * from './http-headers-parser/tool';
export * from './curl-to-fetch/tool';
export * from './http-request-builder/tool';
export * from './raw-http-request-inspector/tool';
export * from './connection-string/tool';
export * from './curl-to-code/tool';
export * from './cookie-parser/tool';
export * from './cors-builder/tool';
export * from './robots-txt/tool';
export * from './redirect-rules/tool';
export * from './utm-builder/tool';
export * from './json-ld-generator/tool';
export * from './web-manifest-generator/tool';
export * from './email-header-analyzer/tool';
export * from './email-auth-records/tool';
export * from './sitemap-xml/tool';
export * from './security-headers-analyzer/tool';
export * from './csp-analyzer/tool';

export const browserWebApiTools: ToolDefinition[] = [
  urlParseTool,
  jwtParseTool,
  jwtSignVerifyTool,
  timestampConvertTool,
  httpStatusTool,
  mimeLookupTool,
  colorConverterTool,
  userAgentParserTool,
  emailNormalizerTool,
  metaTagGeneratorTool,
  queryStringParserTool,
  httpHeadersParserTool,
  curlToFetchTool,
  fetchToCurlTool,
  openGraphPreviewTool,
  httpRequestBuilderTool,
  rawHttpRequestInspectorTool,
  cookieParserTool,
  cspAnalyzerTool,
  corsBuilderTool,
  securityHeadersAnalyzerTool,
  robotsTxtTool,
  sitemapXmlTool,
  redirectRulesTool,
  utmBuilderTool,
  jsonLdGeneratorTool,
  webManifestGeneratorTool,
  emailHeaderAnalyzerTool,
  emailAuthRecordsTool,
  spfRecordTool,
  dmarcRecordTool,
  connectionStringTool,
  curlToCodeTool,
  curlToPythonTool,
  curlToGoTool,
  curlToPhpTool,
  curlToJavaTool,
];
