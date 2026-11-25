import type { JsonValue } from '../format/json';
import { yamlToJson } from '../format/yaml';
import { checkReplicas, checkServiceReference, declaredNames, findCycles } from './composeRefs';
import {
  addError,
  addWarning,
  checkKey,
  checkKeys,
  checkKind,
  childPath,
  isMap,
  skipInterpolated,
  type ComposeIssue,
  type JsonMap,
  type Walk,
} from './composeShared';
import { composeKeys, type ComposeKind } from './composeSpec';
import {
  checkEnvFile,
  checkExtraHosts,
  checkFileSource,
  checkInterpolationSyntax,
  checkNested,
} from './composeNested';
import { restartError, restartWarning } from './composeValues';
import {
  checkBuild,
  checkEnvironment,
  checkHealthcheck,
  checkPorts,
  checkVolumes,
} from './composeItems';
import { devError } from './shared';

export type ComposeValidation = {
  errors: ComposeIssue[];
  interpolated: number;
  networks: number;
  services: number;
  valid: boolean;
  volumes: number;
  warnings: ComposeIssue[];
};

const MAX_CHARACTERS = 1_000_000;
const MAX_SERVICES = 1_000;
const MAX_LINES = 500;
const SERVICE_NAME = /^[A-Za-z0-9._-]+$/;

const declarationKeys = new Map<string, ReadonlySet<string>>([
  ['configs', composeKeys.topConfig],
  ['networks', composeKeys.topNetwork],
  ['secrets', composeKeys.topSecret],
  ['volumes', composeKeys.topVolume],
]);

const serviceKeys = new Set(composeKeys.serviceKinds.keys());

function checkServiceValue(
  walk: Walk,
  kind: ComposeKind,
  entry: { key: string; name: string; path: string; value: JsonValue },
): void {
  const { key, name: owner, path, value } = entry;

  switch (kind) {
    case 'ports':
      checkPorts(walk, owner, value, path);

      break;
    case 'volumes':
      checkVolumes(walk, value, path);

      break;
    case 'environment':
      checkEnvironment(walk, value, path);

      break;
    case 'healthcheck':
      checkHealthcheck(walk, value, path);

      break;
    case 'build':
      checkBuild(walk, value, path);

      break;
    case 'nested':
      checkNested(walk, key, value, path);

      break;
    case 'envFile':
      checkEnvFile(walk, value, path);

      break;
    case 'extraHosts':
      checkExtraHosts(walk, value, path);

      break;

    case 'restart': {
      if (skipInterpolated(walk, value)) {
        break;
      }

      const message = restartError(value);
      const warning = restartWarning(value);

      if (message !== undefined) {
        addError(walk, path, message);
      } else if (warning !== undefined) {
        addWarning(walk, path, warning);
      }

      break;
    }

    case 'dependsOn':
    case 'extends':
    case 'networks':
      break;
    default:
      checkKind(walk, kind, value, path, key);
  }
}

function walkService(walk: Walk, name: string, service: JsonMap, path: string): void {
  const needsSource = ['image', 'build', 'extends', 'provider'].every(
    (key) => !Object.hasOwn(service, key),
  );

  if (needsSource) {
    addError(walk, path, 'needs image or build.');
  }

  for (const [key, value] of Object.entries(service)) {
    const keyPath = childPath(path, key);
    const kind = composeKeys.serviceKinds.get(key);

    if (kind === undefined) {
      checkKey(walk, key, path, serviceKeys);
    } else {
      checkServiceValue(walk, kind, { key, name, path: keyPath, value });
      checkServiceReference(walk, { map: service, name }, key, value, keyPath);
    }
  }

  checkReplicas(walk, service, path);
}

function walkServices(walk: Walk, services: JsonValue, path: string): void {
  if (!isMap(services)) {
    addError(walk, path, 'expected a mapping.');

    return;
  }

  for (const [name, service] of Object.entries(services)) {
    const servicePath = childPath(path, name);

    if (!SERVICE_NAME.test(name)) {
      addError(walk, servicePath, 'Service names use only letters, digits, ".", "_" and "-".');
    }

    if (isMap(service)) {
      walkService(walk, name, service, servicePath);
    } else {
      addError(walk, servicePath, 'expected a mapping.');
    }
  }
}

