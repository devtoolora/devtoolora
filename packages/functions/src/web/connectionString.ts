import { FunctionError } from '../errors';
import { sortFindings, type Finding } from './findings';

export type ConnectionDialect = 'mongodb' | 'mysql' | 'postgres' | 'redis';

export type ConnectionHost = { defaultPort: boolean; host: string; port: number };

export type ConnectionReport = {
  database?: string;
  dialect: ConnectionDialect;
  findings: Finding[];
  hosts: ConnectionHost[];
  options: Record<string, string>;
  password?: string;
  scheme: string;
  tls: boolean;
  tlsOptional?: boolean;
  username?: string;
};

type TlsState = 'off' | 'on' | 'optional';

export type ConnectionBuildOptions = {
  database?: string;
  dialect: string;
  host: string;
  options?: string;
  password?: string;
  port?: string;
  tls?: boolean;
  username?: string;
};

const MAX_LENGTH = 8_192;
const defaultPorts: Record<ConnectionDialect, number> = {
  mongodb: 27017,
  mysql: 3306,
  postgres: 5432,
  redis: 6379,
};
const schemes: Record<string, ConnectionDialect> = {
  'jdbc:mysql': 'mysql',
  'jdbc:postgresql': 'postgres',
  mongodb: 'mongodb',
  'mongodb+srv': 'mongodb',
  mysql: 'mysql',
  postgres: 'postgres',
  postgresql: 'postgres',
  redis: 'redis',
  rediss: 'redis',
};
const labels: Record<ConnectionDialect, string> = {
  mongodb: 'MongoDB',
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  redis: 'Redis',
};
const tlsFlags: Record<ConnectionDialect, string[]> = {
  mongodb: ['ssl', 'tls'],
  mysql: ['ssl', 'useSSL'],
  postgres: ['ssl'],
  redis: ['ssl', 'tls'],
};
const requiredTlsModes = [
  'no-verify',
  'require',
  'required',
  'verify-ca',
  'verify-full',
  'verify_ca',
  'verify_identity',
];
const envNames: Record<ConnectionDialect, string> = {
  mongodb: 'MONGODB_URI',
  mysql: 'DATABASE_URL',
  postgres: 'DATABASE_URL',
  redis: 'REDIS_URL',
};

function connectionError(message: string): FunctionError {
  return new FunctionError('INVALID_CONNECTION_STRING', message);
}

export function dialectLabel(dialect: ConnectionDialect): string {
  return labels[dialect];
}

function parsePort(value: string): number {
  const port = Number(value);

  if (!/^\d+$/.test(value) || port < 1 || port > 65_535) {
    throw connectionError('Port must be a whole number from 1 to 65535.');
  }

  return port;
}

function decode(value: string, what: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw connectionError(`${what} not valid percent-encoding.`);
  }
}

function parseHost(value: string, dialect: ConnectionDialect, srv: boolean): ConnectionHost {
  const match = /^(\[[^\]]*\]|[^:]*)(?::(.*))?$/.exec(value);
  const host = match?.[1] ?? '';

  if (!host) {
    throw connectionError('Host is required.');
  }

  if (match?.[2] !== undefined) {
    if (srv) {
      throw connectionError('mongodb+srv does not allow a port.');
    }

    return {
      defaultPort: parsePort(match[2]) === defaultPorts[dialect],
      host,
      port: parsePort(match[2]),
    };
  }

  return { defaultPort: true, host, port: defaultPorts[dialect] };
}

function parseOptions(query: string): Record<string, string> {
  const options: Record<string, string> = {};

  for (const pair of query.split('&').filter(Boolean)) {
    const index = pair.indexOf('=');
    const key = index < 0 ? pair : pair.slice(0, index);

    const name = decode(key, `Option "${key}" is`);
    const optionValue = index < 0 ? '' : decode(pair.slice(index + 1), `Option "${key}" is`);

    // defineProperty keeps a "__proto__" key as own data instead of setting the prototype.
    Object.defineProperty(options, name, {
      configurable: true,
      enumerable: true,
      value: optionValue,
      writable: true,
    });
  }

  return options;
}

function lookup(options: Record<string, string>, key: string): string | undefined {
  const found = Object.keys(options).find((name) => name.toLowerCase() === key.toLowerCase());

  return found === undefined ? undefined : options[found];
}

