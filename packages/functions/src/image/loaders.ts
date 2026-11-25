type ExifrModule = typeof import('exifr');
type JsQrModule = typeof import('jsqr');
let exifrPromise: Promise<ExifrModule> | undefined;
let jsQrPromise: Promise<JsQrModule> | undefined;

export function loadExifr(): Promise<ExifrModule> {
  exifrPromise ??= import('exifr');

  return exifrPromise;
}

export function loadJsQr(): Promise<JsQrModule> {
  jsQrPromise ??= import('jsqr');

  return jsQrPromise;
}
