import type { JsonTreeNode } from './jsonTree';
import type { HtmlPreviewNode } from './htmlPreview';

export type ToolCategory =
  | 'Formatters'
  | 'Encoders'
  | 'Web/API'
  | 'Text'
  | 'Crypto'
  | 'Dev Utilities'
  | 'Date & Time'
  | 'Images & Codes'
  | 'Network'
  | 'Math'
  | 'Data'
  | 'Schema & Types'
  | 'Config & Secrets'
  | 'Logs & Diagnostics'
  | 'Measurement'
  | 'CSS & Design'
  | 'Documents & PDF'
  | 'AI & Prompts';

export type ToolInputKind = 'text' | 'optionalText' | 'none';
export type ToolOutputKind = 'text' | 'json' | 'markdown';
export type ToolResultAction = 'replace' | 'insert' | 'copy' | 'scratch' | 'save';
export const toolRuntimeCapabilities = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
] as const;
export type ToolRuntimeCapability = (typeof toolRuntimeCapabilities)[number];

export type ToolFieldCondition =
  | {
      field: string;
      is?: string[];
      isNot?: string[];
    }
  | { anyOf: ToolFieldCondition[] };

export type ToolRunRequirement = {
  anyOf: string[];
  when?: ToolFieldCondition | ToolFieldCondition[];
};

export type ToolPreviewKind =
  | 'color-palette'
  | 'css-animation'
  | 'css-clip-path'
  | 'css-easing'
  | 'css-filter'
  | 'css-flexbox'
  | 'css-glass'
  | 'css-gradient'
  | 'css-grid'
  | 'css-loader'
  | 'css-mesh'
  | 'css-neumorphism'
  | 'css-radius'
  | 'css-shadow'
  | 'css-text-shadow'
  | 'css-transform'
  | 'css-triangle'
  | 'image'
  | 'pdf-pages'
  | 'pdf-stamp'
  | 'svg-path';

export type ToolBadgeAccent = 'signal' | 'calibration';
export type ToolBadgeIcon = 'fingerprint' | 'key-round';
export type ToolBadge =
  { accent: ToolBadgeAccent; glyph: string } | { accent: ToolBadgeAccent; icon: ToolBadgeIcon };

type ToolFieldBase = {
  help?: string;
  id: string;
  label: string;
  required?: boolean;
  /**
   * Never persisted in drafts, like password fields; use for multiline secrets such as private
   * keys.
   */
  sensitive?: boolean;
  visibleWhen?: ToolFieldCondition | ToolFieldCondition[];
};

export type ToolField =
  | (ToolFieldBase & {
      accept?: string;
      defaultValue?: string;
      maxBytes?: number;
      multiple?: boolean;
      placeholder?: string;
      rows?: number;
      type: 'textarea' | 'password' | 'checkbox' | 'file';
    })
  | (ToolFieldBase & {
      defaultValue?: string;
      placeholder?: string;
      presentation?: 'color';
      type: 'text';
    })
  | (ToolFieldBase & {
      defaultValue?: string;
      placeholder?: string;
      range?: { max: number; min: number; step?: number; unit?: string };
      type: 'number';
    })
  | (ToolFieldBase & {
      defaultValue?: string;
      options: Array<{ label: string; value: string }>;
      presentation?: 'segmented';
      searchable?: boolean;
      type: 'select';
    })
  | (ToolFieldBase & {
      defaultValue?: string;
      options: Array<{ label: string; value: string }>;
      type: 'checkboxGroup';
    });

export type ToolInputPresentation = {
  label: string;
  placeholder?: string;
};

export type ToolSample = {
  fields?: Record<string, string>;
  label: string;
  text?: string;
};

export type ToolInput = {
  fields: Record<string, string>;
  text: string;
};

