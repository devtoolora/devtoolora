import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { composeEnums, composeKeys } from '../src/dev/composeSpec';
import {
  environmentErrors,
  isDuration,
  isInterpolated,
  isNamedVolume,
  parsePort,
  parseVolume,
  restartError,
  restartWarning,
} from '../src/dev/composeValues';

const portError = (value: string): string => `"${value}" is not a valid port mapping.`;

describe('composeSpec', () => {
  it('derives the table from compose-go v2.16.2', () => {
    expect(composeKeys.serviceKinds.size).toBe(94);

    expect([...composeKeys.top]).toEqual([
      'version',
      'name',
      'include',
      'services',
      'models',
      'networks',
      'volumes',
      'secrets',
      'configs',
      'jobs',
    ]);

    expect(composeKeys.serviceKinds.get('cpus')).toBe('number');
    expect(composeKeys.serviceKinds.get('restart')).toBe('restart');
    expect(composeKeys.serviceKinds.get('stop_grace_period')).toBe('duration');
    expect(composeKeys.serviceKinds.get('__proto__')).toBeUndefined();
    expect(composeKeys.volumesLong.has('type')).toBe(true);
    expect(composeKeys.volumesLong.has('image')).toBe(true);
    expect(composeEnums.get('ports.mode')).toEqual(['host', 'ingress']);

    expect(
      statSync(fileURLToPath(new URL('../src/dev/composeSpec.ts', import.meta.url))).size,
    ).toBeLessThanOrEqual(12_288);
  });
});

describe('composeValues', () => {
  it('accepts the short port forms people write', () => {
    for (const value of [
      80,
      '80:80',
      '127.0.0.1::80',
      '[::1]:8080:80',
      '8000-8010:8000',
      '9090-9091:8080-8081',
      '53:53/udp',
    ]) {
      expect(typeof parsePort(value)).toBe('object');
    }

    expect(parsePort('[::1]:80')).toEqual({ hostIp: '[::1]', hostPorts: null, protocol: 'tcp' });
    expect(parsePort('53:53/udp')).toEqual({ hostIp: '', hostPorts: [53, 53], protocol: 'udp' });
    expect(parsePort('65535:80')).toMatchObject({ hostPorts: [65535, 65535] });
    expect(parsePort('0:80')).toEqual({ hostIp: '', hostPorts: null, protocol: 'tcp' });
    expect(parsePort('127.0.0.1:0:80')).toMatchObject({ hostIp: '127.0.0.1', hostPorts: null });

    for (const value of [
      '80:80:80',
      '65536:80',
      '9090-9091:8080-8082',
      '10-9:80',
      '::1:8080:80',
      '80/icmp',
      '__proto__',
    ]) {
      expect(parsePort(value)).toBe(portError(value));
    }
  });

  it('accepts the short volume forms people write', () => {
    for (const value of [
      'C:\\data:/data',
      '~/data:/data:ro,z',
      './data:/data',
      'data:/data',
      '/data',
      '/var/run/docker.sock:/var/run/docker.sock',
    ]) {
      expect(typeof parseVolume(value)).toBe('object');
    }

    expect(parseVolume('C:\\data:/data')).toEqual({
      mode: [],
      source: 'C:\\data',
      target: '/data',
    });

    expect(parseVolume('~/data:/data:ro,z')).toEqual({
      mode: ['ro', 'z'],
      source: '~/data',
      target: '/data',
    });

    expect(parseVolume('/data')).toEqual({ mode: [], source: null, target: '/data' });

    expect(parseVolume('C:\\x:C:\\y:ro')).toEqual({
      mode: ['ro'],
      source: 'C:\\x',
      target: 'C:\\y',
    });

    expect(parseVolume('D:/data')).toEqual({ mode: [], source: null, target: 'D:/data' });

    expect(parseVolume('data:relative')).toMatchObject({
      source: null,
      warning: expect.stringContaining('not an absolute path'),
    });

    expect(parseVolume('./a:/b:rw,bogus')).toMatchObject({
      source: './a',
      warning: expect.stringContaining('Unknown volume mode "bogus"'),
    });

    expect(parseVolume('ab:/b:ro:x')).toBe('"ab:/b:ro:x" is not a valid volume mapping.');
  });

  it('classifies named volumes', () => {
    expect(isNamedVolume('data')).toBe(true);

    for (const value of ['/a', './a', '~/a', '$A', 'a/b', 'a\\b']) {
      expect(isNamedVolume(value)).toBe(false);
    }
  });

  it('checks restart, durations and environment', () => {
    expect(restartError(false)).toBe('restart: write "no" in quotes.');

    for (const value of ['no', 'always', 'on-failure', 'on-failure:3', 'unless-stopped']) {
      expect(restartError(value)).toBeUndefined();
    }

    for (const value of ['sometimes', 'on-failure:', 'on-failure:x']) {
      expect(restartError(value)).toBeUndefined();
      expect(restartWarning(value)).toMatch(/^restart must be .* Docker Compose accepts/);
    }

    expect(restartWarning('on-failure:3')).toBeUndefined();
    expect(restartWarning(3)).toBeUndefined();

    expect(restartError(3)).toBe(
      'restart must be no, always, on-failure, on-failure:N or unless-stopped.',
    );

    for (const value of ['1m30s', '1.5h', '10µs']) {
      expect(isDuration(value)).toBe(true);
    }

    for (const value of ['1m30', 's', '']) {
      expect(isDuration(value)).toBe(false);
    }

    expect(environmentErrors(['A=1', 'B', '=x'])).toEqual([]);

    expect(environmentErrors(['A', 1])).toHaveLength(1);

    expect(environmentErrors({ A: { b: 1 }, B: 1, C: null, __proto__x: true })).toEqual([
      { index: 'A', message: 'Environment value for A must be a string, number, boolean or null.' },
    ]);
  });

  it('finds interpolation', () => {
    for (const value of ['${TAG}', '$HOME/x', 'a$_b']) {
      expect(isInterpolated(value)).toBe(true);
    }

    for (const value of ['$$HOME', 'cost $5', '$', '$$']) {
      expect(isInterpolated(value)).toBe(false);
    }
  });

  it('splits in linear time', () => {
    for (const run of [
      () => parsePort('1:'.repeat(50_000)),
      () => parseVolume('a:'.repeat(50_000)),
      () => isDuration('1m'.repeat(50_000) + 'x'),
    ]) {
      const start = performance.now();

      run();
      expect(performance.now() - start).toBeLessThan(100);
    }
  });
});
