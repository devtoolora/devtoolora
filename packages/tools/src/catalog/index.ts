import type { ToolDefinition } from '@devtoolora/core';
import { aiPromptTools } from './aiPrompts';
import { configSecretTools } from './configSecrets';
import { browserCryptoTools } from './crypto';
import { cssDesignTools } from './cssDesign';
import { dataTools } from './data';
import { dateTimeTools } from './dateTime';
import { devUtilityTools } from './devUtilities';
import { documentPdfTools } from './documentsPdf';
import { encoderTools } from './encoders';
import { browserFormatterTools } from './formatters';
import { browserImageCodeTools } from './imagesCodes';
import { logsDiagnosticTools } from './logsDiagnostics';
import { mathTools } from './math';
import { measurementTools } from './measurement';
import { networkTools } from './network';
import { browserSchemaTypeTools } from './schemaTypes';
import { browserTextTools } from './text';
import { textListTools } from './textLists';
import { browserWebApiTools } from './webApi';

// Domain order is the user-visible catalog order.
export const domainTools = {
  encoders: encoderTools,
  math: mathTools,
  measurement: measurementTools,
  data: dataTools,
  configSecrets: configSecretTools,
  logsDiagnostics: logsDiagnosticTools,
  network: networkTools,
  devUtilities: devUtilityTools,
  cssDesign: cssDesignTools,
  text: browserTextTools,
  textLists: textListTools,
  formatters: browserFormatterTools,
  schemaTypes: browserSchemaTypeTools,
  webApi: browserWebApiTools,
  crypto: browserCryptoTools,
  imagesCodes: browserImageCodeTools,
  documentsPdf: documentPdfTools,
  dateTime: dateTimeTools,
  aiPrompts: aiPromptTools,
} satisfies Record<string, ToolDefinition[]>;

export type ToolDomain = keyof typeof domainTools;