function detectTls(
  scheme: string,
  dialect: ConnectionDialect,
  options: Record<string, string>,
): TlsState {
  const flag = (key: string) => lookup(options, key)?.toLowerCase();
  const isOn = tlsFlags[dialect].some((key) => flag(key) === 'true');
  const isOff = tlsFlags[dialect].some((key) => flag(key) === 'false');

  if (scheme === 'rediss' || scheme === 'mongodb+srv') return isOff ? 'off' : 'on';
  if (dialect === 'mongodb') return isOn ? 'on' : 'off';
  if (dialect === 'redis') return 'off';

  // Lookup ignores case, so "sslmode" also finds Connector/J's sslMode.
  const mode = flag('sslmode') ?? flag('ssl-mode');

  if (mode === 'disable' || mode === 'disabled') return 'off';
  if (mode !== undefined) return requiredTlsModes.includes(mode) ? 'on' : 'optional';
  if (isOff) return 'off';

  return isOn ? 'on' : 'optional';
}

function tlsFinding(
  state: TlsState,
  dialect: ConnectionDialect,
  options: Record<string, string>,
): Finding[] {
  if (state === 'on') return [];
  if (state === 'off')
    return [{ level: 'medium', message: 'TLS is off; the connection is unencrypted.' }];

  const mode = lookup(options, 'sslmode') ?? lookup(options, 'ssl-mode');

  if (mode !== undefined)
    return [
      {
        level: 'medium',
        message: `TLS mode "${mode}" does not require TLS; the connection can fall back to unencrypted.`,
      },
    ];

  return [
    {
      level: 'medium',
      message:
        dialect === 'postgres'
          ? 'No sslmode; libpq defaults to prefer, which can fall back to an unencrypted connection.'
          : 'No TLS option; depending on the client the connection is unencrypted or can fall back to it.',
    },
  ];
}

function shapeFindings(hosts: ConnectionHost[], scheme: string, database: string): Finding[] {
  return [
    ...(scheme === 'mongodb+srv' && hosts.length > 1
      ? [{ level: 'medium' as const, message: 'mongodb+srv needs exactly one host.' }]
      : []),
    ...(scheme.startsWith('redis') && database && !/^\d+$/.test(database)
      ? [{ level: 'medium' as const, message: `A Redis database is a number, not "${database}".` }]
      : []),
  ];
}

function splitScheme(value: string): { dialect: ConnectionDialect; rest: string; scheme: string } {
  const index = value.indexOf('://');
  const scheme = index < 0 ? '' : value.slice(0, index).toLowerCase();
  const dialect = Object.hasOwn(schemes, scheme) ? schemes[scheme] : undefined;

  if (dialect === undefined) {
    throw connectionError(
      'Supported schemes: postgres, postgresql, jdbc:postgresql, mysql, jdbc:mysql, mongodb, mongodb+srv, redis, rediss.',
    );
  }

  return { dialect, rest: value.slice(index + 3), scheme };
}

export function parseConnectionString(value: string): ConnectionReport {
  const input = value.trim();

  if (!input) {
    throw connectionError('Connection string input is required.');
  }

  if (input.length > MAX_LENGTH) {
    throw connectionError('Connection string input exceeds 8,192 characters.');
  }

  const { dialect, rest, scheme } = splitScheme(input);
  const queryIndex = rest.indexOf('?');
  const main = queryIndex < 0 ? rest : rest.slice(0, queryIndex);
  const options = parseOptions(queryIndex < 0 ? '' : rest.slice(queryIndex + 1));
  const at = main.lastIndexOf('@');
  const userinfo = at < 0 ? '' : main.slice(0, at);

  if (/[@/]/.test(userinfo)) {
    throw connectionError('Percent-encode "@" and "/" in the password.');
  }

  const afterAt = main.slice(at + 1);
  const slash = afterAt.indexOf('/');
  const authority = slash < 0 ? afterAt : afterAt.slice(0, slash);
  const database = slash < 0 ? '' : decode(afterAt.slice(slash + 1), 'Database is');
  const colon = userinfo.indexOf(':');
  const rawUser = colon < 0 ? userinfo : userinfo.slice(0, colon);
  const username =
    (rawUser ? decode(rawUser, 'Credentials are') : lookup(options, 'user')) || undefined;
  const password =
    (colon < 0
      ? lookup(options, 'password')
      : decode(userinfo.slice(colon + 1), 'Credentials are')) || undefined;
  const srv = scheme === 'mongodb+srv';
  const hosts = authority.split(',').map((host) => parseHost(host, dialect, srv));
  const tls = detectTls(scheme, dialect, options);
  const findings: Finding[] = [
    ...tlsFinding(tls, dialect, options),
    ...shapeFindings(hosts, scheme, database),
  ];

  if (username !== undefined || password !== undefined) {
    findings.push({
      level: 'info',
      message: 'The URL carries credentials; prefer an environment variable or a secrets store.',
    });
  }

  if (password !== undefined && username === undefined && dialect !== 'redis') {
    findings.push({ level: 'low', message: 'A password is set without a username.' });
  }

  return {
    ...(database ? { database } : {}),
    dialect,
    findings: sortFindings(findings),
    hosts,
    options,
    ...(password === undefined ? {} : { password }),
    scheme,
    tls: tls === 'on',
    ...(tls === 'optional' ? { tlsOptional: true } : {}),
    ...(username === undefined ? {} : { username }),
  };
}

