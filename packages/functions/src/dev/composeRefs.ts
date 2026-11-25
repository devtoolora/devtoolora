import type { JsonValue } from '../format/json';
import { checkModels } from './composeNested';
import { composeKeys } from './composeSpec';
import { isInterpolated } from './composeValues';
import {
  addError,
  addWarning,
  checkKeys,
  checkKind,
  childPath,
  indexPath,
  isMap,
  skipInterpolated,
  type Declared,
  type JsonMap,
  type Walk,
} from './composeShared';

const TOP_SECTIONS = ['configs', 'models', 'networks', 'secrets', 'services', 'volumes'] as const;

export function declaredNames(root: JsonMap): Declared {
  const names = Object.fromEntries(
    TOP_SECTIONS.map((section) => {
      const value = root[section];

      return [section, new Set(isMap(value) ? Object.keys(value) : [])];
    }),
  );

  return names as unknown as Declared;
}

function addEdge(walk: Walk, from: string, to: string): void {
  const dependencies = walk.edges.get(from);

  if (dependencies === undefined) {
    walk.edges.set(from, [to]);
  } else {
    dependencies.push(to);
  }
}

function requireService(walk: Walk, name: string, path: string, verb: string): boolean {
  if (skipInterpolated(walk, name)) {
    return false;
  }

  const known = walk.declared.services.has(name);

  if (!known) {
    addError(walk, path, `${verb} undefined service "${name}".`);
  }

  return known;
}

function listItems(value: JsonValue, path: string): Array<[string, JsonValue]> {
  return Array.isArray(value) ? value.map((item, index) => [indexPath(path, index), item]) : [];
}

function checkDependsOn(walk: Walk, name: string, value: JsonValue, path: string): void {
  const isList = Array.isArray(value);
  const entries: Array<[string, JsonValue, JsonValue]> = isList
    ? value.map((item, index) => [indexPath(path, index), item, null])
    : Object.entries(isMap(value) ? value : {}).map(([key, item]) => [
        childPath(path, key),
        key,
        item,
      ]);

  if (!isList && !isMap(value)) {
    addError(walk, path, 'expected a list or a mapping.');
  }

  for (const [entryPath, dependency, entry] of entries) {
    if (typeof dependency !== 'string') {
      addError(walk, entryPath, 'expected a string.');
    } else if (requireService(walk, dependency, entryPath, 'depends on')) {
      addEdge(walk, name, dependency);
    }

    if (!isList && isMap(entry)) {
      checkKeys(walk, entry, entryPath, composeKeys.dependsOnEntry);
      checkCondition(walk, entry, entryPath);
    } else if (!isList && entry !== null) {
      addError(walk, entryPath, 'expected a mapping.');
    }
  }
}

function checkCondition(walk: Walk, entry: JsonMap, path: string): void {
  if (Object.hasOwn(entry, 'condition')) {
    checkKind(
      walk,
      'enum',
      entry.condition ?? null,
      childPath(path, 'condition'),
      'depends_on.condition',
    );
  }
}

function checkExtends(walk: Walk, value: JsonValue, path: string): void {
  if (typeof value === 'string') {
    requireService(walk, value, path, 'refers to');

    return;
  }

  if (!isMap(value)) {
    addError(walk, path, 'expected a string or a mapping.');

    return;
  }

  checkKeys(walk, value, path, composeKeys.extends);

  const target = value.service;

  if (typeof target !== 'string') {
    addError(walk, path, 'extends needs service.');
  } else if (!Object.hasOwn(value, 'file')) {
    requireService(walk, target, childPath(path, 'service'), 'refers to');
  }
}

function checkNetworks(walk: Walk, value: JsonValue, path: string): void {
  const entries: Array<[string, string, JsonValue]> = Array.isArray(value)
    ? value.map((item, index) => [
        indexPath(path, index),
        typeof item === 'string' ? item : '',
        item,
      ])
    : Object.entries(isMap(value) ? value : {}).map(([key, item]) => [
        childPath(path, key),
        key,
        item,
      ]);

  if (!Array.isArray(value) && !isMap(value)) {
    addError(walk, path, 'expected a list or a mapping.');
  }

  for (const [entryPath, name, entry] of entries) {
    if (name === '') {
      addError(walk, entryPath, 'expected a string.');
    } else if (
      !skipInterpolated(walk, name) &&
      name !== 'default' &&
      !walk.declared.networks.has(name)
    ) {
      addError(walk, entryPath, `undefined network "${name}".`);
    }

    if (!Array.isArray(value) && isMap(entry)) {
      checkKeys(walk, entry, entryPath, composeKeys.serviceNetworkEntry);
    } else if (!Array.isArray(value) && entry !== null) {
      addError(walk, entryPath, 'expected a mapping.');
    }
  }
}

function checkSources(
  walk: Walk,
  value: JsonValue,
  path: string,
  label: 'config' | 'secret',
): void {
  const declared = label === 'secret' ? walk.declared.secrets : walk.declared.configs;

  if (!Array.isArray(value)) {
    if (!skipInterpolated(walk, value)) addError(walk, path, 'expected a list.');

    return;
  }

  for (const [itemPath, item] of listItems(value, path)) {
    const source = isMap(item) ? item.source : item;
    const sourcePath = isMap(item) ? childPath(itemPath, 'source') : itemPath;

    if (isMap(item)) {
      checkKeys(walk, item, itemPath, composeKeys.serviceSecretLong);
    }

    if (typeof source !== 'string') {
      addError(walk, sourcePath, 'expected a string.');
    } else if (!skipInterpolated(walk, source) && !declared.has(source)) {
      addError(walk, sourcePath, `undefined ${label} "${source}".`);
    }
  }
}

