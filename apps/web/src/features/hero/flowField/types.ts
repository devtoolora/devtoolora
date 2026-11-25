import type {
  BufferGeometry,
  IUniform,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type {
  GPUComputationRenderer,
  Variable,
} from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export type FlowField = {
  /** Flushes queued GPU work; the returned poll turns true once the GPU has finished it. */
  fence(): () => boolean;
  render(dt: number): void;
  resize(width: number, height: number, dpr: number): boolean;
  revealNow(): void;
  setPointer(x: number, y: number, active: boolean): void;
  setStar(x: number, y: number): void;
  setTheme(isLight: boolean): void;
  step(dt: number): void;
};

export type SharedUniforms = {
  uAspect: IUniform<number>;
  uPointer: IUniform<Vector2>;
  uPointerStrength: IUniform<number>;
  uStar: IUniform<Vector2>;
};

export type FieldState = {
  pointer: { strength: number; target: number; tx: number; ty: number; x: number; y: number };
  revealForced: boolean;
  size: { dpr: number; height: number; width: number };
  theme: { current: number; target: number };
  time: number;
};

export type FlowFieldContext = {
  bloom: UnrealBloomPass;
  camera: OrthographicCamera;
  composer: EffectComposer;
  compositeMaterial: ShaderMaterial;
  fadeMaterial: ShaderMaterial;
  fadeScene: Scene;
  gpu: GPUComputationRenderer;
  lineGeometry: BufferGeometry;
  lineMaterial: ShaderMaterial;
  lineScene: Scene;
  positions: Variable;
  quad: PlaneGeometry;
  renderer: WebGLRenderer;
  shared: SharedUniforms;
  simUniforms: Record<string, IUniform>;
  state: FieldState;
  trails: { read: WebGLRenderTarget; write: WebGLRenderTarget };
};

export type Simulation = Pick<FlowFieldContext, 'gpu' | 'positions' | 'simUniforms'>;