export type ToolResult = {
  artifact?: {
    base64: string;
    fileName: string;
    mimeType: string;
  };
  artifacts?: Array<{
    base64: string;
    fileName: string;
    mimeType: string;
  }>;
  asciiArt?: { columns: number; rows: number };
  batch?: {
    failed: Array<{ message: string; name: string }>;
    succeeded: number;
    total: number;
  };
  htmlPreview?: { label?: string; nodes: HtmlPreviewNode[] };
  jsonDiff?: {
    changes: Array<{
      after?: string;
      before?: string;
      kind: 'added' | 'changed' | 'removed';
      pointer: string;
    }>;
  };
  jsonTable?: {
    columns: string[];
    presentation?: 'json' | 'plain';
    rows: Array<Array<string | null>>;
  };
  jsonTree?: { expandedLevels?: number; nodes: JsonTreeNode[] };
  language?: string;
  noWrap?: boolean;
  previewDataUri?: string;
  regex?: {
    matches: Array<{
      captures: Array<string | null>;
      end: number;
      groups: Record<string, string | null>;
      index: number;
      match: string;
    }>;
    replacementPreview?: string;
    source: string;
  };
  resultActions?: ToolResultAction[];
  summary?: string;
  svgPath?: {
    bbox: { height: number; width: number; x: number; y: number };
    d: string;
    display: 'fill' | 'stroke';
    pointCount: number;
    points: Array<{
      anchor?: { x: number; y: number };
      index: number;
      kind: 'control' | 'end';
      x: number;
      y: number;
    }>;
  };
  text: string;
  textDiff?: {
    layout: 'split' | 'unified';
    rows: Array<{
      after?: {
        ending: 'CR' | 'CRLF' | 'LF' | 'none';
        highlight?: { end: number; start: number };
        number: number;
        text: string;
      };
      before?: {
        ending: 'CR' | 'CRLF' | 'LF' | 'none';
        highlight?: { end: number; start: number };
        number: number;
        text: string;
      };
      kind: 'added' | 'changed' | 'removed' | 'unchanged';
    }>;
    showLineEndings?: boolean;
  };
  verdict?: 'match' | 'mismatch';
};

export type ToolFaq = { answer: string; question: string };

export type ToolContent = {
  documentation?: Array<{ content: string | string[]; title: string }>;
  examples?: string[];
  faq?: ToolFaq[];
  help?: string;
  notes?: string[];
};

export type ToolRuntime = 'heic' | 'ocr';

export type ToolDefinition = {
  aliasOf?: string;
  autoRun?: boolean;
  badge?: ToolBadge;
  capabilities?: ToolRuntimeCapability[];
  category: ToolCategory;
  description: string;
  fields?: ToolField[];
  /**
   * Base64-style file in/out: the input may stay text while only the result is a file. The UI
   * labels and output handling assume the fields `file`, `fileName`, `fileOutput` and `mode`.
   */
  fileModeWhen?: ToolFieldCondition | ToolFieldCondition[];
  freshResults?: boolean;
  id: string;
  inputKind: ToolInputKind;
  inputPresentation?: ToolInputPresentation & { byMode?: Record<string, ToolInputPresentation> };
  inputVisibleWhen?: ToolFieldCondition | ToolFieldCondition[];
  /** Per-run worker; VS Code starts it without pdfjs (see toolBehaviorFlags.test.ts). */
  isolatedWorker?: boolean;
  keywords?: string[];
  name: string;
  outputKind: ToolOutputKind;
  preview?: ToolPreviewKind;
  relatedToolIds?: string[];
  requiresInput?: boolean;
  resultActions?: ToolResultAction[];
  run(input: ToolInput): ToolResult | Promise<ToolResult>;
  runRequires?: ToolRunRequirement[];
  runtime?: ToolRuntime;
  samples?: ToolSample[];
  selectionTarget?: { field: string; fields?: Record<string, string> };
  sensitiveInput?: boolean;
  supportsSelection: boolean;
  textConversion?: {
    decodedLabel: string;
    encodedLabel: string;
    runLabels?: { decode: string; encode: string };
  };
};

export type SerializedToolDefinition = Omit<ToolDefinition, 'run'>;

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}
