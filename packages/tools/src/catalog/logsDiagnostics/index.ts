import { ToolDefinition } from '@devtoolora/core';
import { accessLogParserTool } from './access-log-parser/tool';
import { ansiStripperTool, ansiToHtmlTool } from './ansi-stripper/tool';
import { exitCodeReferenceTool } from './exit-code-reference/tool';
import { harViewerTool } from './har-viewer/tool';
import { jsonLinesInspectorTool } from './json-lines-inspector/tool';
import { logFilterTool } from './log-filter/tool';
import { logTimestampNormalizerTool } from './log-timestamp-normalizer/tool';
import { rawLogRedactorTool } from './raw-log-redactor/tool';
import { sourceMapResolverTool } from './source-map-resolver/tool';
import { stackTraceCleanerTool } from './stack-trace-cleaner/tool';

export * from './access-log-parser/tool';
export * from './ansi-stripper/tool';
export * from './exit-code-reference/tool';
export * from './har-viewer/tool';
export * from './json-lines-inspector/tool';
export * from './log-filter/tool';
export * from './log-timestamp-normalizer/tool';
export * from './raw-log-redactor/tool';
export * from './source-map-resolver/tool';
export * from './stack-trace-cleaner/tool';

export const logsDiagnosticTools: ToolDefinition[] = [
  jsonLinesInspectorTool,
  logFilterTool,
  rawLogRedactorTool,
  stackTraceCleanerTool,
  logTimestampNormalizerTool,
  accessLogParserTool,
  harViewerTool,
  ansiStripperTool,
  ansiToHtmlTool,
  exitCodeReferenceTool,
  sourceMapResolverTool,
];
