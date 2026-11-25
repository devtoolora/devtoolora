import type { JsonValue } from '../format/json';
import {
  addError,
  checkKeys,
  checkKind,
  childPath,
  indexPath,
  isMap,
  skipInterpolated,
  type JsonMap,
  type Walk,
} from './composeShared';
import { composeShapes, type ComposeShape } from './composeSpec';
import { hasInvalidInterpolation, isInterpolated } from './composeValues';

const FILE_SOURCES = new Map([
  ['configs', ['file', 'environment', 'content']],
  ['secrets', ['file', 'environment']],
]);

const MODEL_ENTRY_KEYS: ReadonlySet<string> = new Set(['endpoint_var', 'model_var']);

const shapeKeys = (shape: ComposeShape): ReadonlySet<string> => new Set(Object.keys(shape));

function checkShape(walk: Walk, value: JsonMap, path: string, shape: ComposeShape): void {
  checkKeys(walk, value, path, shapeKeys(shape));

  for (const [key, entry] of Object.entries(value)) {
    const expected = Object.hasOwn(shape, key) ? shape[key] : undefined;
    const entryPath = childPath(path, key);

    if (typeof expected === 'string') {
      checkKind(walk, expected, entry, entryPath, key);
    } else if (expected !== undefined && isMap(entry)) {
      checkShape(walk, entry, entryPath, expected);
    } else if (expected !== undefined && !skipInterpolated(walk, entry)) {
      addError(walk, entryPath, 'expected a mapping.');
    }
  }
}

function checkUlimits(walk: Walk, value: JsonMap, path: string): void {
  for (const [name, limit] of Object.entries(value)) {
    const limitPath = childPath(path, name);

    if (!isMap(limit)) {
      checkKind(walk, 'integer', limit, limitPath);
    } else {
      checkShape(walk, limit, limitPath, composeShapes.ulimit);

      if (!Object.hasOwn(limit, 'soft') || !Object.hasOwn(limit, 'hard')) {
        addError(walk, limitPath, 'needs soft and hard.');
      }
    }
  }
}

function checkDevelop(walk: Walk, value: JsonMap, path: string): void {
  checkKeys(walk, value, path, new Set(['watch']));

  const watch = value.watch;
  const watchPath = childPath(path, 'watch');

  if (watch === undefined) {
    return;
  }

  if (!Array.isArray(watch)) {
    addError(walk, watchPath, 'expected a list.');

    return;
  }

  watch.forEach((rule, index) => {
    const rulePath = indexPath(watchPath, index);

    if (!isMap(rule)) {
      addError(walk, rulePath, 'expected a mapping.');

      return;
    }

    checkShape(walk, rule, rulePath, composeShapes.watchRule);

    if (!Object.hasOwn(rule, 'path') || !Object.hasOwn(rule, 'action')) {
      addError(walk, rulePath, 'needs path and action.');
    }
  });
}

export function checkNested(walk: Walk, key: string, value: JsonValue, path: string): void {
  const shape = composeShapes.services.get(key);

  // The specification allows null for these two: "no settings".
  if (
    (value === null && (key === 'deploy' || key === 'develop')) ||
    skipInterpolated(walk, value)
  ) {
    return;
  }

  if (!isMap(value)) {
    addError(walk, path, 'expected a mapping.');
  } else if (key === 'ulimits') {
    checkUlimits(walk, value, path);
  } else if (key === 'develop') {
    checkDevelop(walk, value, path);
  } else if (shape !== undefined) {
    checkShape(walk, value, path, shape);

    if (key === 'provider' && !Object.hasOwn(value, 'type')) {
      addError(walk, path, 'needs type.');
    }
  }
}

function checkEnvFileItem(walk: Walk, item: JsonValue, path: string): void {
  if (isMap(item)) {
    checkShape(walk, item, path, composeShapes.envFile);

    if (!Object.hasOwn(item, 'path')) {
      addError(walk, path, 'needs path.');
    }
  } else if (typeof item !== 'string') {
    addError(walk, path, 'expected a string or a mapping.');
  }
}

export function checkEnvFile(walk: Walk, value: JsonValue, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkEnvFileItem(walk, item, indexPath(path, index)));
  } else if (typeof value !== 'string') {
    addError(walk, path, 'expected a string or a list.');
  }
}

export function checkExtraHosts(walk: Walk, value: JsonValue, path: string): void {
  if (isMap(value)) {
    return;
  }

  checkKind(walk, 'listOrDict', value, path);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (typeof item === 'string' && !isInterpolated(item) && !/[:=]/.test(item)) {
        addError(walk, indexPath(path, index), 'expected host:ip or host=ip.');
      }
    });
  }
}

export function checkModels(walk: Walk, value: JsonValue, path: string): void {
  const entries: Array<[string, JsonValue, JsonValue]> = Array.isArray(value)
    ? value.map((item, index) => [indexPath(path, index), item, null])
    : Object.entries(isMap(value) ? value : {}).map(([key, item]) => [
        childPath(path, key),
        key,
        item,
      ]);

  if (!Array.isArray(value) && !isMap(value) && !skipInterpolated(walk, value)) {
    addError(walk, path, 'expected a list or a mapping.');
  }

  for (const [entryPath, model, entry] of entries) {
    if (typeof model !== 'string') {
      addError(walk, entryPath, 'expected a string.');
    } else if (!skipInterpolated(walk, model) && !walk.declared.models.has(model)) {
      addError(walk, entryPath, `undefined model "${model}".`);
    }

    if (isMap(entry)) {
      checkKeys(walk, entry, entryPath, MODEL_ENTRY_KEYS);
    } else if (entry !== null) {
      addError(walk, entryPath, 'expected a mapping.');
    }
  }
}

export function checkFileSource(
  walk: Walk,
  section: string,
  definition: JsonMap,
  path: string,
): void {
  const sources = FILE_SOURCES.get(section) ?? [];
  const count = sources.filter((source) => Object.hasOwn(definition, source)).length;
  const managedElsewhere = ['driver', 'external'].some((key) => Object.hasOwn(definition, key));

  if (count > 1) {
    addError(walk, path, `${sources.join(', ')} are mutually exclusive.`);
  } else if (count === 0 && !managedElsewhere && sources.length > 0) {
    addError(walk, path, `one of ${sources.join(', ')} must be set.`);
  }
}

/** Compose interpolates every string in the file, so a malformed ${ anywhere stops it. */
export function checkInterpolationSyntax(walk: Walk, root: JsonMap): void {
  const stack: Array<[JsonValue, string]> = [[root, '']];

  for (let entry = stack.pop(); entry; entry = stack.pop()) {
    const [value, path] = entry;

    if (typeof value === 'string' && hasInvalidInterpolation(value)) {
      addError(walk, path, 'Invalid interpolation; write a literal dollar sign as $$.');
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => stack.push([item, indexPath(path, index)]));
    } else if (isMap(value)) {
      for (const [key, item] of Object.entries(value)) {
        stack.push([item, childPath(path, key)]);
      }
    }
  }
}
