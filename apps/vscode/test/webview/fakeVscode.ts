import type { SerializedToolDefinition } from '@devtoolora/core';
import type { WebviewState, WebviewToExtensionMessage } from '../../src/webview/client/types';

export type FakeVscode = {
  messages: WebviewToExtensionMessage[];
  savedState: WebviewState;
};

const fake: FakeVscode = { messages: [], savedState: {} };

/** Installs `acquireVsCodeApi` once; later installs only reset the recorded messages and state. */
export function installFakeVscode(savedState: WebviewState = {}): FakeVscode {
  fake.messages = [];
  fake.savedState = savedState;

  (window as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
    getState: () => fake.savedState,
    setState: (nextState: WebviewState) => {
      fake.savedState = nextState;
    },
    postMessage: (message: WebviewToExtensionMessage) => {
      fake.messages.push(message);
    },
  });

  return fake;
}

export class FakeWorker extends EventTarget {
  static created = 0;
  static deferred: Array<() => void> = [];
  static respond = true;
  static runs: Array<{ fields: Record<string, string>; text: string; toolId: string }> = [];

  constructor(private readonly tools: SerializedToolDefinition[]) {
    super();
    FakeWorker.created += 1;
  }

  static flush(): void {
    for (const reply of FakeWorker.deferred.splice(0)) reply();
  }

  postMessage(message: {
    fields: Record<string, string>;
    id: string;
    text: string;
    toolId: string;
    type: string;
  }): void {
    if (message.type === 'getTool') {
      const tool = this.tools.find((item) => item.id === message.toolId);
      const data = tool
        ? { id: message.id, ok: true, tool, type: 'getTool' }
        : { error: `Unknown tool: ${message.toolId}`, id: message.id, ok: false };

      queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data })));

      return;
    }

    FakeWorker.runs.push({ fields: message.fields, text: message.text, toolId: message.toolId });
    const reply = () =>
      this.dispatchEvent(
        new MessageEvent('message', {
          data: {
            id: message.id,
            ok: true,
            result: { text: message.text.toUpperCase() },
            type: 'runTool',
          },
        }),
      );

    if (FakeWorker.respond) queueMicrotask(reply);
    else FakeWorker.deferred.push(reply);
  }

  terminate(): void {}
}

/** Types into a React-controlled control the way a user would (native setter + input event). */
export function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

export function fieldControl<T extends HTMLElement = HTMLInputElement>(
  container: ParentNode,
  label: string,
): T {
  const field = Array.from(container.querySelectorAll('label')).find(
    (candidate) => candidate.querySelector('span')?.textContent === label,
  );
  const control = field?.querySelector<T>('input, select, textarea');

  if (!control) throw new Error(`Field "${label}" not found`);

  return control;
}

export function buttonByText(container: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === text,
  );

  if (!button) throw new Error(`Button "${text}" not found`);

  return button;
}