function volumesFromName(entry: string): string | undefined {
  const parts = entry.split(':');

  if (parts[0] === 'container') {
    return undefined;
  }

  return parts[0] === 'service' ? parts[1] : parts[0];
}

function checkNameList(
  walk: Walk,
  owner: string,
  { path, value }: { path: string; value: JsonValue },
  nameOf: (entry: string) => string | undefined,
): void {
  for (const [itemPath, item] of listItems(value, path)) {
    const name = typeof item === 'string' ? nameOf(item) : undefined;

    if (
      name !== undefined &&
      !(typeof item === 'string' && isInterpolated(item)) &&
      requireService(walk, name, itemPath, 'refers to')
    ) {
      addEdge(walk, owner, name);
    }
  }
}

function checkServiceMode(walk: Walk, owner: string, value: JsonValue, path: string): void {
  if (typeof value === 'string' && value.startsWith('service:') && !isInterpolated(value)) {
    const target = value.slice('service:'.length);

    if (requireService(walk, target, path, 'refers to')) {
      addEdge(walk, owner, target);
    }
  }
}

function checkNetworkMode(
  walk: Walk,
  service: { map: JsonMap; name: string },
  value: JsonValue,
  path: string,
): void {
  if (Object.hasOwn(service.map, 'networks')) {
    addError(walk, path, 'network_mode and networks cannot be used together.');
  }

  checkServiceMode(walk, service.name, value, path);
}

export function checkServiceReference(
  walk: Walk,
  service: { map: JsonMap; name: string },
  key: string,
  value: JsonValue,
  path: string,
): void {
  switch (key) {
    case 'depends_on':
      checkDependsOn(walk, service.name, value, path);

      break;
    case 'extends':
      checkExtends(walk, value, path);

      break;
    case 'networks':
      checkNetworks(walk, value, path);

      break;
    case 'secrets':
      checkSources(walk, value, path, 'secret');

      break;
    case 'configs':
      checkSources(walk, value, path, 'config');

      break;
    case 'links':
      checkNameList(walk, service.name, { path, value }, (entry) => entry.split(':')[0]);

      break;
    case 'volumes_from':
      checkNameList(walk, service.name, { path, value }, volumesFromName);

      break;
    case 'network_mode':
      checkNetworkMode(walk, service, value, path);

      break;
    case 'ipc':
    case 'pid':
    case 'uts':
      checkServiceMode(walk, service.name, value, path);

      break;
    case 'models':
      checkModels(walk, value, path);

      break;
    default:
      break;
  }
}

export function recordPublishedPort(
  walk: Walk,
  published: { hostIp: string; hostPorts: [number, number]; protocol: string },
  owner: string,
  path: string,
): void {
  const [start, end] = published.hostPorts;
  const ip = published.hostIp === '' ? '0.0.0.0' : published.hostIp;
  const range = start === end ? `${start}` : `${start}-${end}`;
  const key = `${ip}|${published.protocol}`;
  const taken = walk.published.get(key) ?? [];
  const clash = taken.find((entry) => entry.start <= end && start <= entry.end);

  walk.published.set(key, [...taken, { end, owner, start }]);

  if (clash === undefined) return;

  const clashRange = clash.start === clash.end ? `${clash.start}` : `${clash.start}-${clash.end}`;

  addWarning(
    walk,
    path,
    clash.start === start && clash.end === end
      ? `Host port ${range}/${published.protocol} on ${ip} is also published by "${clash.owner}".`
      : `Host port ${range}/${published.protocol} on ${ip} overlaps ${clashRange} published by "${clash.owner}".`,
  );
}

export function checkReplicas(walk: Walk, service: JsonMap, path: string): void {
  const deploy = service.deploy;
  const replicas = isMap(deploy) ? deploy.replicas : undefined;
  const many = (value: JsonValue | undefined): boolean => Number(value) > 1;

  if (Object.hasOwn(service, 'container_name') && (many(service.scale) || many(replicas))) {
    addError(
      walk,
      childPath(path, 'container_name'),
      'container_name cannot be used with more than one replica.',
    );
  }
}

export function findCycles(
  order: readonly string[],
  edges: ReadonlyMap<string, string[]>,
): string[] {
  const position = new Map(order.map((name, index) => [name, index]));
  const state = new Map<string, 'done' | 'open'>();
  const seen = new Set<string>();
  const messages: string[] = [];

  for (const start of order) {
    if (state.has(start)) {
      continue;
    }

    const stack = [{ name: start, next: 0 }];

    state.set(start, 'open');

    for (let top = stack.at(-1); top !== undefined; top = stack.at(-1)) {
      const dependencies = edges.get(top.name) ?? [];
      const dependency = dependencies[top.next];

      top.next += 1;

      if (dependency === undefined) {
        state.set(top.name, 'done');
        stack.pop();
      } else if (!state.has(dependency)) {
        state.set(dependency, 'open');
        stack.push({ name: dependency, next: 0 });
      } else if (state.get(dependency) === 'open') {
        const cycle = stack
          .slice(stack.findIndex((frame) => frame.name === dependency))
          .map((frame) => frame.name);
        const first = cycle.reduce((best, name) =>
          (position.get(name) ?? 0) < (position.get(best) ?? 0) ? name : best,
        );
        const from = cycle.indexOf(first);
        const rotated = [...cycle.slice(from), ...cycle.slice(0, from)];
        const text = [...rotated, first].join(' → ');

        if (!seen.has(text)) {
          seen.add(text);
          messages.push(`Dependency cycle: ${text}.`);
        }
      }
    }
  }

  return messages;
}
