// Derived from compose-go v2.16.2 schema/compose-spec.json, 90,595 B,
// sha256 f266dcbb043229405d7cedd5aec918f9102c2b3d5e3850808fdd8edd564a43ff.

type ComposeChecker =
  | 'build'
  | 'dependsOn'
  | 'envFile'
  | 'environment'
  | 'extends'
  | 'extraHosts'
  | 'healthcheck'
  | 'nested'
  | 'networks'
  | 'ports'
  | 'restart'
  | 'volumes';

export type ComposeKind =
  | ComposeChecker
  | 'any'
  | 'boolean'
  | 'bytes'
  | 'command'
  | 'duration'
  | 'enum'
  | 'integer'
  | 'integerOrText'
  | 'listOfStrings'
  | 'listOrDict'
  | 'mapping'
  | 'number'
  | 'numberOrText'
  | 'pattern'
  | 'string'
  | 'stringOrList';

export type ComposeShape = { readonly [key: string]: ComposeKind | ComposeShape };

const words = (text: string): ReadonlySet<string> => new Set(text.split(' '));

const kind_any = 'configs devices gpus label_file models post_start pre_start pre_stop secrets';

const kind_boolean =
  'attach init oom_kill_disable privileged read_only stdin_open tty use_api_socket';

const kind_build = 'build';

const kind_bytes = 'mem_limit mem_reservation memswap_limit shm_size';

const kind_command = 'command entrypoint';

const kind_dependsOn = 'depends_on';

const kind_duration = 'stop_grace_period';

const kind_enum = 'cgroup';

const kind_envFile = 'env_file';

const kind_environment = 'environment';

const kind_extends = 'extends';

const kind_extraHosts = 'extra_hosts';

const kind_healthcheck = 'healthcheck';

const kind_integer = 'cpu_count cpu_shares oom_score_adj pids_limit scale';

const kind_integerOrText = 'mem_swappiness umask';

const kind_listOfStrings =
  'cap_add cap_drop device_cgroup_rules dns_opt expose external_links group_add ' +
  'links profiles security_opt volumes_from';

const kind_listOrDict = 'annotations labels sysctls';

const kind_mapping = 'storage_opt';

const kind_nested = 'blkio_config credential_spec deploy develop logging provider ulimits';

const kind_networks = 'networks';

const kind_number = 'cpu_percent cpus';

const kind_numberOrText = 'cpu_period cpu_quota cpu_rt_period cpu_rt_runtime';

const kind_pattern = 'container_name pull_policy';

const kind_ports = 'ports';

const kind_restart = 'restart';

const kind_string =
  'cgroup_parent cpuset domainname hostname image ipc isolation mac_address ' +
  'network_mode pid platform pull_refresh_after runtime stop_signal user userns_mode ' +
  'uts working_dir';

const kind_stringOrList = 'dns dns_search tmpfs';

const kind_volumes = 'volumes';

const k_dependsOnEntry = 'restart required condition';

const k_extends = 'service file';

const k_healthcheck = 'disable interval retries test timeout start_period start_interval';

const k_portsLong = 'name mode host_ip target published protocol app_protocol';

const k_serviceNetworkEntry =
  'aliases interface_name ipv4_address ipv6_address link_local_ips mac_address ' +
  'driver_opts priority gw_priority use_service_name_alias';

const k_serviceSecretLong = 'source target uid gid mode';

const k_topConfig = 'name content environment file external labels template_driver';

const k_topNetwork =
  'name driver driver_opts ipam external internal enable_ipv4 enable_ipv6 ' + 'attachable labels';

const k_topSecret = 'name environment file external labels driver driver_opts template_driver';

const k_topVolume = 'name driver driver_opts external labels';

const k_volumesLong = 'type source target read_only consistency bind volume tmpfs image';

const k_build =
  'context dockerfile dockerfile_inline entitlements args ssh labels cache_from ' +
  'cache_to no_cache no_cache_filter additional_contexts network provenance sbom ' +
  'pull target shm_size extra_hosts isolation privileged secrets tags ulimits ' +
  'platforms';

const k_top = 'version name include services models networks volumes secrets configs jobs';

const kindEntries: ReadonlyArray<readonly [ComposeKind, string]> = [
  ['any', kind_any],
  ['boolean', kind_boolean],
  ['build', kind_build],
  ['bytes', kind_bytes],
  ['command', kind_command],
  ['dependsOn', kind_dependsOn],
  ['duration', kind_duration],
  ['enum', kind_enum],
  ['envFile', kind_envFile],
  ['environment', kind_environment],
  ['extends', kind_extends],
  ['extraHosts', kind_extraHosts],
  ['healthcheck', kind_healthcheck],
  ['integer', kind_integer],
  ['integerOrText', kind_integerOrText],
  ['listOfStrings', kind_listOfStrings],
  ['listOrDict', kind_listOrDict],
  ['mapping', kind_mapping],
  ['nested', kind_nested],
  ['networks', kind_networks],
  ['number', kind_number],
  ['numberOrText', kind_numberOrText],
  ['pattern', kind_pattern],
  ['ports', kind_ports],
  ['restart', kind_restart],
  ['string', kind_string],
  ['stringOrList', kind_stringOrList],
  ['volumes', kind_volumes],
];

