import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import type { ToolContent, ToolDefinition, ToolFieldCondition } from '@devtoolora/core';
import { domainTools, type ToolDomain } from '../src/catalog';

const catalogDir = join(__dirname, '..', 'src', 'catalog');
const domains = Object.keys(domainTools) as ToolDomain[];
const allTools: ToolDefinition[] = domains.flatMap((domain) => domainTools[domain]);

function domainDir(domain: string): string {
  return join(catalogDir, domain);
}

function toolFolders(domain: string): string[] {
  return readdirSync(domainDir(domain), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function conditionFields(conditions: ToolFieldCondition | ToolFieldCondition[] | undefined) {
  const fields: string[] = [];

  for (const condition of [conditions ?? []].flat()) {
    if ('anyOf' in condition) fields.push(...conditionFields(condition.anyOf));
    else fields.push(condition.field);
  }

  return fields;
}

function referencedFields(tool: ToolDefinition): Array<{ field: string; where: string }> {
  const refs = [
    ...conditionFields(tool.fields?.flatMap((field) => field.visibleWhen ?? [])).map((field) => ({
      field,
      where: 'a visibleWhen condition',
    })),
    ...conditionFields(tool.inputVisibleWhen).map((field) => ({
      field,
      where: 'inputVisibleWhen',
    })),
    ...conditionFields(tool.fileModeWhen).map((field) => ({ field, where: 'fileModeWhen' })),
    ...(tool.runRequires ?? []).flatMap((requirement) => [
      ...requirement.anyOf
        .filter((field) => field !== '$text')
        .map((field) => ({ field, where: 'runRequires.anyOf' })),
      ...conditionFields(requirement.when).map((field) => ({ field, where: 'runRequires.when' })),
    ]),
  ];

  if (tool.selectionTarget) {
    refs.push({ field: tool.selectionTarget.field, where: 'selectionTarget.field' });

    for (const field of Object.keys(tool.selectionTarget.fields ?? {}))
      refs.push({ field, where: 'selectionTarget.fields' });
  }

  return refs;
}

describe('catalog conventions', () => {
  it('gives every fileModeWhen tool the fields the Base64-style file UI relies on', () => {
    for (const tool of allTools.filter((candidate) => candidate.fileModeWhen)) {
      const ids = new Set(tool.fields?.map((field) => field.id));

      for (const required of ['file', 'fileName', 'fileOutput', 'mode'])
        assert.ok(
          ids.has(required),
          `Tool '${tool.id}' declares fileModeWhen but has no '${required}' field. File mode needs fields file, fileName, fileOutput and mode.`,
        );
    }
  });

  it('keeps only index.ts, shared.ts and tool folders directly in a domain folder', () => {
    for (const domain of domains) {
      const stray = readdirSync(domainDir(domain), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
        .map((entry) => entry.name)
        .filter((name) => name !== 'index.ts' && name !== 'shared.ts');

      assert.deepEqual(
        stray,
        [],
        `catalog/${domain}/ may only hold index.ts and shared.ts. Move ${stray.join(', ')} into a catalog/${domain}/<tool-id>/ folder.`,
      );
    }
  });

  it('gives every tool folder a tool.ts whose canonical tool is registered in its domain', () => {
    for (const domain of domains) {
      for (const dir of toolFolders(domain)) {
        assert.ok(
          existsSync(join(domainDir(domain), dir, 'tool.ts')),
          `catalog/${domain}/${dir}/ has no tool.ts. Add it or remove the folder.`,
        );

        const tool = domainTools[domain].find((candidate) => candidate.id === dir);

        assert.ok(
          tool && !tool.aliasOf,
          `catalog/${domain}/${dir}/ must define a canonical tool with id '${dir}' listed in catalog/${domain}/index.ts.`,
        );
      }
    }
  });

  it('gives every canonical tool a folder and content.ts, and aliases no folder', () => {
    for (const domain of domains) {
      const folders = toolFolders(domain);

      for (const tool of domainTools[domain]) {
        if (tool.aliasOf) {
          assert.ok(
            !folders.includes(tool.id),
            `Alias '${tool.id}' must not have its own folder in catalog/${domain}/. Define it in the tool.ts of '${tool.aliasOf}'.`,
          );

          continue;
        }

        assert.ok(
          folders.includes(tool.id),
          `Tool '${tool.id}' needs a catalog/${domain}/${tool.id}/ folder with tool.ts and content.ts.`,
        );
      }
    }
  });

  it('exports content with a non-empty faq from every canonical tool content.ts', async () => {
    for (const domain of domains) {
      for (const dir of toolFolders(domain)) {
        const file = join(domainDir(domain), dir, 'content.ts');

        assert.ok(existsSync(file), `catalog/${domain}/${dir}/ has no content.ts. Add it.`);

        const module = (await import(file)) as { content?: ToolContent };

        assert.ok(module.content, `catalog/${domain}/${dir}/content.ts must export 'content'.`);

        assert.ok(
          module.content.faq?.length,
          `catalog/${domain}/${dir}/content.ts needs at least one faq entry.`,
        );
      }
    }
  });

  it('gives every canonical tool its own search keywords', () => {
    for (const tool of allTools.filter((candidate) => !candidate.aliasOf))
      assert.ok(
        tool.keywords?.length,
        `Tool '${tool.id}' has no keywords. Add the terms people search for that its name lacks.`,
      );
  });

  it('points relatedToolIds at existing tools', () => {
    const ids = new Set(allTools.map((tool) => tool.id));

    for (const tool of allTools)
      for (const related of tool.relatedToolIds ?? [])
        assert.ok(
          ids.has(related),
          `Tool '${tool.id}' lists unknown related tool '${related}'. Fix relatedToolIds.`,
        );
  });

  it('routes the VS Code selection into a field for selection tools without text input', () => {
    for (const tool of allTools.filter((candidate) => candidate.supportsSelection))
      assert.ok(
        tool.inputKind !== 'none' || tool.selectionTarget,
        `Tool '${tool.id}' supports selection but has no text input. Add selectionTarget.`,
      );
  });

  it('references only existing fields in declarative conditions', () => {
    for (const tool of allTools) {
      const known = new Set((tool.fields ?? []).map((field) => field.id));

      for (const { field, where } of referencedFields(tool))
        assert.ok(
          known.has(field),
          `Tool '${tool.id}' uses unknown field '${field}' in ${where}. Add the field or fix the id.`,
        );
    }
  });
});
