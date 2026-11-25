// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ImageCropEditor } from '../src/tool-runner/editors';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const image = 'data:image/png;base64,AAAA';

function rect(left: number, top: number, width: number, height: number): () => DOMRect {
  return () => DOMRect.fromRect({ height, width, x: left, y: top });
}

function mount() {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const calls: string[] = [];
  const render = (fields: Record<string, string>) =>
    act(async () => {
      root.render(
        <ImageCropEditor
          fields={{ image, ...fields }}
          onFieldChange={(id, value) => calls.push(`${id}=${value}`)}
        />,
      );
    });
  const img = () => container.querySelector<HTMLImageElement>('#sourceImage')!;
  const box = () => container.querySelector<HTMLButtonElement>('#cropBox')!;

  const pointer = (type: string, clientX = 0, clientY = 0) => {
    box().setPointerCapture = () => {};
    box().dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY }));
  };

  const press = (key: string, shiftKey = false) =>
    act(async () => {
      box().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key, shiftKey }));
    });

  const load = () =>
    act(async () => {
      Object.defineProperty(img(), 'naturalWidth', { configurable: true, value: 1000 });
      Object.defineProperty(img(), 'naturalHeight', { configurable: true, value: 500 });
      img().dispatchEvent(new Event('load'));
    });

  const take = () => calls.splice(0).join(' ');

  return { box, calls, container, img, load, pointer, press, render, root, take };
}

describe('ImageCropEditor', () => {
  it('syncs the custom crop on load, drag, resize, arrow keys, aspect change, reset and cancel', async () => {
    const view = mount();

    await view.render({ cropAspect: 'free', cropMode: 'custom' });
    await view.load();
    assert.equal(view.take(), 'cropX=200 cropY=100 cropWidth=600 cropHeight=300');
    assert.equal(view.box().style.left, '20%');

    view.img().getBoundingClientRect = rect(0, 0, 200, 100);
    view.box().getBoundingClientRect = rect(40, 20, 120, 60);

    await act(async () => {
      view.pointer('pointerdown', 60, 40);
      view.pointer('pointermove', 80, 50);
      view.pointer('pointerup');
      view.pointer('pointermove');
    });

    assert.equal(view.take(), 'cropX=300 cropY=150 cropWidth=600 cropHeight=300');
    assert.equal(view.box().style.left, '30%');
    view.box().getBoundingClientRect = rect(60, 30, 120, 60);

    await act(async () => {
      view.pointer('pointerdown', 175, 85);
      view.pointer('pointermove', 155, 95);
      view.pointer('pointerup');
    });

    assert.equal(view.take(), 'cropX=300 cropY=150 cropWidth=500 cropHeight=350');
    await view.press('ArrowLeft');
    assert.equal(view.take(), 'cropX=290 cropY=150 cropWidth=500 cropHeight=350');
    await view.press('ArrowUp', true);
    assert.equal(view.take(), 'cropX=290 cropY=100 cropWidth=500 cropHeight=350');
    await view.render({ cropAspect: '1:1', cropMode: 'custom' });
    assert.equal(view.take(), 'cropX=290 cropY=0 cropWidth=500 cropHeight=500');
    assert.equal(view.box().style.height, '100%');

    await act(async () => {
      view.container.querySelector<HTMLButtonElement>('#resetCrop')!.click();
    });

    assert.equal(view.take(), 'cropX=200 cropY=100 cropWidth=400 cropHeight=400');

    await act(async () => {
      view.container.querySelector<HTMLButtonElement>('#cancelCrop')!.click();
    });

    assert.equal(view.take(), 'cropMode=none cropX= cropY= cropWidth= cropHeight=');

    await act(async () => {
      view.root.unmount();
    });
  });

  it('keeps a fixed aspect for the crop made on the first image load', async () => {
    const view = mount();

    await view.render({ cropAspect: '1:1', cropMode: 'custom' });
    await view.load();
    assert.equal(view.take(), 'cropX=200 cropY=100 cropWidth=400 cropHeight=400');

    await act(async () => {
      view.root.unmount();
    });
  });

  it('starts a crop when custom mode is chosen after load, and picks colors in picker mode', async () => {
    const view = mount();

    await view.render({ cropMode: 'none', operation: 'color-picker' });
    await view.load();
    assert.equal(view.take(), '');
    view.img().getBoundingClientRect = rect(10, 10, 200, 100);

    await act(async () => {
      view
        .img()
        .dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 60, clientY: 110 }));
    });

    assert.equal(view.take(), 'colorX=250 colorY=499');
    await view.render({ cropAspect: '16:9', cropMode: 'custom' });

    assert.equal(
      view.take(),
      'cropX=200 cropY=100 cropWidth=600 cropHeight=338 cropX=200 cropY=100 cropWidth=711 cropHeight=400',
    );

    await view.render({ cropAspect: '4:3', cropMode: 'custom', cropWidth: '10' });
    assert.equal(view.take(), 'cropX=200 cropY=100 cropWidth=533 cropHeight=400');

    await act(async () => {
      view.root.unmount();
    });
  });

  it('previews filters and the watermark', async () => {
    const view = mount();

    await view.render({ blur: '2', brightness: '1.2', operation: 'filters', sepia: 'true' });

    assert.equal(
      view.img().style.filter,
      'brightness(1.2) contrast(1) saturate(1) blur(2px) sepia(1)',
    );

    await view.render({ colorBlindnessMode: 'protanopia', operation: 'color-blindness' });
    assert.equal(view.img().style.filter, 'sepia(0.25) saturate(0.75) hue-rotate(-20deg)');
    await view.render({ operation: 'watermark', watermarkSize: 'x', watermarkText: 'Hi' });

    const watermark = view.container.querySelector<HTMLDivElement>(
      '[data-testid="watermark-preview"]',
    )!;

    assert.equal(watermark.textContent, 'Hi');
    assert.equal(watermark.dataset.position, 'center');
    assert.equal(watermark.style.fontSize, '28px');
    assert.equal(watermark.style.transform, 'rotate(-30deg)');
    await view.render({ image: '' });
    assert.equal(view.container.innerHTML, '');

    await act(async () => {
      view.root.unmount();
    });
  });
});
