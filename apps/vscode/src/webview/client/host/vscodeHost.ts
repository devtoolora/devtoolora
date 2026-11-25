import type { ExtensionToWebviewMessage, VscodeApi } from '../types';

declare function acquireVsCodeApi(): VscodeApi;

let api: VscodeApi | undefined;

/** The webview API handle; VS Code allows acquiring it only once per document. */
export function getVscode(): VscodeApi {
  api ??= acquireVsCodeApi();

  return api;
}

export function onHostMessage(handler: (message: ExtensionToWebviewMessage) => void): () => void {
  const listener = (event: MessageEvent<ExtensionToWebviewMessage>) => handler(event.data);

  window.addEventListener('message', listener);

  return () => window.removeEventListener('message', listener);
}
