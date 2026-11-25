import { readFileSync } from 'fs';
import * as vscode from 'vscode';

export type WebviewHtmlOptions = {
  appConfig?: string;
  extensionUri: vscode.Uri;
  nonce: string;
  toolData: string;
  webview: vscode.Webview;
};

export function renderWebviewHtml({
  appConfig = '{}',
  extensionUri,
  webview,
  nonce,
  toolData,
}: WebviewHtmlOptions): string {
  const htmlPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.html').fsPath;
  const csp = [
    "default-src 'none'",
    'img-src data: blob:',
    `style-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}' ${webview.cspSource} 'wasm-unsafe-eval'`,
    `connect-src ${webview.cspSource}`,
    `worker-src blob:`,
  ].join('; ');

  return readFileSync(htmlPath, 'utf8')
    .replace('{{CSP}}', () => csp)
    .replace('{{APP_CONFIG}}', () => appConfig.replace(/</g, '\\u003c'))
    .replace('{{TOOL_DATA}}', () => toolData.replace(/</g, '\\u003c'))
    .replace(
      /(href|src)="\.\/assets\/([^"]+)"/g,
      (_match, attribute: string, assetName: string) => {
        const uri = webview.asWebviewUri(
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', assetName),
        );

        return `${attribute}="${uri.toString()}"`;
      },
    )
    .replace(/<script type="module"/, `<script nonce="${nonce}" type="module"`);
}
