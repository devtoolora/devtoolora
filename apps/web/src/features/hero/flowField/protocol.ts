// Kept free of three.js: the main thread imports it.

export const DEFAULT_STAR: { x: number; y: number } = { x: 0.9, y: 0.72 };

export type FlowFieldViewport = {
  dpr: number;
  height: number;
  star: { x: number; y: number };
  width: number;
};

export type FlowFieldCommand =
  | {
      canvas: OffscreenCanvas;
      isLight: boolean;
      side: number;
      type: 'init';
      viewport: FlowFieldViewport;
    }
  | { type: 'resize'; viewport: FlowFieldViewport }
  | { active: boolean; type: 'pointer'; x: number; y: number }
  | { isLight: boolean; type: 'theme' }
  | { running: boolean; type: 'running' };

export type FlowFieldEvent =
  | { bufferHeight: number; bufferWidth: number; type: 'ready' | 'resized' }
  | { reason: 'context-lost' | 'webgl'; type: 'failed' };
