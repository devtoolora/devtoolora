import {
  serializeToolDefinition,
  serializeToolDefinitions,
  SerializedToolDefinition,
  ToolDefinition,
  ToolError,
  ToolInput,
  ToolResult,
  toolSupportsCapability,
  withDefaultKeywords,
} from '@devtoolora/core';
import type { ToolDomain } from '@devtoolora/tools';
import { toolDomains } from './toolDomains.generated';

export { loadToolContent } from './content';

export type BrowserToolDomain = ToolDomain;

const domainLoaders: Record<BrowserToolDomain, () => Promise<ToolDefinition[]>> = {
  encoders: () =>
    import('@devtoolora/tools/catalog/encoders').then((module) => module.encoderTools),
  math: () => import('@devtoolora/tools/catalog/math').then((module) => module.mathTools),
  measurement: () =>
    import('@devtoolora/tools/catalog/measurement').then((module) => module.measurementTools),
  data: () => import('@devtoolora/tools/catalog/data').then((module) => module.dataTools),
  configSecrets: () =>
    import('@devtoolora/tools/catalog/configSecrets').then((module) => module.configSecretTools),
  logsDiagnostics: () =>
    import('@devtoolora/tools/catalog/logsDiagnostics').then(
      (module) => module.logsDiagnosticTools,
    ),
  network: () => import('@devtoolora/tools/catalog/network').then((module) => module.networkTools),
  devUtilities: () =>
    import('@devtoolora/tools/catalog/devUtilities').then((module) => module.devUtilityTools),
  cssDesign: () =>
    import('@devtoolora/tools/catalog/cssDesign').then((module) => module.cssDesignTools),
  text: () => import('@devtoolora/tools/catalog/text').then((module) => module.browserTextTools),
  textLists: () =>
    import('@devtoolora/tools/catalog/textLists').then((module) => module.textListTools),
  formatters: () =>
    import('@devtoolora/tools/catalog/formatters').then((module) => module.browserFormatterTools),
  schemaTypes: () =>
    import('@devtoolora/tools/catalog/schemaTypes').then((module) => module.browserSchemaTypeTools),
  webApi: () =>
    import('@devtoolora/tools/catalog/webApi').then((module) => module.browserWebApiTools),
  crypto: () =>
    import('@devtoolora/tools/catalog/crypto').then((module) => module.browserCryptoTools),
  imagesCodes: () =>
    import('@devtoolora/tools/catalog/imagesCodes').then((module) => module.browserImageCodeTools),
  documentsPdf: () =>
    import('@devtoolora/tools/catalog/documentsPdf').then((module) => module.documentPdfTools),
  dateTime: () =>
    import('@devtoolora/tools/catalog/dateTime').then((module) => module.dateTimeTools),
  aiPrompts: () =>
    import('@devtoolora/tools/catalog/aiPrompts').then((module) => module.aiPromptTools),
};

const loadedDomains = new Map<BrowserToolDomain, Promise<ToolDefinition[]>>();

function loadDomain(domain: BrowserToolDomain): Promise<ToolDefinition[]> {
  const loaded =
    loadedDomains.get(domain) ??
    domainLoaders[domain]().then((tools) => tools.map(withDefaultKeywords));

  loadedDomains.set(domain, loaded);
  // A chunk that failed to download must be retried on the next request, not cached as a failure.
  loaded.catch(() => loadedDomains.delete(domain));

  return loaded;
}

async function loadDefinition(id: string): Promise<ToolDefinition> {
  const domain = Object.hasOwn(toolDomains, id)
    ? toolDomains[id as keyof typeof toolDomains]
    : undefined;
  const tool = domain && (await loadDomain(domain)).find((candidate) => candidate.id === id);

  if (!tool) throw new ToolError(`Unknown tool: ${id}`);

  return tool;
}

export function loadBrowserWorkerTool(id: string): Promise<SerializedToolDefinition> {
  return loadDefinition(id).then(serializeToolDefinition);
}

export async function loadBrowserWorkerTools(): Promise<SerializedToolDefinition[]> {
  const domains = Object.keys(domainLoaders) as BrowserToolDomain[];

  return serializeToolDefinitions((await Promise.all(domains.map(loadDomain))).flat());
}

export async function runBrowserWorkerToolLazily(
  id: string,
  input: ToolInput,
): Promise<ToolResult> {
  const tool = await loadDefinition(id);

  if (!toolSupportsCapability(tool, 'browserWorker')) {
    throw new ToolError(`Tool ${id} does not support runtime capability: browserWorker`);
  }

  return tool.run(input);
}