function parseDialect(value: string): ConnectionDialect {
  if (value === 'postgres' || value === 'mysql' || value === 'mongodb' || value === 'redis') {
    return value;
  }

  throw connectionError('Dialect must be postgres, mysql, mongodb or redis.');
}

function parseOptionLines(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\r?\n/)
    .map((line, index) => ({ index, line: line.trim() }))
    .filter(({ line }) => line)
    .map(({ index, line }) => {
      const separator = line.indexOf('=');

      if (separator < 1) {
        throw connectionError(`Option line ${index + 1} must be key=value.`);
      }

      return `${encodeURIComponent(line.slice(0, separator).trim())}=${encodeURIComponent(line.slice(separator + 1).trim())}`;
    });
}

const tlsOptions: Record<ConnectionDialect, string> = {
  mongodb: 'tls=true',
  mysql: 'ssl-mode=REQUIRED',
  postgres: 'sslmode=require',
  redis: '',
};

function buildCredentials(options: ConnectionBuildOptions): string {
  const username = options.username ? encodeURIComponent(options.username) : '';
  const password = options.password ? `:${encodeURIComponent(options.password)}` : '';

  return username || password ? `${username}${password}@` : '';
}

export function buildConnectionString(options: ConnectionBuildOptions): {
  env: string;
  findings: Finding[];
  jdbc?: string;
  uri: string;
} {
  const dialect = parseDialect(options.dialect);
  const host = options.host.trim();

  if (!host) {
    throw connectionError('Host is required.');
  }

  if (/[/?#@,\s]/.test(host)) {
    throw connectionError('Host must not contain "/", "?", "#", "@", "," or spaces.');
  }

  const port = options.port?.trim() ? parsePort(options.port.trim()) : defaultPorts[dialect];
  const extra = parseOptionLines(options.options);
  const tlsOption = options.tls ? [tlsOptions[dialect]].filter(Boolean) : [];
  const query = [...tlsOption, ...extra];
  const schemeByDialect: Record<ConnectionDialect, string> = {
    mongodb: 'mongodb',
    mysql: 'mysql',
    postgres: 'postgresql',
    redis: options.tls ? 'rediss' : 'redis',
  };
  const scheme = schemeByDialect[dialect];
  const database = options.database ? `/${encodeURIComponent(options.database)}` : '';
  const bracketed = host.split(':').length > 2 && !host.startsWith('[') ? `[${host}]` : host;
  const tail = `${bracketed}:${port}${database}`;
  const suffix = (items: string[]) => (items.length > 0 ? `?${items.join('&')}` : '');
  const uri = `${scheme}://${buildCredentials(options)}${tail}${suffix(query)}`;
  const credentials = [
    ...(options.username ? [`user=${encodeURIComponent(options.username)}`] : []),
    ...(options.password ? [`password=${encodeURIComponent(options.password)}`] : []),
  ];
  const jdbc =
    dialect === 'postgres' || dialect === 'mysql'
      ? `jdbc:${dialect === 'postgres' ? 'postgresql' : 'mysql'}://${tail}${suffix([...credentials, ...(dialect === 'mysql' && options.tls ? ['sslMode=REQUIRED'] : tlsOption), ...extra])}`
      : undefined;
  const parsedOptions = parseOptions(query.join('&'));
  const findings = tlsFinding(detectTls(scheme, dialect, parsedOptions), dialect, parsedOptions);

  if (options.password && !options.username && dialect !== 'redis') {
    findings.push({ level: 'low', message: 'A password is set without a username.' });
  }

  const escaped = uri.replace(/[\\"]/g, (char) => `\\${char}`);

  return {
    env: `${envNames[dialect]}="${escaped}"`,
    findings: sortFindings(findings),
    ...(jdbc === undefined ? {} : { jdbc }),
    uri,
  };
}
