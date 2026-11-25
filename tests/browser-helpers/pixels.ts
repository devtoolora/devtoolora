import type { Page } from '@playwright/test';

export function pngPixels(
  page: Page,
  png: Buffer,
  points: Array<[number, number]>,
): Promise<number[][]> {
  return page.evaluate(
    async ({ dataUri, points }) => {
      const image = new Image();

      image.src = dataUri;
      await image.decode();
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext('2d');

      context?.drawImage(image, 0, 0);

      return points.map(([x, y]) => [...(context?.getImageData(x, y, 1, 1).data ?? [])]);
    },
    { dataUri: `data:image/png;base64,${png.toString('base64')}`, points },
  );
}
