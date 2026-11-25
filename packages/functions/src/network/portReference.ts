import { networkError, required } from './shared';
import { ianaPortRows } from './portRegistryData';

export type PortProtocolFilter = 'any' | 'tcp' | 'udp';

interface PortEntry {
  description: string;
  end: number;
  protocols: string[];
  service: string;
  start: number;
}

interface PortQuery {
  end: number;
  start: number;
  text: string;
}

const listLimit = 500;
const maxPort = 65535;

const unofficialUses: [number, number, string][] = [
  [1521, 1521, 'Oracle Database listener'],
  [2181, 2181, 'Apache ZooKeeper'],
  [3000, 3000, 'development servers (Node.js, Rails, Grafana)'],
  [5000, 5000, 'development servers (Flask), Docker Registry and macOS AirPlay Receiver'],
  [5173, 5173, 'Vite development server'],
  [5601, 5601, 'Kibana'],
  [5938, 5938, 'TeamViewer'],
  [6443, 6443, 'Kubernetes API server'],
  [6881, 6889, 'BitTorrent'],
  [8000, 8000, 'development HTTP servers (Django, Python http.server)'],
  [8086, 8086, 'InfluxDB'],
  [8888, 8888, 'Jupyter Notebook'],
  [9000, 9000, 'PHP-FPM, SonarQube and MinIO'],
  [9042, 9042, 'Apache Cassandra'],
  [9090, 9090, 'Prometheus'],
  [9092, 9092, 'Apache Kafka'],
  [9200, 9200, 'Elasticsearch HTTP'],
  [9300, 9300, 'Elasticsearch transport'],
  [10250, 10250, 'Kubernetes kubelet'],
  [15672, 15672, 'RabbitMQ management'],
  [51820, 51820, 'WireGuard'],
];

let ianaEntries: PortEntry[] | undefined;

export function lookupPorts(
  query: string,
  protocol: PortProtocolFilter = 'any',
): { entries: number; shown: number; text: string } {
  const input = required(query, 'Port query');
  const parsed = parseQuery(input);
  const lines = listEntries(protocol)
    .filter((entry) => matches(entry, parsed))
    .map((entry) => formatEntry(entry, protocol));

  if (lines.length === 0) {
    const single = parsed.start === parsed.end && parsed.start >= 0;

    return {
      entries: 0,
      shown: 0,
      text: single
        ? `${parsed.start}: not in the offline table (${rangeName(parsed.start)}).\n`
        : `No entries match "${input}".\n`,
    };
  }

  const shown = lines.slice(0, listLimit);

  return { entries: lines.length, shown: shown.length, text: `${shown.join('\n')}\n` };
}

function parseQuery(input: string): PortQuery {
  const range = /^(\d+)(?:-(\d+))?$/.exec(input);

  if (!range) return { end: -1, start: -1, text: input.toLowerCase() };

  const start = Number(range[1]);
  const end = range[2] === undefined ? start : Number(range[2]);

  if (start > maxPort || end > maxPort)
    throw networkError('INVALID_PORT', `Ports must be within 0-${maxPort}.`);

  if (start > end)
    throw networkError('INVALID_RANGE', 'The range start must not be after its end.');

  return { end, start, text: '' };
}

function listEntries(protocol: PortProtocolFilter): PortEntry[] {
  const iana = loadIanaEntries().filter(
    (entry) => protocol === 'any' || entry.protocols.includes(protocol),
  );
  const unofficial = unofficialUses.map(([start, end, description]) => ({
    description,
    end,
    protocols: [],
    service: '',
    start,
  }));

  return [...iana, ...unofficial].sort(
    (a, b) => a.start - b.start || Number(!a.service) - Number(!b.service),
  );
}

function loadIanaEntries(): PortEntry[] {
  ianaEntries ??= ianaPortRows
    .split('\n')
    .filter(Boolean)
    .map((row) => {
      const [port = '', service = '', protocols = '', description = ''] = row.split('\t');

      return {
        description,
        end: Number(port),
        protocols: protocols.split(','),
        service,
        start: Number(port),
      };
    });

  return ianaEntries;
}

function matches(entry: PortEntry, { end, start, text }: PortQuery): boolean {
  if (text) return `${entry.service} ${entry.description}`.toLowerCase().includes(text);

  return entry.start <= end && entry.end >= start;
}

function formatEntry(entry: PortEntry, protocol: PortProtocolFilter): string {
  const range = entry.start === entry.end ? `${entry.start}` : `${entry.start}-${entry.end}`;

  if (!entry.service) return `${range} unofficial: ${entry.description}`;

  const protocols = protocol === 'any' ? entry.protocols : [protocol];

  return `${range} ${protocols.join('/')} ${entry.service}: ${entry.description}`;
}

function rangeName(port: number): string {
  if (port <= 1023) return 'System Ports 0-1023';

  return port <= 49151 ? 'User Ports 1024-49151' : 'Dynamic Ports 49152-65535';
}
