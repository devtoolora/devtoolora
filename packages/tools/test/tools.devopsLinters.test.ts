import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const toolIds = [
  'systemd-unit-builder',
  'ssh-config-generator',
  'wireguard-config-generator',
  'docker-compose-validator',
  'source-map-resolver',
  'regex-explainer',
  'markdown-linter',
  'pdf-compare',
];
const aliases: Record<string, string> = {
  'pdf-diff': 'pdf-compare',
  'wireguard-key-generator': 'wireguard-config-generator',
};

describe('DevOps configs, linters and PDF compare', () => {
  it('documents every tool and runs each of its six samples', async () => {
    for (const id of toolIds) {
      const tool = listBrowserWorkerTools().find((entry) => entry.id === id);

      assert.ok(tool, id);
      assert.equal(contentOf(tool).documentation?.length, 2, id);
      assert.equal(contentOf(tool).examples?.length, 6, id);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4, id);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 6, id);
      assert.ok((contentOf(tool).faq?.length ?? 0) >= 4, id);
      assert.ok((contentOf(tool).faq?.length ?? 0) <= 6, id);
      assert.equal(tool.samples?.length, 6, id);
      const fieldIds = new Set(tool.fields?.map((field) => field.id));

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(
          Object.keys(sample.fields ?? {}).filter((key) => !fieldIds.has(key)),
          [],
          `${id}: ${sample.label}`,
        );

        const output = await result(id, sample.text ?? '', {
          ...Object.fromEntries(
            (tool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
          ),
          ...sample.fields,
        });

        assert.ok(output.text.length > 0, `${id}: ${sample.label}`);
        assert.ok((output.summary ?? '').length > 0, `${id}: ${sample.label}`);
      }
    }
  });

  it('keeps the alias map', () => {
    const actual = Object.fromEntries(
      listBrowserWorkerTools()
        .filter((tool) => tool.aliasOf)
        .map((tool) => [tool.id, tool.aliasOf]),
    );

    for (const [id, target] of Object.entries(aliases)) assert.equal(actual[id], target, id);
  });

  it('opens the WireGuard alias on the key pair mode', () => {
    const alias = listBrowserWorkerTools().find((tool) => tool.id === 'wireguard-key-generator');

    assert.equal(alias?.fields?.find((field) => field.id === 'mode')?.defaultValue, 'keys');
    assert.equal(alias?.samples?.length, 6);
  });

  it('links these tools from related tools', () => {
    const tools = listBrowserWorkerTools();
    const links: [string, string][] = [
      ['regex-test', 'regex-explainer'],
      ['markdown-helper', 'markdown-linter'],
      ['text-diff', 'pdf-compare'],
      ['docker-to-compose', 'docker-compose-validator'],
      ['ssh-key-generator', 'ssh-config-generator'],
    ];

    for (const [from, to] of links) {
      const tool = tools.find((entry) => entry.id === from);

      assert.ok(tool?.relatedToolIds?.includes(to), `${from} -> ${to}`);
    }

    const stackTrace = tools.find((entry) => entry.id === 'stack-trace-cleaner');
    const answer = contentOf(stackTrace ?? { id: 'stack-trace-cleaner' }).faq?.find(
      (item) => item.question === 'Does it resolve source maps?',
    )?.answer;

    assert.ok(answer?.includes('Source Map Resolver'), 'stack-trace-cleaner FAQ');
  });
});
