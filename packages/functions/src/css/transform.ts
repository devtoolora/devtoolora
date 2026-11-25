import { FunctionError } from '../errors';

export const transformOrigins = [
  'center',
  'top left',
  'top',
  'top right',
  'left',
  'right',
  'bottom left',
  'bottom',
  'bottom right',
] as const;

export type TransformValues = {
  origin: string;
  perspective: number;
  rotate: number;
  rotateX: number;
  rotateY: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  translateX: number;
  translateY: number;
};

const round = (value: number): number => Number(value.toFixed(2));
const deg = (value: number): string => `${round(value)}deg`;
const px = (value: number): string => `${round(value)}px`;

export function generateTransformCss(values: TransformValues): string {
  if (!(transformOrigins as readonly string[]).includes(values.origin))
    throw new FunctionError(
      'INVALID_CSS',
      `Transform origin must be one of: ${transformOrigins.join(', ')}.`,
    );

  const { scaleX, scaleY } = values;
  const parts = [
    values.perspective !== 0 && `perspective(${px(values.perspective)})`,
    (values.translateX !== 0 || values.translateY !== 0) &&
      `translate(${px(values.translateX)}, ${px(values.translateY)})`,
    values.rotate !== 0 && `rotate(${deg(values.rotate)})`,
    values.rotateX !== 0 && `rotateX(${deg(values.rotateX)})`,
    values.rotateY !== 0 && `rotateY(${deg(values.rotateY)})`,
    (scaleX !== 100 || scaleY !== 100) &&
      `scale(${scaleX === scaleY ? round(scaleX / 100) : `${round(scaleX / 100)}, ${round(scaleY / 100)}`})`,
    (values.skewX !== 0 || values.skewY !== 0) &&
      `skew(${deg(values.skewX)}, ${deg(values.skewY)})`,
  ].filter(Boolean);
  const declarations = [`transform: ${parts.length > 0 ? parts.join(' ') : 'none'};`];

  if (values.origin !== 'center') declarations.push(`transform-origin: ${values.origin};`);

  return `.transform {\n${declarations.map((line) => `  ${line}`).join('\n')}\n}`;
}
