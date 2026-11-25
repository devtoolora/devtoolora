import { fileURLToPath } from 'node:url';

const webSrc = (path: string): string =>
  fileURLToPath(new URL(`../../apps/web/src${path}`, import.meta.url));

export const webAliases: Record<string, string> = {
  '@': webSrc(''),
  '@components': webSrc('/components'),
  '@styles': webSrc('/styles'),
};
