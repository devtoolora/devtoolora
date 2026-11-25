import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { type ToolResult } from '@devtoolora/core';
import { browserImageCodeTools } from '../src/catalog/imagesCodes';
import { socialImagePresets } from '../src/catalog/imagesCodes/batch-image-tools/presets';
import {
  dataUri,
  decodeArtifact,
  encodePng,
  installFakeImageApis,
  solidImage,
} from './fakeImageApis';

let restore = () => {};

beforeEach(() => ({ restore } = installFakeImageApis()));
afterEach(() => restore());

const photo = JSON.stringify([
  {
    data: dataUri(encodePng(solidImage(400, 300, [255, 0, 0, 255])), 'image/png'),
    name: 'photo.png',
  },
]);

async function runTool(id: string, fields: Record<string, string>): Promise<ToolResult> {
  const tool = browserImageCodeTools.find((entry) => entry.id === id);

  assert.ok(tool, id);

  const defaults = Object.fromEntries(
    (tool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
  );

  return tool.run({ fields: { ...defaults, ...fields }, text: '' });
}

function zipEntries(output: ToolResult): Record<string, Uint8Array> {
  assert.ok(output.artifact);

  return unzipSync(new Uint8Array(Buffer.from(output.artifact.base64, 'base64')));
}

describe('batch image tools: social media presets', () => {
  it('lists the twelve presets from the spec', () => {
    assert.deepEqual(
      socialImagePresets.map((preset) => `${preset.id} ${preset.width}x${preset.height}`),
      [
        'instagram-square 1080x1080',
        'instagram-portrait 1080x1350',
        'instagram-story 1080x1920',
        'open-graph 1200x630',
        'facebook-cover 851x315',
        'x-post 1600x900',
        'x-header 1500x500',
        'linkedin-post 1200x627',
        'linkedin-banner 1584x396',
        'youtube-thumbnail 1280x720',
        'youtube-banner 2560x1440',
        'pinterest-pin 1000x1500',
      ],
    );
  });

  it('outputs the exact preset size and hides the custom size fields', async () => {
    const output = await runTool('batch-image-tools', {
      contactSheet: 'false',
      format: 'webp',
      images: photo,
      preset: 'instagram-story',
    });
    const files = zipEntries(output);

    assert.deepEqual(Object.keys(files), ['photo-1080x1920.webp']);

    const image = decodeArtifact(Buffer.from(files['photo-1080x1920.webp']!).toString('base64'));

    assert.deepEqual([image.width, image.height], [1080, 1920]);

    const tool = browserImageCodeTools.find((entry) => entry.id === 'batch-image-tools');
    const hidden = (id: string) =>
      JSON.stringify(tool?.fields?.find((field) => field.id === id)?.visibleWhen);

    for (const id of ['width', 'height', 'crop'])
      assert.match(hidden(id), /"field":"preset","is":\["custom"\]/, id);
  });

  it('rejects an unknown preset', async () => {
    await assert.rejects(
      runTool('batch-image-tools', { images: photo, preset: 'nope' }),
      /preset/i,
    );
  });

  it('names repeated sources apart and keeps custom names unchanged', async () => {
    const twice = JSON.stringify(
      [...JSON.parse(photo), ...JSON.parse(photo)].map((f) => ({ ...f, name: 'pin.png' })),
    );
    const preset = zipEntries(
      await runTool('batch-image-tools', {
        contactSheet: 'false',
        format: 'jpeg',
        images: twice,
        preset: 'pinterest-pin',
      }),
    );
    const custom = zipEntries(
      await runTool('batch-image-tools', { contactSheet: 'false', format: 'png', images: twice }),
    );

    assert.deepEqual(Object.keys(preset), ['pin-1000x1500.jpg', 'pin-1000x1500-2.jpg']);
    assert.deepEqual(Object.keys(custom), ['image-001.png', 'image-002.png']);
  });

  it('defaults the alias to a square jpeg without a contact sheet', async () => {
    const alias = browserImageCodeTools.find((entry) => entry.id === 'social-media-image-resizer');
    const defaults = Object.fromEntries(
      (alias?.fields ?? []).map((field) => [field.id, field.defaultValue]),
    );

    assert.equal(alias?.aliasOf, 'batch-image-tools');
    assert.equal(defaults.mode, 'batch');
    assert.equal(defaults.preset, 'instagram-square');
    assert.equal(defaults.format, 'jpeg');
    assert.equal(defaults.quality, '85');
    assert.equal(defaults.contactSheet, 'false');

    const files = zipEntries(await runTool('social-media-image-resizer', { images: photo }));

    assert.deepEqual(Object.keys(files), ['photo-1080x1080.jpg']);
  });
});
