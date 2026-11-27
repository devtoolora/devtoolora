import { WebviewConfig } from '../types';

export function readToolData<T>(): T[] {
  const element = document.getElementById('tool-data');

  return JSON.parse(element?.textContent ?? '[]') as T[];
}

export function readWebviewConfig(): WebviewConfig {
  const element = document.getElementById('app-config');

  return JSON.parse(element?.textContent ?? '{}') as WebviewConfig;
}
