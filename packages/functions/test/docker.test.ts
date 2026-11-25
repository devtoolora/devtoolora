import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { parse } from 'yaml';
import { inspectDockerRun } from '../src/dev';

describe('Docker Run to Compose', () => {
  it('separates options, image and command without swallowing command flags', () => {
    const report = inspectDockerRun(
      'docker container run --name=worker -p8080:80 -eMODE=test node:22 node --version',
    );

    assert.equal(report.image, 'node:22');
    assert.deepEqual(report.command, ['node', '--version']);
    assert.equal(report.compose.services.app.container_name, 'worker');
    assert.deepEqual(report.compose.services.app.ports, ['8080:80']);
    assert.deepEqual(report.compose.services.app.environment, ['MODE=test']);
    assert.deepEqual(parse(report.text), report.compose);
  });

  it('preserves adjacent quotes, empty arguments, literal dollars and escaping', () => {
    const report = inspectDockerRun(
      'docker run -e "GREETING=hello world" alpine printf "%s" pre\'fix\' "" \'$HOME\' \\$NAME "a\\q"',
    );

    assert.deepEqual(report.command, ['printf', '%s', 'prefix', '', '$HOME', '$NAME', 'a\\q']);
    const yaml = parse(report.text);

    assert.deepEqual(yaml.services.app.command, [
      'printf',
      '%s',
      'prefix',
      '',
      '$$HOME',
      '$$NAME',
      'a\\q',
    ]);

    assert.deepEqual(yaml.services.app.environment, ['GREETING=hello world']);

    assert.deepEqual(inspectDockerRun('docker run alpine echo \'"yaml": # value\'').command, [
      'echo',
      '"yaml": # value',
    ]);

    assert.deepEqual(
      inspectDockerRun('docker run --entrypoint="" alpine ""').compose.services.app.entrypoint,
      [],
    );

    assert.deepEqual(
      inspectDockerRun('docker run --entrypoint "/app/a b" alpine').compose.services.app.entrypoint,
      ['/app/a b'],
    );
  });

  it('supports bounded multiline commands without allowing a second shell command', () => {
    const original = '\n docker run \\\r\n --name app \\\n alpine echo hi\r\n';
    const report = inspectDockerRun(original);

    assert.equal(report.originalInput, original);
    assert.deepEqual(report.command, ['echo', 'hi']);
    assert.throws(() => inspectDockerRun('docker run alpine\necho hi'), /backslash-newline/);
    assert.throws(() => inspectDockerRun('docker run alpine ' + 'a '.repeat(2049)), /2,048/);
    assert.throws(() => inspectDockerRun('x'.repeat(100001)), /100,000/);
    assert.throws(() => inspectDockerRun('docker run alpine\u0000'), /Unicode/);
    assert.throws(() => inspectDockerRun('docker run alpine\uD800'), /Unicode/);
  });

  it('maps named, anonymous and bind mounts without project renaming or invented path creation', () => {
    const report = inspectDockerRun(
      'docker run -v pgdata:/data:ro -v /cache:ro -v "/srv/my site:/site:ro,Z" --mount type=bind,src=/srv/config,dst=/config,readonly --mount type=volume,source=cache,target=/cache2,volume-nocopy alpine',
    );

    assert.deepEqual(report.compose.volumes, {
      cache: { name: 'cache' },
      pgdata: { name: 'pgdata' },
    });

    const mounts = report.compose.services.app.volumes;

    assert.deepEqual(mounts, [
      { read_only: true, source: 'pgdata', target: '/data', type: 'volume' },
      { read_only: true, target: '/cache', type: 'volume' },
      {
        bind: { create_host_path: true, selinux: 'Z' },
        read_only: true,
        source: '/srv/my site',
        target: '/site',
        type: 'bind',
      },
      {
        bind: { create_host_path: false },
        read_only: true,
        source: '/srv/config',
        target: '/config',
        type: 'bind',
      },
      { source: 'cache', target: '/cache2', type: 'volume', volume: { nocopy: true } },
    ]);

    assert.deepEqual(
      inspectDockerRun("docker run -v 'C:\\data:/data:ro' alpine").compose.services.app.volumes,
      [
        {
          bind: { create_host_path: true },
          read_only: true,
          source: 'C:\\data',
          target: '/data',
          type: 'bind',
        },
      ],
    );

    assert.deepEqual(
      inspectDockerRun('docker run -v ./data:/data alpine').compose.services.app.volumes,
      [{ bind: { create_host_path: true }, source: './data', target: '/data', type: 'bind' }],
    );
  });

  it('maps network and launch choices with explicit lifecycle and exposure warnings', () => {
    const report = inspectDockerRun(
      'docker run --rm -dit --network app-net --privileged --env API_TOKEN --env-file ./app.env alpine sh',
    );

    assert.deepEqual(report.compose.networks, {
      'run-network': { external: true, name: 'app-net' },
    });

    assert.deepEqual(report.compose.services.app.networks, ['run-network']);
    assert.equal(report.compose.services.app.stdin_open, true);
    assert.equal(report.compose.services.app.tty, true);
    assert.equal(report.compose.services.app.rm, undefined);
    assert.match(report.warnings.join('\n'), /up -d/);
    assert.match(report.warnings.join('\n'), /run --rm app/);
    assert.match(report.warnings.join('\n'), /unresolved/);
    assert.match(report.warnings.join('\n'), /secrets/);
    assert.match(report.warnings.join('\n'), /Privileged/);

    assert.equal(
      inspectDockerRun('docker run --network host alpine').compose.services.app.network_mode,
      'host',
    );
  });

  it('validates resource and port basics, preserves lists and explains repeated scalar flags', () => {
    const report = inspectDockerRun(
      'docker run --name first --name last --read-only=false --init --cpus 0.5 -m256m --user 1000:1000 -w/app --restart on-failure:3 --dns 1.1.1.1 --expose 80 --cap-drop ALL --security-opt no-new-privileges=true --tmpfs /tmp -lteam=platform -p "[::1]:8080:80" alpine',
    );

    assert.equal(report.compose.services.app.container_name, 'last');
    assert.equal(report.compose.services.app.cpus, 0.5);
    assert.equal(report.compose.services.app.mem_limit, '256m');
    assert.equal(report.compose.services.app.read_only, false);
    assert.match(report.warnings.join('\n'), /last value/);

    assert.deepEqual(
      inspectDockerRun('docker run -p 8080-8081:80-81/udp alpine').compose.services.app.ports,
      ['8080-8081:80-81/udp'],
    );

    assert.deepEqual(inspectDockerRun('docker run -p 0:80 alpine').compose.services.app.ports, [
      '0:80',
    ]);

    for (const command of [
      'docker run -p 65536:80 alpine',
      'docker run -p 80:0 alpine',
      'docker run -p 999.1.1.1:80:80 alpine',
      'docker run -p 8080-8082:80-81 alpine',
      'docker run --cpus 0 alpine',
      'docker run --memory -1 alpine',
      'docker run --restart nonsense alpine',
    ])
      assert.throws(() => inspectDockerRun(command));
  });

  it('accepts Docker syntax written in its shorter forms', () => {
    const service = (command: string) => inspectDockerRun(command).compose.services.app;

    assert.deepEqual(service('docker run -dp 80:80 nginx').ports, ['80:80']);
    assert.deepEqual(service('docker run -itp 80:80 nginx').ports, ['80:80']);
    assert.equal(service('docker run -itp 80:80 nginx').tty, true);
    assert.deepEqual(service('docker run -dp80:80 nginx').ports, ['80:80']);
    assert.match(JSON.stringify(service('docker run -v .:/x nginx').volumes), /"source":"\."/);
    assert.match(JSON.stringify(service('docker run -v ..:/x nginx').volumes), /"type":"bind"/);
    assert.equal(service('docker run --cpus .5 nginx').cpus, 0.5);
    assert.equal(service('docker run --memory 100mb nginx').mem_limit, '100mb');
    assert.throws(() => inspectDockerRun('docker run -dq nginx'), /Unsupported Docker option/);
  });

  it('rejects values Docker and Compose would reject', () => {
    assert.throws(() => inspectDockerRun('docker run --name x nginx'), /at least two characters/);
    assert.throws(() => inspectDockerRun('docker run --add-host foo nginx'), /host:ip or host=ip/);

    assert.deepEqual(
      inspectDockerRun('docker run --add-host foo:1.2.3.4 nginx').compose.services.app.extra_hosts,
      ['foo:1.2.3.4'],
    );
  });

  it('fails on unsupported flags, conflicts, malformed mounts and unsafe shell interpretation', () => {
    for (const command of [
      '',
      'alpine',
      'sudo docker run alpine',
      'docker --context x run alpine',
      'docker run',
      'docker run --name',
      'docker run --gpus all alpine',
      'docker run --publish-all alpine',
      'docker run --rm --restart always alpine',
      'docker run --network host -p 8080:80 alpine',
      'docker run --network one --network two alpine',
      'docker run -v volume:relative alpine',
      'docker run -v data:/data:ro,rw alpine',
      'docker run --mount type=bind,source=missing,target=/data alpine',
      'docker run --mount type=volume,source=data,target=/data,unknown=true alpine',
      'docker run --mount type=bind,source=/data,target=/data,volume-nocopy alpine',
      'docker run --env BAD-NAME=x alpine',
      'docker run --name "not a name" alpine',
      'docker run alpine echo $HOME',
      'docker run alpine echo "$HOME"',
      'docker run alpine echo $(whoami)',
      'docker run alpine echo `whoami`',
      'docker run alpine; echo hi',
      'docker run alpine | cat',
      'docker run alpine echo *.txt',
      'docker run alpine echo ~',
      'docker run alpine # comment',
      'docker run alpine "unterminated',
      'docker run alpine trailing\\',
    ])
      assert.throws(() => inspectDockerRun(command), command);

    assert.deepEqual(inspectDockerRun("docker run alpine echo '$(whoami); *.txt'").command, [
      'echo',
      '$(whoami); *.txt',
    ]);

    assert.deepEqual(inspectDockerRun('docker run -- alpine --name fake').command, [
      '--name',
      'fake',
    ]);
  });
});
