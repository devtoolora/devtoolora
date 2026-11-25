import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { portReferenceTool } from '../src/catalog/network';
import { contentOf } from './toolContent';

const run = (text: string, protocol = 'any') =>
  portReferenceTool.run({ fields: { protocol }, text });

describe('port reference tool', () => {
  it('declares its fields', () => {
    assert.equal(portReferenceTool.id, 'port-reference');
    assert.equal(portReferenceTool.name, 'Port Reference');
    assert.equal(portReferenceTool.category, 'Network');
    assert.equal(portReferenceTool.inputKind, 'text');
    assert.equal(portReferenceTool.outputKind, 'text');

    assert.deepEqual(
      portReferenceTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [['protocol', 'Protocol', 'any']],
    );

    assert.deepEqual(portReferenceTool.relatedToolIds, ['random-port', 'ipv4-subnet']);
    assert.equal(contentOf(portReferenceTool).faq?.length, 4);
    assert.equal(portReferenceTool.samples?.length, 6);
  });

  it('looks up a port for every protocol filter', async () => {
    const any = await run('22');

    assert.match(any.text, /^22 tcp\/udp\/sctp ssh: /m);
    assert.equal(any.language, 'plaintext');
    assert.equal(any.artifact?.fileName, 'port-reference.txt');
    assert.equal(any.summary, '1 entry · offline subset of the IANA registry');

    assert.match((await run('22', 'tcp')).text, /^22 tcp ssh: /m);
    assert.match((await run('22', 'udp')).text, /^22 udp ssh: /m);
    assert.match((await run('1521')).summary ?? '', /^2 entries · offline/);
  });

  it('marks capped listings', async () => {
    assert.equal((await run('e')).summary?.startsWith('1,'), false);

    assert.match((await run('e')).summary ?? '', / entries · first 500 shown · offline/);
  });

  it('reports errors', async () => {
    await assert.rejects(async () => run('70000'), {
      message: 'Ports must be within 0-65535.',
    });

    await assert.rejects(async () => run('22', 'sctp'), {
      message: 'Choose any, TCP or UDP.',
    });
  });
});
