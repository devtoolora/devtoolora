import type { SvgRenderReply, SvgRenderRequest } from '@devtoolora/functions/svg';

export function isSvgRenderRequest(message: unknown): message is SvgRenderRequest {
  return (message as { type?: unknown } | null | undefined)?.type === 'renderSvg';
}

const invalidMarkup =
  'The browser could not render this SVG. Check that it is well-formed XML: every tag closed and every namespace prefix declared.';
const blockedExport =
  'The browser refused to export this SVG as PNG, which <foreignObject> can cause. Remove that element or use another browser.';

async function drawSvg({ height, source, width }: SvgRenderRequest): Promise<Uint8Array> {
  const image = new Image();

  // A data: URL because a blob: SVG with <foreignObject> taints the canvas in Chromium. An image
  // document runs no scripts and loads nothing external.
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error(invalidMarkup));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  });

  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Could not create a 2D canvas context.');

  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

  if (!blob) throw new Error(`The browser could not encode a ${width} × ${height} PNG.`);

  return new Uint8Array(await blob.arrayBuffer());
}

/** Draws in the page for a worker, which has no SVG engine, and answers on the request's port. */
export async function answerSvgRender(request: SvgRenderRequest): Promise<void> {
  let reply: SvgRenderReply;

  try {
    reply = { bytes: await drawSvg(request) };
  } catch (error) {
    const isBlocked = error instanceof DOMException && error.name === 'SecurityError';

    reply = { error: isBlocked ? blockedExport : (error as Error).message };
  }

  request.port.postMessage(reply);
}
