import type { ToolPlatformActions } from '@devtoolora/tool-ui';
import { getVscode } from './vscodeHost';

function base64(bytes: Uint8Array): string {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

export const vscodePlatformActions: ToolPlatformActions = {
  async copyText(text) {
    getVscode().postMessage({
      action: 'copy',
      result: { language: 'plaintext', text },
      type: 'resultAction',
    });
  },
  async saveFile(file) {
    getVscode().postMessage({
      action: 'save',
      result: {
        artifact: { base64: base64(file.bytes), fileName: file.fileName, mimeType: file.mimeType },
        text: '',
      },
      type: 'resultAction',
    });

    // The host reports the outcome; the dialog may still be cancelled.
    return false;
  },
};
