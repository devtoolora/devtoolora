import { Color, HalfFloatType, UnsignedByteType, WebGLRenderer, type IUniform } from 'three';
import {
  TRAIL_DECAY,
  createComposite,
  createFieldState,
  createLines,
  createRenderer,
  createSharedUniforms,
  createSimulation,
  createTrails,
} from './pipeline';
import type { FlowField, FlowFieldContext } from './types';

export type { FlowField } from './types';

const REVEAL_SECONDS = 1.8;

function clearTrails({ renderer, trails }: FlowFieldContext): void {
  // trails hold line energy, so they start at zero rather than the background clear colour
  const clearColor = renderer.getClearColor(new Color());

  renderer.setClearColor(0x000000, 0);

  for (const target of [trails.read, trails.write]) {
    renderer.setRenderTarget(target);
    renderer.clear(true, false, false);
  }

  renderer.setRenderTarget(null);
  renderer.setClearColor(clearColor, 1);
}

function resizeField(ctx: FlowFieldContext, width: number, height: number, dpr: number): boolean {
  const { composer, compositeMaterial, lineMaterial, renderer, shared, state, trails } = ctx;
  const { size } = state;

  if (width === size.width && height === size.height && dpr === size.dpr) {
    return false;
  }

  state.size = { width, height, dpr };
  const pw = Math.max(1, Math.round(width * dpr));
  const ph = Math.max(1, Math.round(height * dpr));

  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);
  trails.read.setSize(pw, ph);
  trails.write.setSize(pw, ph);
  clearTrails(ctx);
  shared.uAspect.value = width / height;
  uniform(compositeMaterial.uniforms, 'uResolution').value.set(pw, ph);
  uniform(compositeMaterial.uniforms, 'uDpr').value = dpr;
  // thinner hairlines on dense screens need a touch more energy
  uniform(lineMaterial.uniforms, 'uIntensity').value = 0.062 * Math.sqrt(dpr);

  return true;
}

function setFieldPointer(ctx: FlowFieldContext, x: number, y: number, active: boolean): void {
  const { pointer } = ctx.state;

  pointer.tx = x;
  pointer.ty = y;
  pointer.target = active ? 1 : 0;

  if (active && pointer.strength < 0.01) {
    pointer.x = x;
    pointer.y = y;
  }
}

function uniform(uniforms: Record<string, IUniform>, name: string): IUniform {
  const found = uniforms[name];

  if (!found) throw new Error(`Missing uniform ${name}`);

  return found;
}

function stepField(ctx: FlowFieldContext, dt: number): void {
  const { bloom, compositeMaterial, fadeMaterial, gpu, lineMaterial, positions, shared } = ctx;
  const { renderer, simUniforms, state, trails } = ctx;
  const { pointer, theme } = state;

  state.time += dt;
  const k = dt * 60;

  pointer.x += (pointer.tx - pointer.x) * Math.min(1, 0.16 * k);
  pointer.y += (pointer.ty - pointer.y) * Math.min(1, 0.16 * k);
  pointer.strength += (pointer.target - pointer.strength) * Math.min(1, 0.08 * k);

  const tk = dt * 7;

  theme.current += (theme.target - theme.current) * Math.min(1, tk);
  uniform(compositeMaterial.uniforms, 'uTheme').value = theme.current;
  bloom.strength = 0.28 * Math.max(0, 1 - theme.current);

  shared.uPointer.value.set(pointer.x, pointer.y);
  shared.uPointerStrength.value = pointer.strength;
  uniform(simUniforms, 'uTime').value = state.time;
  uniform(simUniforms, 'uDelta').value = dt;
  gpu.compute();

  uniform(lineMaterial.uniforms, 'uPrev').value = gpu.getAlternateRenderTarget(positions).texture;
  uniform(lineMaterial.uniforms, 'uCurr').value = gpu.getCurrentRenderTarget(positions).texture;
  uniform(lineMaterial.uniforms, 'uDelta').value = dt;

  uniform(fadeMaterial.uniforms, 'uTrail').value = trails.read.texture;

  uniform(fadeMaterial.uniforms, 'uFade').value.set(
    TRAIL_DECAY[0] ** k,
    TRAIL_DECAY[1] ** k,
    TRAIL_DECAY[2] ** k,
  );

  renderer.setRenderTarget(trails.write);
  renderer.render(ctx.fadeScene, ctx.camera);
  renderer.render(ctx.lineScene, ctx.camera);
  renderer.setRenderTarget(null);
  [trails.read, trails.write] = [trails.write, trails.read];
}

function renderField(
  { composer, compositeMaterial, state, trails }: FlowFieldContext,
  dt: number,
): void {
  const reveal = state.revealForced ? 1 : Math.min(1, state.time / REVEAL_SECONDS);

  uniform(compositeMaterial.uniforms, 'uTrail').value = trails.read.texture;
  uniform(compositeMaterial.uniforms, 'uReveal').value = reveal * reveal * (3 - 2 * reveal);
  uniform(compositeMaterial.uniforms, 'uClock').value = state.time;
  composer.render(dt);
}

function insertFence(renderer: WebGLRenderer): () => boolean {
  // three r180 only creates WebGL2 contexts; its typings still allow WebGL1
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  let isDone = sync === null;

  gl.flush();

  return () => {
    // the sync status only changes between tasks, so this is polled once per frame
    if (sync && !isDone && gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED) {
      gl.deleteSync(sync);
      isDone = true;
    }

    return isDone;
  };
}

function createFieldApi(ctx: FlowFieldContext): FlowField {
  const field: FlowField = {
    resize: (width, height, dpr) => resizeField(ctx, width, height, dpr),
    fence: () => insertFence(ctx.renderer),
    setStar(x, y) {
      ctx.shared.uStar.value.set(x, y);
    },
    setPointer: (x, y, active) => setFieldPointer(ctx, x, y, active),
    setTheme(isLight) {
      ctx.state.theme.target = isLight ? 1 : 0;
      ctx.renderer.setClearColor(isLight ? 0xf2f6f8 : 0x0b172d, 1);
    },
    step: (dt) => stepField(ctx, dt),
    render: (dt) => renderField(ctx, dt),
    revealNow() {
      ctx.state.revealForced = true;
    },
  };

  return field;
}

export function createFlowField(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  side: number,
  initialLight = false,
): FlowField | null {
  const renderer = createRenderer(canvas, initialLight);

  if (!renderer) {
    return null;
  }

  const floatTargets = renderer.extensions.has('EXT_color_buffer_float');
  const halfTargets = floatTargets || renderer.extensions.has('EXT_color_buffer_half_float');
  const trailType = halfTargets ? HalfFloatType : UnsignedByteType;
  // 8-bit trails never reach zero with pure multiplication, nudge them down.
  const trailBias = halfTargets ? 0 : 1.5 / 255;
  const shared = createSharedUniforms();
  const simulation = createSimulation(renderer, side, shared, floatTargets);

  if (!simulation) {
    renderer.dispose();

    return null;
  }

  const lines = createLines(side, shared);
  const trails = createTrails(trailType, trailBias);
  const composite = createComposite(renderer, shared, trails, initialLight);

  return createFieldApi({
    ...simulation,
    ...lines,
    ...trails,
    ...composite,
    renderer,
    shared,
    state: createFieldState(initialLight),
  });
}
