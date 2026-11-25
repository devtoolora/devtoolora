import type { SerializedToolDefinition } from '@devtoolora/core';
import { WebviewConfig } from '../types';

export function readToolData(): SerializedToolDefinition[] {
  const element = document.getElementById('tool-data');

  return JSON.parse(element?.textContent ?? '[]') as SerializedToolDefinition[];
}

export function readWebviewConfig(): WebviewConfig {
  const element = document.getElementById('app-config');

  return JSON.parse(element?.textContent ?? '{}') as WebviewConfig;
}
