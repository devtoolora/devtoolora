import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { loadToolContent } from '@devtoolora/browser-catalog/lazy';

const tools = listBrowserWorkerTools();
const canonical = tools.filter((tool) => !tool.aliasOf);

describe('tool guides', () => {
  for (const tool of canonical) {
    it(`${tool.id} has a complete guide, questions and related tools`, async () => {
      const content = await loadToolContent(tool.id);

      assert.ok((content?.documentation?.length ?? 0) >= 2, 'What and When sections');

      assert.ok(
        (content?.help ?? '').split('\n\n').filter(Boolean).length >= 4,
        'at least four help steps',
      );

      assert.ok((content?.examples?.length ?? 0) >= 4, 'at least four examples');
      assert.ok((content?.notes?.length ?? 0) >= 3, 'at least three notes');
      assert.ok((tool.samples?.length ?? 0) >= 6, 'at least six samples');
      assert.ok((tool.relatedToolIds?.length ?? 0) >= 2, 'at least two related tools');
      assert.ok(!tool.relatedToolIds?.includes(tool.id), 'a tool is not related to itself');
      const faq = content?.faq ?? [];

      assert.ok(faq.length >= 3 && faq.length <= 6, `three to six questions, found ${faq.length}`);

      assert.equal(
        new Set(faq.map(({ question }) => question)).size,
        faq.length,
        'questions are unique',
      );

      for (const { answer, question } of faq) {
        assert.match(question, /^[A-Z0-9].*\?$/, question);

        assert.ok(
          answer.length >= 20 && answer.length <= 420,
          `${question} has a ${answer.length}-character answer`,
        );
      }
    });
  }

  it('keeps the texts out of the definitions and gives aliases a canonical tool', () => {
    for (const tool of tools) {
      for (const key of ['documentation', 'examples', 'faq', 'help', 'notes'])
        assert.equal(key in tool, false, `${tool.id}.${key}`);
    }

    for (const alias of tools.filter((tool) => tool.aliasOf))
      assert.ok(
        canonical.some((tool) => tool.id === alias.aliasOf),
        alias.id,
      );
  });
});
