import {
  AddEquation,
  BufferGeometry,
  CustomBlending,
  Float32BufferAttribute,
  FloatType,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  LineSegments,
  Mesh,
  NoToneMapping,
  OneFactor,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type IUniform,
  type TextureDataType,
} from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  COMPOSITE_FRAGMENT,
  FADE_FRAGMENT,
  LINE_FRAGMENT,
  LINE_VERTEX,
  QUAD_VERTEX,
  SIM_FRAGMENT,
} from './shaders';
import { DEFAULT_STAR } from './protocol';

import type { FieldState, FlowFieldContext, SharedUniforms, Simulation } from './types';

/** Per-channel trail decay at 60 fps – red/green die first so old trails sink into blue. */
export const TRAIL_DECAY = [0.93, 0.96, 0.986] as const;

export function createRenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  initialLight: boolean,
): WebGLRenderer | null {
  let renderer: WebGLRenderer;

  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }

  renderer.autoClear = false;
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(initialLight ? 0xf2f6f8 : 0x0b172d, 1);

  return renderer;
}

export function createSharedUniforms(): SharedUniforms {
  return {
    uAspect: { value: 1 } as IUniform<number>,
    uStar: { value: new Vector2(DEFAULT_STAR.x, DEFAULT_STAR.y) } as IUniform<Vector2>,
    uPointer: { value: new Vector2(0.5, 0.5) } as IUniform<Vector2>,
    uPointerStrength: { value: 0 } as IUniform<number>,
  };
}

export function createSimulation(
  renderer: WebGLRenderer,
  side: number,
  shared: SharedUniforms,
  floatTargets: boolean,
): Simulation | null {
  const gpu = new GPUComputationRenderer(side, side, renderer);

  gpu.setDataType(floatTargets ? FloatType : HalfFloatType);
  const initial = gpu.createTexture();
  const data = initial.image.data as Float32Array;

  for (let i = 0; i < side * side; i += 1) {
    const life = 3 + Math.random() * 5;

    data[i * 4] = -0.02 + Math.random() * 1.06;
    data[i * 4 + 1] = -0.02 + Math.random() * 1.06;
    data[i * 4 + 2] = Math.random() * life;
    data[i * 4 + 3] = life;
  }

  const positions = gpu.addVariable('texturePosition', SIM_FRAGMENT, initial);

  gpu.setVariableDependencies(positions, [positions]);
  const simUniforms = positions.material.uniforms;

  Object.assign(simUniforms, {
    ...shared,
    uTime: { value: 0 },
    uDelta: { value: 1 / 60 },
    uSpeed: { value: 1 },
  });

  if (gpu.init() !== null) {
    gpu.dispose();

    return null;
  }

  return { gpu, positions, simUniforms };
}

export function createLines(
  side: number,
  shared: SharedUniforms,
): Pick<FlowFieldContext, 'lineGeometry' | 'lineMaterial' | 'lineScene'> {
  const refs = new Float32Array(side * side * 6);

  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const o = (y * side + x) * 6;
      const u = (x + 0.5) / side;
      const v = (y + 0.5) / side;

      refs.set([u, v, 0, u, v, 1], o);
    }
  }

  const lineGeometry = new BufferGeometry();

  lineGeometry.setAttribute('position', new Float32BufferAttribute(refs, 3));
  const lineMaterial = new ShaderMaterial({
    uniforms: {
      ...shared,
      uPrev: { value: null },
      uCurr: { value: null },
      uDelta: { value: 1 / 60 },
      uIntensity: { value: 0.06 },
    },
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const lines = new LineSegments(lineGeometry, lineMaterial);

  lines.frustumCulled = false;
  const lineScene = new Scene();

  lineScene.add(lines);

  return { lineGeometry, lineMaterial, lineScene };
}

export function createTrails(
  trailType: TextureDataType,
  trailBias: number,
): Pick<FlowFieldContext, 'camera' | 'fadeMaterial' | 'fadeScene' | 'quad' | 'trails'> {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new PlaneGeometry(2, 2);
  const fadeMaterial = new ShaderMaterial({
    uniforms: {
      uTrail: { value: null },
      uFade: { value: new Vector3(...TRAIL_DECAY) },
      uBias: { value: trailBias },
    },
    vertexShader: QUAD_VERTEX,
    fragmentShader: FADE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const fadeScene = new Scene();

  fadeScene.add(new Mesh(quad, fadeMaterial));

  const makeTrail = () =>
    new WebGLRenderTarget(1, 1, {
      type: trailType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });

  return {
    camera,
    fadeMaterial,
    fadeScene,
    quad,
    trails: { read: makeTrail(), write: makeTrail() },
  };
}

export function createComposite(
  renderer: WebGLRenderer,
  shared: SharedUniforms,
  { camera, quad }: Pick<FlowFieldContext, 'camera' | 'quad'>,
  initialLight: boolean,
): Pick<FlowFieldContext, 'bloom' | 'composer' | 'compositeMaterial'> {
  const compositeMaterial = new ShaderMaterial({
    uniforms: {
      ...shared,
      uTrail: { value: null },
      uResolution: { value: new Vector2(1, 1) },
      uDpr: { value: 1 },
      uReveal: { value: 0 },
      uClock: { value: 0 },
      uTheme: { value: initialLight ? 1 : 0 },
    },
    vertexShader: QUAD_VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const compositeScene = new Scene();

  compositeScene.add(new Mesh(quad, compositeMaterial));

  const composer = new EffectComposer(renderer);

  composer.addPass(new RenderPass(compositeScene, camera));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), initialLight ? 0 : 0.28, 0.24, 0.68);

  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  return { bloom, composer, compositeMaterial };
}

export function createFieldState(initialLight: boolean): FieldState {
  return {
    pointer: { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, strength: 0, target: 0 },
    revealForced: false,
    size: { width: 0, height: 0, dpr: 0 },
    theme: {
      current: initialLight ? 1 : 0,
      target: initialLight ? 1 : 0,
    },
    time: 0,
  };
}
