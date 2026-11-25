import { ToolDefinition } from '@devtoolora/core';
import { cssGridGeneratorTool } from './css-grid-generator/tool';
import { cssFlexboxGeneratorTool } from './css-flexbox-generator/tool';
import { cssBoxShadowGeneratorTool } from './css-box-shadow-generator/tool';
import { cssBorderRadiusGeneratorTool } from './css-border-radius-generator/tool';
import { cssTriangleGeneratorTool } from './css-triangle-generator/tool';
import { cssClipPathGeneratorTool } from './css-clip-path-generator/tool';
import { cssKeyframesGeneratorTool } from './css-keyframes-generator/tool';
import { colorPaletteTool } from './color-palette/tool';
import {
  conicGradientGeneratorTool,
  cssGradientGeneratorTool,
  radialGradientGeneratorTool,
} from './css-gradient-generator/tool';
import {
  cssBackdropFilterGeneratorTool,
  cssFilterGeneratorTool,
} from './css-filter-generator/tool';
import { cssTransformGeneratorTool } from './css-transform-generator/tool';
import { cssGlassmorphismGeneratorTool } from './css-glassmorphism-generator/tool';
import { cssNeumorphismGeneratorTool } from './css-neumorphism-generator/tool';
import { cssTextShadowGeneratorTool } from './css-text-shadow-generator/tool';
import { cssCubicBezierGeneratorTool } from './css-cubic-bezier-generator/tool';
import { cssLoaderGeneratorTool } from './css-loader-generator/tool';
import { cssClampGeneratorTool } from './css-clamp-generator/tool';
import { cssUnitConverterTool } from './css-unit-converter/tool';
import { aspectRatioCalculatorTool } from './aspect-ratio-calculator/tool';
import { colorScaleTool } from './color-scale-generator/tool';
import { colorMixerTool } from './color-mixer/tool';
import { colorNameLookupTool } from './color-name-lookup/tool';
import { colorBlindnessPaletteSimulatorTool } from './color-blindness-palette-simulator/tool';
import { meshGradientGeneratorTool } from './mesh-gradient-generator/tool';
import { cssSpecificityCalculatorTool } from './css-specificity-calculator/tool';

export * from './css-grid-generator/tool';
export * from './css-flexbox-generator/tool';
export * from './css-box-shadow-generator/tool';
export * from './css-border-radius-generator/tool';
export * from './css-triangle-generator/tool';
export * from './css-clip-path-generator/tool';
export * from './css-keyframes-generator/tool';
export * from './color-palette/tool';
export * from './css-gradient-generator/tool';
export * from './css-text-shadow-generator/tool';
export * from './css-filter-generator/tool';
export * from './css-transform-generator/tool';
export * from './css-glassmorphism-generator/tool';
export * from './css-neumorphism-generator/tool';
export * from './css-cubic-bezier-generator/tool';
export * from './css-loader-generator/tool';
export * from './css-clamp-generator/tool';
export * from './css-unit-converter/tool';
export * from './aspect-ratio-calculator/tool';
export * from './css-specificity-calculator/tool';
export * from './color-scale-generator/tool';
export * from './color-mixer/tool';
export * from './color-name-lookup/tool';
export * from './color-blindness-palette-simulator/tool';
export * from './mesh-gradient-generator/tool';

export const cssDesignTools: ToolDefinition[] = [
  cssGridGeneratorTool,
  cssFlexboxGeneratorTool,
  cssBoxShadowGeneratorTool,
  cssBorderRadiusGeneratorTool,
  cssTriangleGeneratorTool,
  cssClipPathGeneratorTool,
  cssKeyframesGeneratorTool,
  colorPaletteTool,
  cssGradientGeneratorTool,
  radialGradientGeneratorTool,
  conicGradientGeneratorTool,
  cssTextShadowGeneratorTool,
  cssFilterGeneratorTool,
  cssBackdropFilterGeneratorTool,
  cssTransformGeneratorTool,
  cssGlassmorphismGeneratorTool,
  cssNeumorphismGeneratorTool,
  cssCubicBezierGeneratorTool,
  cssLoaderGeneratorTool,
  cssClampGeneratorTool,
  cssUnitConverterTool,
  aspectRatioCalculatorTool,
  cssSpecificityCalculatorTool,
  colorScaleTool,
  colorMixerTool,
  colorNameLookupTool,
  colorBlindnessPaletteSimulatorTool,
  meshGradientGeneratorTool,
];
