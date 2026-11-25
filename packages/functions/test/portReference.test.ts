import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { lookupPorts } from '@devtoolora/functions/network';
import { ianaPortRows } from '../src/network/portRegistryData';

describe('port reference', () => {
  it('lists IANA and unofficial entries for a port', () => {
    assert.match(
      lookupPorts('22').text,
      /^22 tcp\/udp\/sctp ssh: The Secure Shell \(SSH\) Protocol$/m,
    );

    assert.match(lookupPorts('5432').text, /^5432 tcp\/udp postgresql: PostgreSQL Database$/m);
    assert.match(lookupPorts('1521').text, /^1521 unofficial: Oracle Database listener$/m);
    assert.match(lookupPorts('1521').text, /^1521 tcp\/udp ncube-lm: nCube License Manager$/m);
    assert.match(lookupPorts('6885').text, /^6881-6889 unofficial: BitTorrent$/m);
  });

  it('reports ports outside the table with their IANA range', () => {
    assert.equal(
      lookupPorts('12345').text,
      '12345: not in the offline table (User Ports 1024-49151).\n',
    );

    assert.match(lookupPorts('60000').text, /Dynamic Ports 49152-65535/);
    assert.equal(lookupPorts('12345').entries, 0);
  });

  it('matches text, ranges and protocol filters', () => {
    assert.match(lookupPorts('redis').text, /^6379 tcp redis: /m);
    assert.match(lookupPorts('KAFKA').text, /^9092 unofficial: Apache Kafka$/m);
    assert.match(lookupPorts('22', 'udp').text, /^22 udp ssh: /m);
    assert.doesNotMatch(lookupPorts('22', 'udp').text, /sctp/);
    assert.match(lookupPorts('1521', 'udp').text, /unofficial/);
    assert.equal(lookupPorts('20-23').entries > 3, true);
    assert.equal(lookupPorts('zzzz-no-match').text, 'No entries match "zzzz-no-match".\n');
  });

  it('rejects invalid queries', () => {
    assert.throws(() => lookupPorts('70000'), /0-65535/);
    assert.throws(() => lookupPorts('100-1'), /start/);
    assert.throws(() => lookupPorts('   '), /required/);
    assert.throws(() => lookupPorts('x'.repeat(129)), /128 characters/);
  });

  it('caps the listing at 500 entries', () => {
    const result = lookupPorts('e');

    assert.equal(result.shown, 500);
    assert.ok(result.entries > 500);
    assert.equal(result.text.split('\n').length, 501);
    assert.equal(ianaPortRows.includes(String.fromCharCode(160)), false);
  });
});