const serviceKinds = new Map<string, ComposeKind>();

for (const [kind, keys] of kindEntries) {
  for (const key of keys.split(' ')) {
    serviceKinds.set(key, kind);
  }
}

export const composeKeys: {
  build: ReadonlySet<string>;
  dependsOnEntry: ReadonlySet<string>;
  extends: ReadonlySet<string>;
  healthcheck: ReadonlySet<string>;
  portsLong: ReadonlySet<string>;
  serviceKinds: ReadonlyMap<string, ComposeKind>;
  serviceNetworkEntry: ReadonlySet<string>;
  serviceSecretLong: ReadonlySet<string>;
  top: ReadonlySet<string>;
  topConfig: ReadonlySet<string>;
  topNetwork: ReadonlySet<string>;
  topSecret: ReadonlySet<string>;
  topVolume: ReadonlySet<string>;
  volumesLong: ReadonlySet<string>;
} = {
  build: words(k_build),
  dependsOnEntry: words(k_dependsOnEntry),
  extends: words(k_extends),
  healthcheck: words(k_healthcheck),
  portsLong: words(k_portsLong),
  serviceKinds,
  serviceNetworkEntry: words(k_serviceNetworkEntry),
  serviceSecretLong: words(k_serviceSecretLong),
  top: words(k_top),
  topConfig: words(k_topConfig),
  topNetwork: words(k_topNetwork),
  topSecret: words(k_topSecret),
  topVolume: words(k_topVolume),
  volumesLong: words(k_volumesLong),
};

export const composeEnums: ReadonlyMap<string, readonly string[]> = new Map([
  ['cgroup', ['host', 'private']],
  [
    'depends_on.condition',
    ['service_started', 'service_healthy', 'service_completed_successfully'],
  ],
  ['action', ['rebuild', 'sync', 'restart', 'sync+restart', 'sync+exec']],
  ['order', ['start-first', 'stop-first']],
  ['ports.mode', ['host', 'ingress']],
  ['volumes.type', ['bind', 'cluster', 'image', 'npipe', 'tmpfs', 'volume']],
]);

// container_name is unanchored in the schema, so Compose accepts -bad but not a or "a b".
export const composePatterns: ReadonlyMap<string, { message: string; pattern: RegExp }> = new Map([
  [
    'container_name',
    {
      message:
        'expected a container name of at least two letters, digits, "_", "." or "-", starting with a letter or digit.',
      pattern: /[a-zA-Z0-9][a-zA-Z0-9_.-]+/,
    },
  ],
  [
    'pull_policy',
    {
      message:
        'expected a pull policy: always, never, build, if_not_present, missing, refresh, daily, weekly or every_<duration>.',
      pattern:
        /^(?:always|never|build|if_not_present|missing|refresh|daily|weekly|every_(?:[0-9]+[wdhms])+)$/,
    },
  ],
]);

export const composeRanges: ReadonlyMap<string, readonly [number, number]> = new Map([
  ['cpu_percent', [0, 100]],
  ['oom_score_adj', [-1000, 1000]],
]);

const updateShape: ComposeShape = {
  delay: 'duration',
  failure_action: 'string',
  max_failure_ratio: 'number',
  monitor: 'duration',
  order: 'enum',
  parallelism: 'integer',
};

const deployShape: ComposeShape = {
  endpoint_mode: 'string',
  labels: 'listOrDict',
  mode: 'string',
  placement: {
    constraints: 'listOfStrings',
    max_replicas_per_node: 'integer',
    preferences: 'any',
  },
  replicas: 'integer',
  resources: {
    limits: { cpus: 'number', memory: 'bytes', pids: 'integer' },
    reservations: { cpus: 'number', devices: 'any', generic_resources: 'any', memory: 'bytes' },
  },
  restart_policy: {
    condition: 'string',
    delay: 'duration',
    max_attempts: 'integer',
    window: 'duration',
  },
  rollback_config: updateShape,
  update_config: updateShape,
};

export const composeShapes: {
  envFile: ComposeShape;
  services: ReadonlyMap<string, ComposeShape>;
  ulimit: ComposeShape;
  watchRule: ComposeShape;
} = {
  envFile: { format: 'string', path: 'string', required: 'boolean' },
  services: new Map<string, ComposeShape>([
    [
      'blkio_config',
      {
        device_read_bps: 'any',
        device_read_iops: 'any',
        device_write_bps: 'any',
        device_write_iops: 'any',
        weight: 'integer',
        weight_device: 'any',
      },
    ],
    ['credential_spec', { config: 'string', file: 'string', registry: 'string' }],
    ['deploy', deployShape],
    ['logging', { driver: 'string', options: 'mapping' }],
    ['provider', { options: 'mapping', type: 'string' }],
  ]),
  ulimit: { hard: 'integer', soft: 'integer' },
  watchRule: {
    action: 'enum',
    exec: 'any',
    ignore: 'stringOrList',
    include: 'stringOrList',
    initial_sync: 'boolean',
    path: 'string',
    target: 'string',
  },
};
