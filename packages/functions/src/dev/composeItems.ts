import type { JsonValue } from '../format/json';
import { recordPublishedPort } from './composeRefs';
import {
  addError,
  addWarning,
  checkKeys,
  checkKind,
  childPath,
  indexPath,
  isMap,
  skipInterpolated,
  type JsonMap,
  type Walk,
} from './composeShared';
import { composeEnums, composeKeys } from './composeSpec';
import {
  environmentErrors,
  isNamedVolume,
  parsePort,
  parsePortRange,
  parseVolume,
} from './composeValues';

const HEALTH_DURATIONS = ['interval', 'start_interval', 'start_period', 'timeout'];

const HEALTH_TEST = 'test must be a string or a list starting with NONE, CMD or CMD-SHELL.';

const itemShape = 'expected a string or a mapping.';

function checkPortItem(walk: Walk, owner: string, item: JsonValue, path: string): void {
  if (skipInterpolated(walk, item)) {
    return;
  }

  if (isMap(item)) {
    checkLongPort(walk, owner, item, path);

    return;
  }

  if (typeof item !== 'string' && typeof item !== 'number') {
    addError(walk, path, 'expected a string, a number or a mapping.');

    return;
  }

  const parsed = parsePort(item);

  if (typeof parsed === 'string') {
    addError(walk, path, parsed);
  } else if (parsed.hostPorts !== null) {
    recordPublishedPort(walk, { ...parsed, hostPorts: parsed.hostPorts }, owner, path);
  }
}

function checkPortMode(walk: Walk, mode: JsonValue, path: string): void {
  if (typeof mode !== 'string') {
    checkKind(walk, 'enum', mode, path, 'ports.mode');
  } else if (!skipInterpolated(walk, mode) && !composeEnums.get('ports.mode')?.includes(mode)) {
    addWarning(
      walk,
      path,
      'expected one of: host, ingress. Docker Compose accepts other text, but the engine may refuse it when the stack starts.',
    );
  }
}

function checkLongPort(walk: Walk, owner: string, item: JsonMap, path: string): void {
  checkKeys(walk, item, path, composeKeys.portsLong);

  if (!Object.hasOwn(item, 'target')) {
    addError(walk, path, 'long syntax needs target.');
  }

  if (Object.hasOwn(item, 'mode')) {
    checkPortMode(walk, item.mode ?? null, childPath(path, 'mode'));
  }

  const published = item.published;
  const hostPorts =
    typeof published === 'number' || typeof published === 'string'
      ? parsePortRange(String(published))
      : null;

  if (hostPorts !== null) {
    const hostIp = typeof item.host_ip === 'string' ? item.host_ip : '';
    const protocol = typeof item.protocol === 'string' ? item.protocol : 'tcp';

    recordPublishedPort(walk, { hostIp, hostPorts, protocol }, owner, path);
  }
}

export function checkPorts(walk: Walk, owner: string, value: JsonValue, path: string): void {
  if (!Array.isArray(value)) {
    addError(walk, path, 'expected a list.');

    return;
  }

  value.forEach((item, index) => checkPortItem(walk, owner, item, indexPath(path, index)));
}

function checkNamedVolume(walk: Walk, source: JsonValue | undefined, path: string): void {
  if (typeof source !== 'string' || skipInterpolated(walk, source)) {
    return;
  }

  if (isNamedVolume(source) && !walk.declared.volumes.has(source)) {
    addError(walk, path, `undefined volume "${source}".`);
  }
}

function checkLongVolume(walk: Walk, item: JsonMap, path: string): void {
  checkKeys(walk, item, path, composeKeys.volumesLong);

  if (!Object.hasOwn(item, 'target')) {
    addError(walk, path, 'long syntax needs target.');
  }

  if (!Object.hasOwn(item, 'type')) {
    addError(walk, path, 'long syntax needs type.');

    return;
  }

  checkKind(walk, 'enum', item.type ?? null, childPath(path, 'type'), 'volumes.type');

  if (item.type === 'volume') {
    checkNamedVolume(walk, item.source, childPath(path, 'source'));
  }
}

