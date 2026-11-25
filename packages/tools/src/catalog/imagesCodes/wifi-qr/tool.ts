import { ToolDefinition } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { createQrSvg, createWifiPayload } from '@devtoolora/functions/qr';
import { withToolError, withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

export const wifiQrTool: ToolDefinition = {
  id: 'wifi-qr',
  keywords: ['wi-fi', 'wireless', 'network', 'ssid', 'qr code', 'wpa'],
  name: 'WiFi QR Code',
  category: 'Images & Codes',
  description: 'Generate a QR Code payload for WiFi credentials.',
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  resultActions: ['save', 'copy', 'scratch'],
  fields: [
    { id: 'ssid', label: 'SSID', type: 'text', placeholder: 'Network name' },
    { id: 'password', label: 'Password', type: 'password', placeholder: 'WiFi password' },
    {
      id: 'security',
      label: 'Security',
      type: 'select',
      defaultValue: 'WPA',
      options: [
        { label: 'WPA/WPA2', value: 'WPA' },
        { label: 'WEP', value: 'WEP' },
        { label: 'None', value: 'nopass' },
      ],
    },
    { id: 'hidden', label: 'Hidden network', type: 'checkbox', defaultValue: 'false' },
  ],
  relatedToolIds: ['qr-code-reader', 'qr-code-generator', 'svg-to-png'],
  samples: [
    {
      fields: { password: 'secret-passphrase-123', security: 'WPA', ssid: 'Home-WiFi' },
      label: 'Standard home WPA network',
    },
    {
      fields: { password: '', security: 'nopass', ssid: 'CoffeeShop-Guest' },
      label: 'Guest network (no password)',
    },
    {
      fields: {
        hidden: 'true',
        password: 'enterprise-secure-key',
        security: 'WPA',
        ssid: 'Corp-Internal',
      },
      label: 'Hidden office network',
    },
    {
      fields: { password: '5B2D1F384C', security: 'WEP', ssid: 'Retro-Lab' },
      label: 'Legacy WEP network',
    },
    {
      fields: { password: 'latte:mocha;secure!', security: 'WPA', ssid: 'My Cafe & Lounge (5G)' },
      label: 'SSID with spaces & punctuation',
    },
    {
      fields: { password: 'k9#mP$2vL@xQ7*wR4!zT8&yB', security: 'WPA', ssid: 'Vault-Network' },
      label: 'High-security long password',
    },
  ],
  run: async ({ fields }) => {
    const payload = wifiQrPayload(fields);
    const svg = await withToolErrorAsync(() => createQrSvg(payload, { size: 256, margin: 4 }));
    const base64 = base64Encode(new TextEncoder().encode(svg));

    return {
      text: payload,
      language: 'plaintext',
      summary: 'WiFi QR payload generated.',
      previewDataUri: `data:image/svg+xml;base64,${base64}`,
      artifact: { base64, mimeType: 'image/svg+xml', fileName: 'wifi-qr.svg' },
      resultActions: ['save', 'copy', 'scratch'],
    };
  },
};

function wifiQrPayload(fields: Record<string, string>): string {
  const security =
    fields.security === 'WEP' || fields.security === 'nopass' ? fields.security : 'WPA';

  return withToolError(() =>
    createWifiPayload({
      ssid: fields.ssid ?? '',
      password: fields.password,
      security,
      hidden: fields.hidden === 'true',
    }),
  );
}
