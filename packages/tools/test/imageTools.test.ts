import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { ToolError, type ToolResult } from '@devtoolora/core';
import { imageToAscii, inspectImage } from '@devtoolora/functions/image';
import { browserImageCodeTools } from '../src/catalog/imagesCodes';
import {
  dataUri,
  decodeArtifact,
  decodePng,
  encodePng,
  fakeJpeg,
  fakeWebp,
  installFakeImageApis,
  solidImage,
  type Call,
  type RawImage,
} from './fakeImageApis';

const red: [number, number, number, number] = [255, 0, 0, 255];

/** A 40 × 20 image: 10 blue columns, 20 red columns, 10 green columns. */
function stripes(): RawImage {
  const image = solidImage(40, 20, red);

  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 40; x += 1) {
      if (x < 10) image.data.set([0, 0, 255, 255], (y * 40 + x) * 4);
      if (x >= 30) image.data.set([0, 255, 0, 255], (y * 40 + x) * 4);
    }
  }

  return image;
}

function pixel(image: RawImage, x: number, y: number): number[] {
  return Array.from(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
}

async function runTool(id: string, fields: Record<string, string>, text = ''): Promise<ToolResult> {
  const tool = browserImageCodeTools.find((entry) => entry.id === id);

  assert.ok(tool, id);

  return tool.run({ fields, text });
}

function zipEntries(result: ToolResult): Record<string, Uint8Array> {
  assert.ok(result.artifact);

  return unzipSync(new Uint8Array(Buffer.from(result.artifact.base64, 'base64')));
}

const stripesPng = dataUri(encodePng(stripes()), 'image/png');
let calls: Call[] = [];
let restore = () => {};

describe('image tools with canvas stand-ins', () => {
  beforeEach(() => ({ calls, restore } = installFakeImageApis()));
  afterEach(() => restore());

  it('image-to-ascii falls back to the standard ramp for an unknown density', async () => {
    const file = { bytes: encodePng(stripes()), mimeType: 'image/png', name: 'stripes.png' };
    const standard = await imageToAscii(file, { width: 8 });
    const unknown = await imageToAscii(file, {
      density: 'constructor' as 'standard',
      width: 8,
    });

    assert.equal(unknown, standard);
  });

  it('batch-image-tools center crops to Max width × Max height when the checkbox is on', async () => {
    const images = JSON.stringify([{ data: stripesPng, name: 'a.png' }]);
    const cropped = zipEntries(
      await runTool('batch-image-tools', {
        contactSheet: 'false',
        crop: 'true',
        format: 'png',
        height: '10',
        images,
        width: '10',
      }),
    );
    const image = decodePng(cropped['image-001.png']!);

    assert.deepEqual([image.width, image.height], [10, 10]);
    for (const [x, y] of [
      [0, 0],
      [9, 9],
      [0, 9],
      [9, 0],
    ] as const)
      assert.deepEqual(pixel(image, x, y), red);

    const stretched = decodePng(
      zipEntries(
        await runTool('batch-image-tools', {
          contactSheet: 'false',
          crop: 'false',
          format: 'png',
          height: '10',
          images,
          width: '10',
        }),
      )['image-001.png']!,
    );

    assert.deepEqual(pixel(stretched, 0, 0), [0, 0, 255, 255]);

    const oneSide = decodePng(
      zipEntries(
        await runTool('batch-image-tools', {
          contactSheet: 'false',
          crop: 'true',
          format: 'png',
          images,
          width: '20',
        }),
      )['image-001.png']!,
    );

    assert.deepEqual([oneSide.width, oneSide.height], [20, 10]);
  });

  it('batch-image-tools counts only inputs and builds the contact sheet from the files that worked', async () => {
    const images = JSON.stringify([
      { data: stripesPng, name: 'a.png' },
      { data: 'data:image/png;base64,AAAA', name: 'broken.png' },
      { data: stripesPng, name: 'b.png' },
    ]);
    const result = await runTool('batch-image-tools', { format: 'webp', images, prefix: 'shot' });

    assert.equal(result.batch?.total, 3);
    assert.equal(result.batch?.succeeded, 2);

    assert.deepEqual(
      result.batch?.failed.map((entry) => entry.name),
      ['broken.png'],
    );

    assert.deepEqual(Object.keys(zipEntries(result)).sort(), [
      'contact-sheet.jpg',
      'shot-001.webp',
      'shot-003.webp',
    ]);

    assert.equal(result.text, 'Processed 2 of 3 images; 1 failed.');

    const single = await runTool('batch-image-tools', {
      format: 'jpeg',
      images: JSON.stringify([{ data: stripesPng, name: 'a.png' }]),
    });

    assert.equal(single.batch?.succeeded, 1);
    assert.equal(single.text, 'Processed 1 image.');

    assert.deepEqual(Object.keys(zipEntries(single)).sort(), [
      'contact-sheet.jpg',
      'image-001.jpg',
    ]);

    await assert.rejects(
      runTool('batch-image-tools', {
        images: JSON.stringify([{ data: 'data:image/png;base64,AAAA', name: 'broken.png' }]),
      }),
      /No image could be processed\. broken\.png:/,
    );
  });

  it('image-tools crops keep the cropped size unless Width or Height is set', async () => {
    const center = decodeArtifact(
      (
        await runTool('image-tools', {
          cropMode: 'center',
          format: 'png',
          image: stripesPng,
          operation: 'transform',
        })
      ).artifact!.base64,
    );

    assert.deepEqual([center.width, center.height], [20, 20]);
    assert.deepEqual(pixel(center, 0, 0), red);
    assert.deepEqual(pixel(center, 19, 19), red);

    const scaled = decodeArtifact(
      (
        await runTool('image-tools', {
          cropMode: 'center',
          format: 'png',
          image: stripesPng,
          keepAspect: 'true',
          operation: 'transform',
          width: '10',
        })
      ).artifact!.base64,
    );

    assert.deepEqual([scaled.width, scaled.height], [10, 10]);

    const custom = decodeArtifact(
      (
        await runTool('image-tools', {
          cropHeight: '10',
          cropMode: 'custom',
          cropWidth: '30',
          cropX: '5',
          cropY: '5',
          format: 'png',
          image: stripesPng,
          keepAspect: 'true',
          operation: 'transform',
          width: '15',
        })
      ).artifact!.base64,
    );

    assert.deepEqual([custom.width, custom.height], [15, 5]);

    const clamped = decodeArtifact(
      (
        await runTool('image-tools', {
          cropHeight: '50',
          cropMode: 'custom',
          cropWidth: '50',
          cropX: '30',
          cropY: '0',
          format: 'png',
          image: stripesPng,
          operation: 'transform',
        })
      ).artifact!.base64,
    );

    assert.deepEqual([clamped.width, clamped.height], [10, 20]);

    const exact = decodeArtifact(
      (
        await runTool('image-tools', {
          cropMode: 'center',
          format: 'png',
          height: '5',
          image: stripesPng,
          keepAspect: 'false',
          operation: 'transform',
          width: '30',
        })
      ).artifact!.base64,
    );

    assert.deepEqual([exact.width, exact.height], [30, 5]);
  });

  it('image-tools names JPEG output .jpg and reports metadata dimensions in the summary', async () => {
    const transformed = await runTool('image-tools', {
      format: 'jpeg',
      image: stripesPng,
      imageName: 'photo.png',
      operation: 'transform',
    });

    assert.equal(transformed.artifact?.fileName, 'photo.jpg');
    const compressed = await runTool('image-tools', {
      compression: 'small',
      format: 'jpeg',
      image: stripesPng,
      imageName: 'photo.png',
      operation: 'compress',
    });

    assert.equal(compressed.artifact?.fileName, 'photo.jpg');
    assert.match(compressed.summary ?? '', /^Compressed at quality 55\./);
    const original = await runTool('image-tools', {
      format: 'original',
      image: dataUri(fakeJpeg(stripes()), 'image/jpeg'),
      imageName: 'IMG_1.JPG',
      operation: 'grayscale',
    });

    assert.equal(original.artifact?.fileName, 'IMG_1.jpg');

    const metadata = await runTool('image-tools', {
      image: stripesPng,
      imageName: 'stripes.png',
      operation: 'metadata',
    });

    assert.equal(metadata.summary, 'Image metadata · 40 × 20 · image/png');
  });

  it('inspectImage reads the format from the signature and transparency from the pixels', async () => {
    const opaqueRgba = await inspectImage({
      bytes: encodePng(stripes()),
      mimeType: 'image/png',
      name: 'a.png',
    });

    assert.equal(opaqueRgba.transparent, false);

    assert.deepEqual(opaqueRgba.file, {
      height: 20,
      mimeType: 'image/png',
      name: 'a.png',
      width: 40,
    });

    const rgb = await inspectImage({
      bytes: encodePng(stripes(), { rgb: true }),
      mimeType: 'image/png',
      name: 'b.png',
    });

    assert.equal(rgb.transparent, false);
    const withHole = stripes();

    withHole.data[3] = 0;

    assert.equal(
      (await inspectImage({ bytes: encodePng(withHole), mimeType: 'image/png', name: 'c.png' }))
        .transparent,
      true,
    );

    assert.equal(
      (await inspectImage({ bytes: fakeWebp(withHole), mimeType: 'image/webp', name: 'c.webp' }))
        .transparent,
      true,
    );

    const misnamed = await inspectImage({
      bytes: fakeJpeg(stripes()),
      mimeType: 'image/png',
      name: 'photo.png',
    });

    assert.equal(misnamed.detectedFormat, 'jpeg');
    assert.equal(misnamed.detectedExtension, 'jpg');
    assert.equal(misnamed.mimeType, 'image/jpeg');
    assert.equal(misnamed.file.mimeType, 'image/png');
    assert.equal(misnamed.transparent, false);
  });

  it('exif-remover reports PNG metadata only for metadata chunks', async () => {
    const plain = JSON.parse(
      (await runTool('exif-remover', { image: stripesPng, imageName: 'plain.png' })).text,
    );

    assert.deepEqual(plain.metadata, { chunks: [], hasExif: false, parsed: {} });

    const text = new TextEncoder().encode('Software\0GIMP');
    const tagged = JSON.parse(
      (
        await runTool('exif-remover', {
          image: dataUri(
            encodePng(stripes(), { chunks: [{ data: text, type: 'tEXt' }] }),
            'image/png',
          ),
          imageName: 'tagged.png',
        })
      ).text,
    );

    assert.deepEqual(tagged.metadata, {
      chunks: ['tEXt'],
      hasExif: true,
      parsed: { Software: 'GIMP' },
    });

    const timed = JSON.parse(
      (
        await runTool('exif-remover', {
          image: dataUri(
            encodePng(stripes(), {
              chunks: [{ data: new Uint8Array([7, 234, 6, 14, 19, 42, 7]), type: 'tIME' }],
            }),
            'image/png',
          ),
          imageName: 'timed.png',
        })
      ).text,
    );

    assert.equal(timed.metadata.hasExif, true);
    assert.deepEqual(timed.metadata.chunks, ['tIME']);
  });

  it('exif-remover keeps WebP as WebP with its transparency', async () => {
    const sticker = solidImage(8, 8, [0, 0, 0, 0]);

    sticker.data.set(red, 0);
    const result = await runTool('exif-remover', {
      image: dataUri(fakeWebp(sticker), 'image/webp'),
      imageName: 'sticker.webp',
    });

    assert.equal(result.artifact?.mimeType, 'image/webp');
    assert.equal(result.artifact?.fileName, 'sticker.metadata-stripped.webp');
    const output = decodeArtifact(result.artifact!.base64);

    assert.deepEqual(pixel(output, 0, 0), red);
    assert.equal(pixel(output, 7, 7)[3], 0);
    assert.equal(result.summary, undefined);
  });

  it('web-pwa-icon-generator draws the Border radius and asks for an image in Image mode', async () => {
    await runTool('web-pwa-icon-generator', {
      sourceMode: 'text',
      textLabel: 'DT',
      textRadius: '96',
    });

    const radii = calls.filter((call) => call.method === 'arcTo').map((call) => call.args[4]);

    assert.ok(radii.includes(96), `512 px icon uses radius 96, got ${radii.join(', ')}`);
    assert.ok(radii.includes(36), '192 px icon scales the radius to 36');
    assert.ok(radii.includes(72), 'the maskable icon scales the radius to its 384 px safe zone');

    calls.length = 0;

    await runTool('web-pwa-icon-generator', {
      sourceMode: 'text',
      textLabel: 'DT',
      textRadius: '0',
    });

    assert.equal(calls.filter((call) => call.method === 'arcTo').length, 0);
    assert.ok(calls.some((call) => call.method === 'fillRect' && call.args[2] === 512));

    await assert.rejects(
      runTool('web-pwa-icon-generator', { sourceMode: 'image' }),
      (error: unknown) => error instanceof ToolError && /Source image/.test(error.message),
    );

    await assert.rejects(
      runTool('web-pwa-icon-generator', { sourceMode: 'text', textLabel: 'A', textRadius: '-4' }),
      /Border radius/,
    );
  });

  it('svg-to-png accepts an XML prolog and sizes the PNG from width and height first', async () => {
    const svg =
      '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: Adobe Illustrator 27.0.0 -->\n<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24"><rect width="24" height="24" fill="#ff0000"/></svg>';
    const png = decodeArtifact((await runTool('svg-to-png', {}, svg)).artifact!.base64);

    assert.deepEqual([png.width, png.height], [128, 128]);

    assert.match(
      String(calls.find((call) => call.method === 'renderSvg')?.args[0]),
      /<\?xml[\s\S]*-->\n<svg width="128" height="128" viewBox="0 0 24 24"/,
      'the prolog stays and the page draws at the output size',
    );

    const widthOnly = decodeArtifact(
      (
        await runTool(
          'svg-to-png',
          {},
          '<svg width="100" viewBox="0 0 50 25"><rect width="50" height="25"/></svg>',
        )
      ).artifact!.base64,
    );

    assert.deepEqual([widthOnly.width, widthOnly.height], [100, 50]);
    const inches = decodeArtifact(
      (
        await runTool(
          'svg-to-png',
          {},
          '<svg width="1in" height="0.5in" viewBox="0 0 2 1"><rect width="2" height="1"/></svg>',
        )
      ).artifact!.base64,
    );

    assert.deepEqual([inches.width, inches.height], [96, 48]);
    const percent = decodeArtifact(
      (
        await runTool(
          'svg-to-png',
          {},
          '<svg width="100%" height="100%" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>',
        )
      ).artifact!.base64,
    );

    assert.deepEqual([percent.width, percent.height], [24, 24]);
    const limited = decodeArtifact(
      (await runTool('svg-to-png', { width: '64' }, svg)).artifact!.base64,
    );

    assert.deepEqual([limited.width, limited.height], [64, 64]);

    await assert.rejects(
      runTool('svg-to-png', {}, '<div><svg></svg></div>'),
      /starting with <svg>/,
    );

    await assert.rejects(runTool('svg-to-png', { file: 'not a file' }, ''), /SVG file must be/);
  });
});

describe('exif-remover without WebP encoding', () => {
  beforeEach(() => ({ restore } = installFakeImageApis({ webp: false })));
  afterEach(() => restore());

  it('flattens a transparent WebP on white as JPEG and says so', async () => {
    const sticker = solidImage(8, 8, [0, 0, 0, 0]);

    sticker.data.set(red, 0);
    const result = await runTool('exif-remover', {
      image: dataUri(fakeWebp(sticker), 'image/webp'),
      imageName: 'sticker.webp',
    });

    assert.equal(result.artifact?.mimeType, 'image/jpeg');
    assert.equal(result.artifact?.fileName, 'sticker.metadata-stripped.jpg');
    const output = decodeArtifact(result.artifact!.base64);

    assert.deepEqual(pixel(output, 7, 7), [255, 255, 255, 255]);
    assert.deepEqual(pixel(output, 0, 0), red);
    assert.match(result.summary ?? '', /cannot save WebP.*JPEG.*white/);
  });
});

describe('image-tools pixel operations', () => {
  beforeEach(() => ({ calls, restore } = installFakeImageApis()));
  afterEach(() => restore());

  async function transformed(fields: Record<string, string>): Promise<RawImage> {
    calls.length = 0;
    const result = await runTool('image-tools', { format: 'png', image: stripesPng, ...fields });

    return decodeArtifact(result.artifact!.base64);
  }

  function drawCalls(method: string): unknown[][] {
    return calls.filter((call) => call.method === method).map((call) => call.args);
  }

  it('rotate swaps the canvas size for quarter turns and normalizes negative angles', async () => {
    const quarter = await transformed({ angle: '90', operation: 'rotate' });

    assert.deepEqual([quarter.width, quarter.height], [20, 40]);
    assert.deepEqual(drawCalls('translate'), [[10, 20]]);
    assert.deepEqual(drawCalls('rotate'), [[Math.PI / 2]]);

    const negative = await transformed({ angle: '-90', operation: 'rotate' });

    assert.deepEqual([negative.width, negative.height], [20, 40]);
    assert.deepEqual(drawCalls('rotate'), [[(270 * Math.PI) / 180]]);

    const half = await transformed({ angle: '180', operation: 'rotate' });

    assert.deepEqual([half.width, half.height], [40, 20]);
  });

  it('flip mirrors with the matching scale and draw offset', async () => {
    await transformed({ flipMode: 'horizontal', operation: 'flip' });
    assert.deepEqual(drawCalls('scale'), [[-1, 1]]);
    assert.deepEqual(drawCalls('save'), [[]]);
    assert.deepEqual(drawCalls('restore'), [[]]);
    assert.deepEqual(drawCalls('drawImage').at(-1), [40, 20, -40, 0, 40, 20]);

    await transformed({ flipMode: 'vertical', operation: 'flip' });
    assert.deepEqual(drawCalls('scale'), [[1, -1]]);
    assert.deepEqual(drawCalls('drawImage').at(-1), [40, 20, 0, -20, 40, 20]);
  });

  it('color-blindness applies each simulation matrix and grayscale for achromatopsia', async () => {
    const expected: Record<string, number[][]> = {
      achromatopsia: [
        [29, 29, 29, 255],
        [76, 76, 76, 255],
        [150, 150, 150, 255],
      ],
      deuteranopia: [
        [0, 0, 179, 255],
        [159, 179, 0, 255],
        [96, 77, 77, 255],
      ],
      protanopia: [
        [0, 0, 193, 255],
        [145, 142, 0, 255],
        [110, 113, 62, 255],
      ],
      tritanopia: [
        [0, 145, 134, 255],
        [242, 0, 0, 255],
        [13, 110, 121, 255],
      ],
    };

    for (const [mode, pixels] of Object.entries(expected)) {
      const image = await transformed({ colorBlindnessMode: mode, operation: 'color-blindness' });

      assert.deepEqual(
        [pixel(image, 0, 0), pixel(image, 20, 0), pixel(image, 39, 0)],
        pixels,
        mode,
      );
    }
  });

  it('filters builds the CSS filter string and watermark places rotated text', async () => {
    const contexts: Array<{ filter: string }> = [];
    const proto = OffscreenCanvas.prototype;
    const original = proto.getContext;

    proto.getContext = function (this: OffscreenCanvas, ...args: [string]) {
      const context = original.apply(this, args as never) as unknown as { filter: string };

      contexts.push(context);

      return context as never;
    } as never;

    try {
      await transformed({
        blur: '1',
        brightness: '1.5',
        contrast: '2',
        invert: 'true',
        operation: 'filters',
        saturation: '0.5',
        sepia: 'true',
      });
    } finally {
      proto.getContext = original;
    }

    assert.ok(
      contexts.some(
        (context) =>
          context.filter ===
          'brightness(1.5) contrast(2) saturate(0.5) blur(1px) sepia(1) invert(1)',
      ),
    );

    await transformed({
      operation: 'watermark',
      watermarkColor: '#ff0000',
      watermarkOpacity: '0.5',
      watermarkPosition: 'top-right',
      watermarkRotation: '10',
      watermarkSize: '12',
      watermarkText: 'Hi',
    });

    assert.deepEqual(drawCalls('translate'), [[30, 5]]);
    assert.deepEqual(drawCalls('rotate'), [[(10 * Math.PI) / 180]]);
    assert.deepEqual(drawCalls('fillText'), [['Hi', 0, 0]]);

    await transformed({ operation: 'watermark' });
    assert.deepEqual(drawCalls('translate'), [[20, 10]]);
    assert.deepEqual(drawCalls('rotate'), [[(-30 * Math.PI) / 180]]);
    assert.deepEqual(drawCalls('fillText'), [['Watermark', 0, 0]]);

    await transformed({ operation: 'watermark', watermarkPosition: 'bottom-left' });
    assert.deepEqual(drawCalls('translate'), [[10, 15]]);
  });

  describe('annotate', () => {
    const base = { image: stripesPng, operation: 'annotate' };

    async function annotate(annotations: string, fields: Record<string, string> = {}) {
      calls.length = 0;
      const result = await runTool('image-tools', { ...base, annotations, ...fields });

      return { image: decodeArtifact(result.artifact!.base64), result };
    }

    it('keeps the source format and size, and redacts with opaque black', async () => {
      const { image, result } = await annotate('redact 0 0 10 10');

      assert.equal(result.artifact?.mimeType, 'image/png');
      assert.deepEqual([image.width, image.height], [40, 20]);
      assert.deepEqual(pixel(image, 5, 5), [0, 0, 0, 255]);
      assert.deepEqual(pixel(image, 15, 5), red);

      const fill = calls.find((call) => call.method === 'fillRect' && call.args[0] === 0);

      assert.deepEqual(fill?.state, {
        fillStyle: '#000000',
        font: '32px sans-serif',
        globalAlpha: 1,
      });
    });

    it('stays correct with JPEG output and a width that would otherwise resize', async () => {
      const { image } = await annotate('redact 0 0 10 10', {
        format: 'jpeg',
        height: '5',
        width: '8',
      });

      assert.deepEqual([image.width, image.height], [40, 20]);
      assert.deepEqual(pixel(image, 5, 5), [0, 0, 0, 255]);
    });

    it('highlights at 35 % opacity in the chosen color', async () => {
      await annotate('highlight 10 0 10 10', { annotationColor: '#ffff00' });

      const fill = calls.find((call) => call.method === 'fillRect');

      assert.equal(fill?.state?.globalAlpha, 0.35);
      assert.equal(fill?.state?.fillStyle, '#ffff00');
    });

    it('draws a label box and text sized with measureText, and a filled arrow head', async () => {
      await annotate('label 2 3 Hi\narrow 0 0 30 0', {
        annotationFont: 'monospace',
        annotationFontSize: '20',
      });

      const rounded = calls.find((call) => call.method === 'roundRect');
      const text = calls.find((call) => call.method === 'fillText');

      // measureText width 0.6 × 20 × 2 = 24, plus padding 5 on both sides.
      assert.deepEqual(rounded?.args, [2, 3, 34, 30, 5]);
      assert.deepEqual(text?.args, ['Hi', 7, 8]);
      assert.equal(text?.state?.font, '20px monospace');
      assert.ok(calls.findIndex((call) => call.method === 'roundRect') < calls.indexOf(text!));
      assert.ok(calls.some((call) => call.method === 'closePath'));
      assert.ok(calls.some((call) => call.method === 'fill'));
    });

    it('uses a 32px sans-serif font, a text halo and rejects bad input', async () => {
      await annotate('text 1 2 hello');

      const halo = calls.find((call) => call.method === 'strokeText');

      assert.equal(halo?.state?.font, '32px sans-serif');
      assert.deepEqual(halo?.args, ['hello', 1, 2]);

      await assert.rejects(
        runTool('image-tools', { ...base, annotations: 'box 1 2 3 4' }),
        (error: unknown) =>
          error instanceof ToolError && /^Line 1: unknown command "box"/.test(error.message),
      );

      await assert.rejects(runTool('image-tools', { ...base, annotations: '' }), ToolError);

      await assert.rejects(
        runTool('image-tools', { ...base, annotationFontSize: '7', annotations: 'text 0 0 a' }),
        ToolError,
      );
    });

    it('shows the annotation fields only for annotate', () => {
      const tool = browserImageCodeTools.find((entry) => entry.id === 'image-tools');
      const fields = tool?.fields?.filter((field) => field.id.startsWith('annotation')) ?? [];

      assert.equal(fields.length, 5);
      for (const field of fields)
        assert.deepEqual(field.visibleWhen, { field: 'operation', is: ['annotate'] });
    });
  });
});