function checkVolumeItem(walk: Walk, item: JsonValue, path: string): void {
  if (isMap(item)) {
    checkLongVolume(walk, item, path);
  } else if (typeof item !== 'string') {
    addError(walk, path, itemShape);
  } else if (!skipInterpolated(walk, item)) {
    const parsed = parseVolume(item);

    if (typeof parsed === 'string') {
      addError(walk, path, parsed);

      return;
    }

    if (parsed.warning !== undefined) {
      addWarning(walk, path, parsed.warning);
    }

    if (parsed.source !== null) {
      checkNamedVolume(walk, parsed.source, path);
    }
  }
}

export function checkVolumes(walk: Walk, value: JsonValue, path: string): void {
  if (!Array.isArray(value)) {
    addError(walk, path, 'expected a list.');

    return;
  }

  value.forEach((item, index) => checkVolumeItem(walk, item, indexPath(path, index)));
}

export function checkEnvironment(walk: Walk, value: JsonValue, path: string): void {
  if (!Array.isArray(value) && !isMap(value)) {
    addError(walk, path, 'expected a list or a mapping.');

    return;
  }

  for (const { index, message } of environmentErrors(value)) {
    addError(
      walk,
      typeof index === 'number' ? indexPath(path, index) : childPath(path, index),
      message,
    );
  }

  const names = new Set<string>();

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const name = typeof item === 'string' ? item.split('=')[0] : undefined;

      if (name === '') {
        addWarning(
          walk,
          indexPath(path, index),
          `Environment entry ${index} has no variable name. Docker Compose accepts it, but the container may refuse it when it starts.`,
        );
      }

      if (!name) {
        return;
      }

      if (names.has(name)) {
        addWarning(walk, indexPath(path, index), `Environment variable ${name} is set twice.`);
      }

      names.add(name);
    });
  }
}

function checkHealthTest(walk: Walk, test: JsonValue, path: string): void {
  if (Array.isArray(test) && test.length === 0) {
    addWarning(
      walk,
      path,
      'test is an empty list. Docker Compose accepts it, but it sets no command.',
    );

    return;
  }

  const valid =
    typeof test === 'string' ||
    (Array.isArray(test) && ['CMD', 'CMD-SHELL', 'NONE'].includes(String(test[0])));

  if (!valid && !skipInterpolated(walk, test)) {
    addError(walk, path, HEALTH_TEST);
  }
}

export function checkHealthcheck(walk: Walk, value: JsonValue, path: string): void {
  if (!isMap(value)) {
    addError(walk, path, 'expected a mapping.');

    return;
  }

  checkKeys(walk, value, path, composeKeys.healthcheck);

  for (const [key, entry] of Object.entries(value)) {
    const keyPath = childPath(path, key);

    if (key === 'test') {
      checkHealthTest(walk, entry, keyPath);
    } else if (HEALTH_DURATIONS.includes(key)) {
      checkKind(walk, 'duration', entry, keyPath);
    } else if (key === 'retries') {
      checkKind(walk, 'integer', entry, keyPath);

      if (typeof entry === 'number' && entry < 0) {
        addError(walk, keyPath, 'expected a whole number of at least 0.');
      }
    } else if (key === 'disable') {
      checkKind(walk, 'boolean', entry, keyPath);
    }
  }
}

export function checkBuild(walk: Walk, value: JsonValue, path: string): void {
  if (isMap(value)) {
    checkKeys(walk, value, path, composeKeys.build);

    if (Object.hasOwn(value, 'dockerfile') && Object.hasOwn(value, 'dockerfile_inline')) {
      addError(walk, path, 'dockerfile and dockerfile_inline cannot be used together.');
    }
  } else if (typeof value !== 'string') {
    addError(walk, path, itemShape);
  } else {
    skipInterpolated(walk, value);
  }
}
