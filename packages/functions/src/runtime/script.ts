import { FunctionError } from '../errors';

type GlobalName = 'TesseractCore' | 'libheif';

const loaded = new Map<GlobalName, Promise<unknown>>();
let scriptBase: string | undefined;

export function setRuntimeScriptBase(url: string): void {
  scriptBase = url;
}

async function importAmd(fileName: string, base: string): Promise<unknown> {
  const scope = globalThis as Record<string, unknown>;
  let captured: unknown;

  const define = (_deps: unknown, factory: () => unknown): void => {
    captured = factory();
  };

  define.amd = true;
  scope.define = define;

  try {
    await import(/* @vite-ignore */ new URL(fileName, base).href);
  } catch {
    throw new FunctionError('RUNTIME_SCRIPT', `Could not load ${fileName}.`);
  } finally {
    delete scope.define;
  }

  if (captured === undefined)
    throw new FunctionError('RUNTIME_SCRIPT', `Could not load ${fileName}.`);

  return captured;
}

export function loadRuntimeScript<T>(globalName: GlobalName, fileName: string): Promise<T> {
  const existing = (globalThis as Record<string, unknown>)[globalName];

  if (existing) return Promise.resolve(existing as T);

  if (!scriptBase) {
    return Promise.reject(
      new FunctionError('RUNTIME_SCRIPT', `${fileName} is not loaded in this worker.`),
    );
  }

  let pending = loaded.get(globalName);

  if (!pending) {
    pending = importAmd(fileName, scriptBase);
    loaded.set(globalName, pending);
    pending.catch(() => loaded.delete(globalName));
  }

  return pending as Promise<T>;
}
