import { parseCssColor } from '../color/cssColor';
import { FunctionError } from '../errors';
import { boundedInteger } from '../validation';

type QrCode = typeof import('qrcode');
// CommonJS interop: bundlers may wrap the module under default.
type QrCodeModule = QrCode & { default?: QrCode };
export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';
let qrCodePromise: Promise<QrCodeModule> | undefined;

export function createWifiPayload(options: {
  hidden?: boolean;
  password?: string;
  security?: 'WPA' | 'WEP' | 'nopass';
  ssid: string;
}): string {
  const ssid = required(options.ssid, 'SSID');
  const security = options.security ?? 'WPA';
  const password = security === 'nopass' ? '' : required(options.password ?? '', 'WiFi password');

  return `WIFI:T:${escapeWifi(security)};S:${escapeWifi(ssid)};P:${escapeWifi(password)};H:${options.hidden ? 'true' : 'false'};;`;
}

export async function createQrSvg(
  payload: string,
  options: {
    background?: string;
    errorCorrection?: QrErrorCorrection;
    foreground?: string;
    margin?: number;
    size?: number;
  } = {},
): Promise<string> {
  const text = required(payload, 'QR text').trim();
  const module = await loadQrCode();
  const QRCode = module.default ?? module;

  return QRCode.toString(text, {
    type: 'svg',
    width: boundedInteger(options.size ?? 256, 'Size', 64, 2048),
    margin: boundedInteger(options.margin ?? 4, 'Margin', 0, 16),
    errorCorrectionLevel: options.errorCorrection ?? 'M',
    color: {
      dark: qrColor(options.foreground, '#000000', 'Foreground'),
      light: qrColor(options.background, '#ffffff', 'Background'),
    },
  });
}

function qrColor(value: string | undefined, fallback: string, label: string): string {
  const input = value?.trim() || fallback;
  let color: ReturnType<typeof parseCssColor>;

  try {
    color = parseCssColor(input);
  } catch {
    throw new FunctionError(
      'INVALID_QR_INPUT',
      `${label} must be a CSS color, such as #1d4ed8, rgb(29 78 216) or navy.`,
    );
  }

  const hex = (channel: number) =>
    Math.round(channel * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}${color.alpha < 1 ? hex(color.alpha) : ''}`;
}

function loadQrCode(): Promise<QrCodeModule> {
  qrCodePromise ??= import('qrcode');

  return qrCodePromise;
}

function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

// Returns the value untouched: WPA passphrases and SSIDs may start or end with spaces.
function required(value: string, label: string): string {
  if (!value.trim()) throw new FunctionError('INVALID_QR_INPUT', `${label} input is required.`);

  return value;
}
