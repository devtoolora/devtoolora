import { describe, expect, it } from 'vitest';
import { formatComposeReport, validateCompose } from '../src/dev/compose';

const run = (text: string) => {
  const validation = validateCompose(text);

  return { ...formatComposeReport(validation), validation };
};

const blocks = (text: string): string[] => run(text).report.split('\n\n');

describe('compose validator', () => {
  it('rejects non-list secrets and configs', () => {
    const text = 'services:\n  a:\n    image: x\n    secrets: 5\n    configs:\n      k: 1\n';

    expect(blocks(text)).toEqual([
      'error · services.a.secrets\nexpected a list.',
      'error · services.a.configs\nexpected a list.',
    ]);
  });

  it('skips interpolated secrets and configs', () => {
    expect(run('services:\n  a:\n    image: x\n    secrets: ${S}\n').validation.valid).toBe(true);
  });

  it('reports the typo sample', () => {
    const text =
      'services:\n  web:\n    image: nginx:1.27\n    ports:\n      - "80:80:80"\n    enviroment:\n      - DEBUG=1\n    depends_on:\n      - api\n  api:\n    build: ./api\n    restart: false\n';
    const { report, summary, validation } = run(text);

    expect(report.split('\n\n')).toEqual([
      'error · services.web.ports[0]\n"80:80:80" is not a valid port mapping.',
      'error · services.web.enviroment\nunknown key; did you mean "environment"?',
      'error · services.api.restart\nrestart: write "no" in quotes.',
    ]);

    expect(summary).toBe('Invalid · 3 errors · 2 services.');
    expect(validation.valid).toBe(false);
  });

  it('validates a full stack', () => {
    const text = [
      'x-common: &common',
      '  restart: unless-stopped',
      '  networks: [back]',
      'services:',
      '  web:',
      '    <<: *common',
      '    image: nginx:1.27',
      '    ports: ["8080:80", 443]',
      '    volumes: ["data:/data:ro", "./site:/usr/share/nginx/html", "C:\\\\x:/x"]',
      '    depends_on:',
      '      api: { condition: service_healthy }',
      '    healthcheck:',
      '      test: ["CMD-SHELL", "curl -f http://localhost"]',
      '      interval: 1m30s',
      '      retries: 3',
      '  api:',
      '    <<: *common',
      '    build: { context: ./api }',
      '    volumes:',
      '      - { type: volume, source: cache, target: /cache }',
      '    environment: { A: 1, B: null }',
      '  db:',
      '    image: postgres:16',
      '    expose: [5432]',
      '    mem_limit: 512m',
      'networks:',
      '  back: null',
      'volumes:',
      '  data: {}',
      '  cache:',
    ].join('\n');
    const { report, summary } = run(text);

    expect(report).toBe('No issues found.');
    expect(summary).toBe('Valid · 3 services, 1 network, 2 volumes.');
  });

  it('checks references and cycles', () => {
    const text = [
      'services:',
      '  web:',
      '    image: a',
      '    depends_on: [api, ghost]',
      '    links: ["ghost:g"]',
      '    volumes_from: ["ghost:ro", "container:x", "service:api"]',
      '    network_mode: service:ghost',
      '    networks: [front, default]',
      '    secrets: [pw]',
      '    configs: [{ source: cfg }]',
      '    volumes: ["missing:/m"]',
      '    extends: { service: ghost }',
      '  api:',
      '    image: b',
      '    depends_on: { web: { condition: service_started } }',
      '    extends: { file: other.yml, service: x }',
      '  loner:',
      '    image: c',
      '    depends_on: [loner]',
    ].join('\n');
    const result = blocks(text);

    expect(result).toEqual([
      'error · services.web.depends_on[1]\ndepends on undefined service "ghost".',
      'error · services.web.links[0]\nrefers to undefined service "ghost".',
      'error · services.web.volumes_from[0]\nrefers to undefined service "ghost".',
      'error · services.web.network_mode\nnetwork_mode and networks cannot be used together.',
      'error · services.web.network_mode\nrefers to undefined service "ghost".',
      'error · services.web.networks[0]\nundefined network "front".',
      'error · services.web.secrets[0]\nundefined secret "pw".',
      'error · services.web.configs[0].source\nundefined config "cfg".',
      'error · services.web.volumes[0]\nundefined volume "missing".',
      'error · services.web.extends.service\nrefers to undefined service "ghost".',
      'error · services\nDependency cycle: web → api → web.',
      'error · services\nDependency cycle: loner → loner.',
    ]);
  });

  it('detects string published ports and overlapping host ranges', () => {
    const text = [
      'services:',
      '  a:',
      '    image: a',
      '    ports: ["8000-8010:80", { target: 80, published: "9090" }]',
      '  b:',
      '    image: b',
      '    ports: ["8005:80", { target: 80, published: 9090 }, "127.0.0.1:8005:80", "8011:80"]',
      '  c:',
      '    image: c',
      '    ports: [{ target: 80, published: "8008-8012" }]',
    ].join('\n');

    expect(validateCompose(text).warnings.map((issue) => issue.message)).toEqual([
      'Host port 8005/tcp on 0.0.0.0 overlaps 8000-8010 published by "a".',
      'Host port 9090/tcp on 0.0.0.0 is also published by "a".',
      'Host port 8008-8012/tcp on 0.0.0.0 overlaps 8000-8010 published by "a".',
    ]);
  });

  it('catches overlaps that chain through an entry that already clashed', () => {
    const text = [
      'services:',
      '  a:',
      '    image: a',
      '    ports: ["8000:80"]',
      '  b:',
      '    image: b',
      '    ports: ["8000-8010:80"]',
      '  c:',
      '    image: c',
      '    ports: ["8005:80"]',
    ].join('\n');

    expect(validateCompose(text).warnings.map((issue) => issue.message)).toEqual([
      'Host port 8000-8010/tcp on 0.0.0.0 overlaps 8000 published by "a".',
      'Host port 8005/tcp on 0.0.0.0 overlaps 8000-8010 published by "b".',
    ]);
  });

  it('warns without invalidating', () => {
    const text = [
      'version: "3.9"',
      'services:',
      '  web:',
      '    image: a',
      '    ports: ["8080:80"]',
      '  api:',
      '    image: b',
      '    ports: ["8080:80", { target: 80, published: 9090 }]',
      '  worker:',
      '    image: c',
      '    ports: [{ target: 81, published: 9090 }]',
      '    environment: ["DEBUG=1", "DEBUG=2", "OTHER"]',
    ].join('\n');
    const { validation } = run(text);

    expect(validation.valid).toBe(true);

    expect(validation.warnings).toEqual([
      { message: 'version is obsolete and ignored by Compose v2.', path: 'version' },
      {
        message: 'Host port 8080/tcp on 0.0.0.0 is also published by "web".',
        path: 'services.api.ports[0]',
      },
      {
        message: 'Host port 9090/tcp on 0.0.0.0 is also published by "api".',
        path: 'services.worker.ports[0]',
      },
      {
        message: 'Environment variable DEBUG is set twice.',
        path: 'services.worker.environment[1]',
      },
    ]);

    expect(run(text).summary).toBe('Valid · 3 services · 4 warnings.');
  });

  describe('values Docker Compose rejects', () => {
    const service = (body: string): string => `services:\n  web:\n    image: nginx\n    ${body}\n`;
    const cases: Array<[string, string, string]> = [
      ['container_name: w\n    deploy: { replicas: 3 }', 'container_name', 'more than one replica'],
      ['container_name: w\n    scale: 2', 'container_name', 'more than one replica'],
      ['container_name: w\n    scale: "2"', 'container_name', 'more than one replica'],
      ['deploy: { replica: 2 }', 'deploy.replica', 'did you mean "replicas"?'],
      ['deploy: { foo: 1 }', 'deploy.foo', 'unknown key'],
      ['deploy: { resources: { limits: { foo: 1 } } }', 'deploy.resources.limits.foo', 'unknown'],
      ['deploy: { replicas: x }', 'deploy.replicas', 'expected an integer'],
      ['deploy: { update_config: { order: x } }', 'deploy.update_config.order', 'stop-first'],
      ['deploy: { update_config: 5 }', 'deploy.update_config', 'expected a mapping'],
      ['logging: { drivr: x }', 'logging.drivr', 'did you mean "driver"?'],
      ['logging: { driver: json-file, foo: 1 }', 'logging.foo', 'unknown key'],
      ['ulimits: { nofile: { sft: 1, hard: 2 } }', 'ulimits.nofile.sft', 'did you mean "soft"?'],
      ['ulimits: { nofile: { soft: 1 } }', 'ulimits.nofile', 'needs soft and hard'],
      ['ulimits: { nofile: abc }', 'ulimits.nofile', 'expected an integer'],
      ['ulimits: 5', 'ulimits', 'expected a mapping'],
      ['develop: { watch: [{ action: foo, path: ./a }] }', 'develop.watch[0].action', 'rebuild'],
      ['develop: { watch: [{ action: sync }] }', 'develop.watch[0]', 'needs path and action'],
      ['develop: { watch: [5] }', 'develop.watch[0]', 'expected a mapping'],
      ['develop: { watch: 5 }', 'develop.watch', 'expected a list'],
      ['provider: { options: {} }', 'provider', 'needs type'],
      ['blkio_config: { wieght: 1 }', 'blkio_config.wieght', 'did you mean "weight"?'],
      ['credential_spec: { foo: a }', 'credential_spec.foo', 'unknown key'],
      ['cpus: abc', 'cpus', 'expected a number'],
      ['cpus: ""', 'cpus', 'expected a number'],
      ['mem_limit: abc', 'mem_limit', 'expected a size'],
      ['pids_limit: abc', 'pids_limit', 'expected an integer'],
      ['scale: x', 'scale', 'expected an integer'],
      ['healthcheck: { retries: x, test: [CMD, a] }', 'healthcheck.retries', 'an integer'],
      ['healthcheck: { retries: -1, test: [CMD, a] }', 'healthcheck.retries', 'at least 0'],
      ['oom_score_adj: 2000', 'oom_score_adj', 'from -1000 to 1000'],
      ['container_name: "a b"', 'container_name', 'container name'],
      ['container_name: a', 'container_name', 'container name'],
      ['pull_policy: foo', 'pull_policy', 'pull policy'],
      ['extra_hosts: ["a"]', 'extra_hosts[0]', 'host:ip or host=ip'],
      ['env_file: { path: a.env }', 'env_file', 'expected a string or a list'],
      ['env_file: [{ required: true }]', 'env_file[0]', 'needs path'],
      ['env_file: [{ path: a, foo: 1 }]', 'env_file[0].foo', 'unknown key'],
      ['env_file: [5]', 'env_file[0]', 'expected a string or a mapping'],
      ['models: [m]', 'models[0]', 'undefined model "m"'],
      ['models: { m: {} }', 'models.m', 'undefined model "m"'],
      ['models: 5', 'models', 'expected a list or a mapping'],
      ['ipc: "service:db"', 'ipc', 'undefined service "db"'],
      ['pid: "service:db"', 'pid', 'undefined service "db"'],
      ['uts: "service:db"', 'uts', 'undefined service "db"'],
      ['build: { dockerfile: a, dockerfile_inline: b }', 'build', 'cannot be used together'],
    ];

    it.each(cases)('rejects %s', (body, path, fragment) => {
      const { errors, valid } = validateCompose(service(body));

      expect(valid).toBe(false);

      expect(errors).toContainEqual({
        message: expect.stringContaining(fragment),
        path: `services.web.${path}`,
      });
    });

    it.each(['links: [web]', 'volumes_from: [web]', 'ipc: "service:web"', 'pid: "service:web"'])(
      'reports the self cycle in %s',
      (body) => {
        expect(blocks(service(body))).toEqual(['error · services\nDependency cycle: web → web.']);
      },
    );

    it('reports an implicit cycle through links and a namespace', () => {
      const text =
        'services:\n  a:\n    image: x\n    links: [b]\n  b:\n    image: y\n    network_mode: service:a\n';

      expect(blocks(text)).toEqual(['error · services\nDependency cycle: a → b → a.']);
    });

    it('rejects a non-string version and keeps the obsolete warning', () => {
      const { errors, warnings } = validateCompose('version: 3\nservices:\n  a: { image: x }\n');

      expect(errors).toEqual([{ message: 'expected a string.', path: 'version' }]);
      expect(warnings).toHaveLength(1);
    });

    it('needs a source on secrets and configs', () => {
      const top = (body: string): boolean =>
        validateCompose(`services:\n  a: { image: x }\n${body}\n`).valid;

      expect(blocks('secrets:\n  s: {}\n')).toEqual([
        'error · secrets.s\none of file, environment must be set.',
      ]);

      expect(blocks('configs:\n  c: { file: a, content: b }\n')).toEqual([
        'error · configs.c\nfile, environment, content are mutually exclusive.',
      ]);

      expect(top('secrets:\n  s:')).toBe(false);
      expect(top('secrets:\n  s: { file: a }')).toBe(true);
      expect(top('secrets:\n  s: { environment: A }')).toBe(true);
      expect(top('secrets:\n  s: { external: true }')).toBe(true);
      expect(top('secrets:\n  s: { driver: d }')).toBe(true);
      expect(top('configs:\n  c: { content: a }')).toBe(true);
      expect(top('volumes:\n  v:')).toBe(true);
    });

    it.each([
      'hostname: "${"',
      'hostname: "${}"',
      'hostname: "${a b}"',
      'labels: { a: "x${y:z}" }',
    ])('rejects the invalid interpolation in %s', (body) => {
      const { errors } = validateCompose(service(body));

      expect(errors[0]?.message).toContain('Invalid interpolation');
    });

    it.each([
      'hostname: "$${"',
      'hostname: "$5"',
      'hostname: "${a}"',
      'hostname: "${a:-${b}}"',
      'hostname: "${a?e}"',
    ])('accepts the interpolation in %s', (body) => {
      expect(validateCompose(service(body)).errors).toEqual([]);
    });
  });

  describe('values Docker Compose accepts', () => {
    const service = (body: string): string => `services:\n  web:\n    image: nginx\n    ${body}\n`;

    it.each(['tty: yes', 'stdin_open: "yes"', 'privileged: off'])(
      'warns about the old boolean in %s',
      (body) => {
        const { valid, warnings } = validateCompose(service(body));

        expect(valid).toBe(true);
        expect(warnings[0]?.message).toContain('YAML 1.2');
      },
    );

    it.each([
      'privileged: "true"',
      'read_only: "false"',
      'init: "true"',
      'command: null',
      'entrypoint: null',
      'cpus: 1e3',
      'cpus: "0.5"',
      'cpus: .5',
      'mem_limit: 1.5g',
      'mem_limit: 1gb',
      'mem_limit: 1048576',
      'shm_size: 64M',
      'memswap_limit: -1',
      'pids_limit: -1',
      'pids_limit: "100"',
      'scale: "2"',
      'scale: ${N}',
      'cpu_rt_runtime: 400ms',
      'mem_swappiness: "10"',
      'oom_score_adj: -1000',
      'container_name: web-1_x.y',
      'container_name: -bad',
      'pull_policy: if_not_present',
      'pull_policy: every_12h',
      'extra_hosts: ["a:1.2.3.4", "b=::1", "${H}"]',
      'extra_hosts: { a: 1.2.3.4, b: [1.2.3.4, ::1] }',
      'env_file: a.env',
      'env_file: [a.env, { path: b.env, required: false, format: raw }]',
      'deploy:',
      'develop:',
      'deploy: { labels: { a: b }, placement: { constraints: [a] }, endpoint_mode: vip }',
      'deploy: { resources: { limits: { pids: 100, cpus: "0.5", memory: 1g } } }',
      'deploy: { update_config: { order: start-first, delay: 5s, parallelism: 2 }, x-a: 1 }',
      'develop: { watch: [{ action: sync+restart, path: ./a, target: /b, ignore: [c] }] }',
      'logging: { driver: json-file, options: { max-size: 1m } }',
      'ulimits: { nofile: 1024, nproc: { soft: 1, hard: "2" } }',
      'provider: { type: model, options: { a: b } }',
      'blkio_config: { weight: 10, device_read_bps: [{ path: /d, rate: 1 }] }',
      'ports: ["0:80"]',
      'ports: ["0:80", "0:81"]',
    ])('accepts %s', (body) => {
      const { errors, warnings } = validateCompose(service(body));

      expect(errors).toEqual([]);
      expect(warnings).toEqual([]);
    });

    it('accepts declared models and a shared namespace', () => {
      const text = [
        'services:',
        '  a:',
        '    image: x',
        '    models: [m]',
        '  b:',
        '    image: y',
        '    models: { m: { endpoint_var: E } }',
        '    ipc: "service:a"',
        'models:',
        '  m: { model: ai/x }',
      ].join('\n');

      expect(validateCompose(text).errors).toEqual([]);
    });
  });

  it('skips interpolated values and counts them', () => {
    const text = [
      'services:',
      '  web:',
      '    image: ${IMAGE}',
      '    ports: ["${PORT}:80"]',
      '    depends_on: ["${DEP}"]',
      '    volumes: ["$DATA:/data"]',
      '    tty: $$literal',
    ].join('\n');
    const { summary, validation } = run(text);

    expect(validation.errors.map((issue) => issue.path)).toEqual(['services.web.tty']);
    expect(summary).toBe('Invalid · 1 error · 1 service · 4 interpolated values not checked.');

    expect(run(text.replace('\n    tty: $$literal', '')).summary).toBe(
      'Valid · 1 service · 4 interpolated values not checked.',
    );

    expect(run('services:\n  a:\n    image: ${I}\n').summary).toBe(
      'Valid · 1 service · 1 interpolated value not checked.',
    );
  });

  it('counts an interpolated reference once', () => {
    const base = 'services:\n  a:\n    image: x\n';

    expect(run(`${base}    links: ["\${L}"]\n`).summary).toBe(
      'Valid · 1 service · 1 interpolated value not checked.',
    );

    expect(run(`${base}    network_mode: "service:\${S}"\n`).summary).toBe(
      'Valid · 1 service · 1 interpolated value not checked.',
    );
  });

  it('treats prototype names as ordinary services', () => {
    const text =
      'services:\n  __proto__:\n    image: a\n    depends_on: [constructor]\n  constructor:\n    image: b\n';
    const { summary, validation } = run(text);

    expect(validation.errors).toEqual([]);
    expect(summary).toBe('Valid · 2 services.');
    expect(blocks('services:\n  a:\n    image: a\n    __proto__: 1\n')[0]).toContain('unknown key');
  });

  it('names its limits', () => {
    const pad = (size: number): string => `services:\n  a:\n    image: a\n#${'x'.repeat(size)}`;
    const base = pad(0).length;

    expect(validateCompose(pad(1_000_000 - base)).valid).toBe(true);

    expect(() => validateCompose(pad(1_000_001 - base))).toThrow(
      'Docker Compose Validator supports at most 1,000,000 characters.',
    );

    const services = (amount: number): string =>
      `services:\n${Array.from({ length: amount }, (_, index) => `  s${index}: { image: a }`).join('\n')}\n`;

    expect(validateCompose(services(1_000)).services).toBe(1_000);

    expect(() => validateCompose(services(1_001))).toThrow(
      'Docker Compose Validator supports at most 1,000 services.',
    );

    const many = run(
      `services:\n${Array.from({ length: 501 }, (_, index) => `  s${index}: { image: a, bad: 1 }`).join('\n')}\n`,
    );

    expect(many.validation.errors).toHaveLength(501);
    expect(many.report.split('\n\n')).toHaveLength(501);
    expect(many.report.split('\n\n')[0]).toBe('Showing 500 of 501 issues.');

    expect(
      run(
        `services:\n${Array.from({ length: 500 }, (_, index) => `  s${index}: { image: a, bad: 1 }`).join('\n')}\n`,
      ).report.split('\n\n'),
    ).toHaveLength(500);

    const nested = (depth: number): string => `${'['.repeat(depth)}${']'.repeat(depth)}`;

    expect(() => validateCompose(`x-deep: ${nested(101)}\nservices: {}\n`)).toThrow(
      /100 nested levels/,
    );

    expect(() => validateCompose('- a\n- b\n')).toThrow(
      'The Compose file must be a mapping at the top level.',
    );
  });

  it('suggests only near keys', () => {
    const issue = (key: string) =>
      validateCompose(`services:\n  a:\n    image: a\n    ${key}: 1\n`).errors.map(
        (entry) => entry.message,
      );

    expect(issue('imagee')).toEqual(['unknown key; did you mean "image"?']);
    expect(issue('x-anything')).toEqual([]);
    expect(issue('xx')).toEqual(['unknown key.']);
    expect(issue('a'.repeat(65))).toEqual(['unknown key.']);
    expect(issue('"quoted key"')).toEqual(['unknown key.']);

    expect(
      validateCompose(`services:\n  a:\n    image: a\n    "bad key": 1\n`).errors[0]?.path,
    ).toBe('services.a["bad key"]');
  });

  it('checks value shapes with exact messages', () => {
    const text = [
      'services:',
      '  "bad name":',
      '    image: a',
      '  b:',
      '    privileged: yes_please',
      '    scale: 1.5',
      '    ports: 80',
      '    command: 5',
      '    cgroup: nope',
      '    stop_grace_period: soon',
      '    labels: 1',
      '    deploy: []',
      '    cpus: [1]',
      '    hostname: 5',
      '  c: {}',
      '  d:',
      '    image: a',
      '    healthcheck: { test: [echo], timeout: 3 }',
      '    volumes: [{ source: s }, "rel:rel", "/a:/b:zz", 5]',
      '    ports: [{ mode: weird }, [1]]',
      '    environment: [ "=x", { A: [1] } ]',
      '    restart: sometimes',
      '    depends_on: { a: { condition: never }, b: 5 }',
    ].join('\n');

    expect(blocks(text)).toEqual([
      'error · services["bad name"]\nService names use only letters, digits, ".", "_" and "-".',
      'error · services.b\nneeds image or build.',
      'error · services.b.privileged\nexpected a boolean.',
      'error · services.b.scale\nexpected an integer.',
      'error · services.b.ports\nexpected a list.',
      'error · services.b.command\nexpected a string or a list.',
      'error · services.b.cgroup\nexpected one of: host, private.',
      'error · services.b.stop_grace_period\nexpected a duration such as 30s or 1m30s.',
      'error · services.b.labels\nexpected a list or a mapping.',
      'error · services.b.deploy\nexpected a mapping.',
      'error · services.b.cpus\nexpected a number.',
      'error · services.b.hostname\nexpected a string.',
      'error · services.c\nneeds image or build.',
      'error · services.d.healthcheck.test\ntest must be a string or a list starting with NONE, CMD or CMD-SHELL.',
      'error · services.d.healthcheck.timeout\nexpected a duration such as 30s or 1m30s.',
      'error · services.d.volumes[0]\nlong syntax needs target.',
      'error · services.d.volumes[0]\nlong syntax needs type.',
      'error · services.d.volumes[3]\nexpected a string or a mapping.',
      'error · services.d.ports[0]\nlong syntax needs target.',
      'error · services.d.ports[1]\nexpected a string, a number or a mapping.',
      'error · services.d.environment[1]\nEnvironment entry 1 needs a variable name.',
      'error · services.d.depends_on.a\ndepends on undefined service "a".',
      'error · services.d.depends_on.a.condition\nexpected one of: service_started, service_healthy, service_completed_successfully.',
      'error · services.d.depends_on.b\nexpected a mapping.',
      'warning · services.d.volumes[1]\nThe volume target is not an absolute path. Docker Compose accepts it, but the container may refuse it when it starts.',
      'warning · services.d.volumes[2]\nUnknown volume mode "zz". Docker Compose accepts it, but the engine may refuse it when the container starts.',
      'warning · services.d.ports[0].mode\nexpected one of: host, ingress. Docker Compose accepts other text, but the engine may refuse it when the stack starts.',
      'warning · services.d.environment[0]\nEnvironment entry 0 has no variable name. Docker Compose accepts it, but the container may refuse it when it starts.',
      'warning · services.d.restart\nrestart must be no, always, on-failure, on-failure:N or unless-stopped. Docker Compose accepts this value, but the engine refuses it when the container starts.',
    ]);
  });

  it('says Valid with a warning for values Docker Compose accepts', () => {
    for (const [line, path] of [
      ['ports: [{ target: 80, mode: foo }]', 'ports[0].mode'],
      ['volumes: ["/a:/b:foo"]', 'volumes[0]'],
      ['volumes: ["a:b"]', 'volumes[0]'],
      ['environment: ["=1"]', 'environment[0]'],
      ['restart: on-failure:x', 'restart'],
      ['restart: foo', 'restart'],
      ['healthcheck: { test: [] }', 'healthcheck.test'],
    ] as const) {
      const report = validateCompose(`services:\n  web:\n    image: nginx\n    ${line}\n`);

      expect(report.errors, line).toEqual([]);
      expect(report.valid, line).toBe(true);

      expect(
        report.warnings.map((issue) => issue.path),
        line,
      ).toEqual([`services.web.${path}`]);
    }
  });

  it('reads a Windows drive in the source and the target', () => {
    const report = validateCompose(
      'services:\n  web:\n    image: nginx\n    volumes: ["C:\\\\x:C:\\\\y", "C:\\\\x:C:\\\\y:ro"]\n',
    );

    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('keeps refusing what Docker Compose refuses next to those values', () => {
    for (const line of [
      'ports: [{ target: 80, mode: 1 }]',
      'volumes: ["/a:/b:ro:z"]',
      'volumes: ["ab:/b:foo"]',
      'environment: [1]',
      'restart: 1',
      'healthcheck: { test: [FOO, a] }',
    ]) {
      const report = validateCompose(`services:\n  web:\n    image: nginx\n    ${line}\n`);

      expect(report.valid, line).toBe(false);
    }
  });
});