function walkDeclarations(walk: Walk, key: string, value: JsonValue): void {
  if (!isMap(value)) {
    addError(walk, key, 'expected a mapping.');

    return;
  }

  for (const [name, definition] of Object.entries(value)) {
    const path = childPath(key, name);

    if (isMap(definition)) {
      checkKeys(walk, definition, path, declarationKeys.get(key) ?? new Set());
      checkFileSource(walk, key, definition, path);
    } else if (definition !== null || key === 'secrets' || key === 'configs') {
      addError(walk, path, 'expected a mapping.');
    }
  }
}

function walkRoot(walk: Walk, root: JsonMap): void {
  for (const [key, value] of Object.entries(root)) {
    checkKey(walk, key, '', composeKeys.top);

    if (key === 'version') {
      checkKind(walk, 'string', value, key);
      addWarning(walk, key, 'version is obsolete and ignored by Compose v2.');
    } else if (key === 'name') {
      checkKind(walk, 'string', value, key);
    } else if (key === 'services') {
      walkServices(walk, value, key);
    } else if (declarationKeys.has(key)) {
      walkDeclarations(walk, key, value);
    }
  }
}

const countKeys = (value: JsonValue | undefined): number =>
  isMap(value) ? Object.keys(value).length : 0;

export function validateCompose(text: string): ComposeValidation {
  if (text.length > MAX_CHARACTERS) {
    throw devError('Docker Compose Validator supports at most 1,000,000 characters.');
  }

  const root = yamlToJson(text);

  if (!isMap(root)) {
    throw devError('The Compose file must be a mapping at the top level.');
  }

  if (countKeys(root.services) > MAX_SERVICES) {
    throw devError('Docker Compose Validator supports at most 1,000 services.');
  }

  const walk: Walk = {
    declared: declaredNames(root),
    edges: new Map(),
    errors: [],
    interpolated: 0,
    published: new Map(),
    warnings: [],
  };

  walkRoot(walk, root);
  checkInterpolationSyntax(walk, root);

  for (const message of findCycles([...walk.declared.services], walk.edges)) {
    addError(walk, 'services', message);
  }

  return {
    errors: walk.errors,
    interpolated: walk.interpolated,
    networks: countKeys(root.networks),
    services: countKeys(root.services),
    valid: walk.errors.length === 0,
    volumes: countKeys(root.volumes),
    warnings: walk.warnings,
  };
}

const count = (amount: number, noun: string): string =>
  `${amount} ${noun}${amount === 1 ? '' : 's'}`;

function summarize(validation: ComposeValidation): string {
  const { errors, interpolated, networks, services, volumes, warnings } = validation;
  const warning = warnings.length > 0 ? [count(warnings.length, 'warning')] : [];
  const stack = [count(services, 'service')];

  if (networks > 0) {
    stack.push(count(networks, 'network'));
  }

  if (volumes > 0) {
    stack.push(count(volumes, 'volume'));
  }

  const parts = validation.valid
    ? ['Valid', stack.join(', '), ...warning]
    : ['Invalid', [count(errors.length, 'error'), ...warning].join(', '), stack[0] ?? ''];

  if (interpolated > 0) {
    parts.push(`${count(interpolated, 'interpolated value')} not checked`);
  }

  return `${parts.join(' · ')}.`;
}

export function formatComposeReport(validation: ComposeValidation): {
  report: string;
  summary: string;
} {
  const total = validation.errors.length + validation.warnings.length;
  const issues = [
    ...validation.errors.map((issue) => ['error', issue] as const),
    ...validation.warnings.map((issue) => ['warning', issue] as const),
  ].slice(0, MAX_LINES);
  const shown = issues.map(([severity, issue]) => `${severity} · ${issue.path}\n${issue.message}`);

  if (total > MAX_LINES) {
    shown.unshift(`Showing ${MAX_LINES} of ${total} issues.`);
  }

  return {
    report: total === 0 ? 'No issues found.' : shown.join('\n\n'),
    summary: summarize(validation),
  };
}
