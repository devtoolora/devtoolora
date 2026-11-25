import { FunctionError } from '../errors';

export type FluidClampOptions = {
  maxSize: number;
  maxViewport: number;
  minSize: number;
  minViewport: number;
  rootSize: number;
  unit: 'px' | 'rem';
};

const round4 = (value: number): number => Number(value.toFixed(4));
const sampleViewports = [768, 1024, 1440];

export function fluidClamp(options: FluidClampOptions): {
  css: string;
  ratio: number;
  samples: Array<{ size: number; viewport: number }>;
  zoomWarning: boolean;
} {
  const { maxSize, maxViewport, minSize, minViewport, rootSize, unit } = options;

  if (minSize >= maxSize)
    throw new FunctionError(
      'INVALID_FLUID_RANGE',
      'Minimum size must be smaller than maximum size.',
    );

  if (minViewport >= maxViewport)
    throw new FunctionError(
      'INVALID_FLUID_RANGE',
      'Minimum viewport must be smaller than maximum viewport.',
    );

  const slope = (maxSize - minSize) / (maxViewport - minViewport);
  const intercept = minSize - slope * minViewport;
  const divisor = unit === 'rem' ? rootSize : 1;
  const length = (px: number): string => `${round4(px / divisor)}${unit}`;
  const offset = round4(Math.abs(intercept) / divisor);
  const fluid = `${round4(slope * 100)}vw`;
  const preferred = offset === 0 ? fluid : `${intercept < 0 ? '-' : ''}${offset}${unit} + ${fluid}`;
  const ratio = round4(maxSize / minSize);
  const viewports = [...new Set([minViewport, maxViewport, ...sampleViewports])].sort(
    (a, b) => a - b,
  );

  return {
    css: `font-size: clamp(${length(minSize)}, ${preferred}, ${length(maxSize)});`,
    ratio,
    samples: viewports.map((viewport) => ({
      size: round4(Math.min(maxSize, Math.max(minSize, intercept + slope * viewport))),
      viewport,
    })),
    zoomWarning: maxSize / minSize > 2.5,
  };
}
