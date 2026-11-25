import { ToolDefinition } from '@devtoolora/core';
import { imageToolsTool } from './image-tools/tool';
import { wifiQrTool } from './wifi-qr/tool';
import { qrCodeGeneratorTool } from './qr-code-generator/tool';
import { svgPlaceholderTool } from './svg-placeholder/tool';
import { exifRemoverTool } from './exif-remover/tool';
import { qrCodeReaderTool } from './qr-code-reader/tool';
import { webPwaIconGeneratorTool } from './web-pwa-icon-generator/tool';
import { svgOptimizerTool } from './svg-optimizer/tool';
import { svgToPngTool } from './svg-to-png/tool';
import { batchImageToolsTool, socialMediaImageResizerTool } from './batch-image-tools/tool';
import { pixelDiffTool } from './pixel-diff/tool';
import { svgBlobGeneratorTool } from './svg-blob-generator/tool';
import { svgWaveGeneratorTool } from './svg-wave-generator/tool';
import { svgPatternGeneratorTool } from './svg-pattern-generator/tool';
import { svgToCssBackgroundTool, svgToDataUriTool, svgToJsxTool } from './svg-to-data-uri/tool';
import { spriteSheetGeneratorTool } from './sprite-sheet-generator/tool';
import { barcodeGeneratorTool, ean13BarcodeGeneratorTool } from './barcode-generator/tool';

import { gifFrameExtractorTool, gifSplitterTool } from './gif-frame-extractor/tool';
import { gifMakerTool, imagesToGifTool } from './gif-maker/tool';
import { svgPathEditorTool } from './svg-path-editor/tool';
import { heicConverterTool, heicToJpgTool, heicToPngTool } from './heic-converter/tool';
import { imageOcrTool, imageToTextTool } from './image-ocr/tool';

export * from './image-tools/tool';
export * from './wifi-qr/tool';
export * from './qr-code-generator/tool';
export * from './svg-placeholder/tool';
export * from './exif-remover/tool';
export * from './qr-code-reader/tool';
export * from './web-pwa-icon-generator/tool';
export * from './svg-optimizer/tool';
export * from './svg-to-png/tool';
export * from './batch-image-tools/tool';
export * from './pixel-diff/tool';
export * from './svg-blob-generator/tool';
export * from './svg-wave-generator/tool';
export * from './svg-pattern-generator/tool';
export * from './svg-to-data-uri/tool';
export * from './barcode-generator/tool';
export * from './sprite-sheet-generator/tool';
export * from './gif-frame-extractor/tool';
export * from './gif-maker/tool';
export * from './svg-path-editor/tool';
export * from './heic-converter/tool';
export * from './image-ocr/tool';

export const browserImageCodeTools: ToolDefinition[] = [
  imageToolsTool,
  wifiQrTool,
  qrCodeGeneratorTool,
  svgPlaceholderTool,
  exifRemoverTool,
  qrCodeReaderTool,
  webPwaIconGeneratorTool,
  svgOptimizerTool,
  svgToPngTool,
  batchImageToolsTool,
  socialMediaImageResizerTool,
  pixelDiffTool,
  svgBlobGeneratorTool,
  svgWaveGeneratorTool,
  svgPatternGeneratorTool,
  svgToDataUriTool,
  svgToJsxTool,
  svgToCssBackgroundTool,
  barcodeGeneratorTool,
  ean13BarcodeGeneratorTool,
  spriteSheetGeneratorTool,
  gifFrameExtractorTool,
  gifSplitterTool,
  gifMakerTool,
  imagesToGifTool,
  svgPathEditorTool,
  heicConverterTool,
  heicToJpgTool,
  heicToPngTool,
  imageOcrTool,
  imageToTextTool,
];
