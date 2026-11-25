import type { ToolBadgeIcon } from '@devtoolora/core';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Binary,
  Braces,
  Calculator,
  CalendarClock,
  Database,
  FileCode2,
  FileText,
  Fingerprint,
  Globe,
  Image,
  KeyRound,
  Palette,
  Ruler,
  ShieldCheck,
  Sparkles,
  Terminal,
  Type,
  Wifi,
  Wrench,
} from 'lucide-react';
import type { ToolCategory } from '@devtoolora/core';

type AccentVariant = 'signal' | 'calibration';

export type CategoryMeta = {
  accent: AccentVariant;
  category: ToolCategory;
  description: string;
  glyph?: string;
  icon: LucideIcon;
};

export const FEATURED_HOMEPAGE_CATEGORIES: ToolCategory[] = [
  'Formatters',
  'Encoders',
  'Web/API',
  'Text',
  'Crypto',
  'Images & Codes',
  'Network',
  'CSS & Design',
];

export const CATEGORY_ICON_MAP: Record<ToolCategory, CategoryMeta> = {
  Formatters: {
    category: 'Formatters',
    glyph: '{ }',
    icon: Braces,
    accent: 'signal',
    description: 'Beautify, minify, and validate data',
  },
  Encoders: {
    category: 'Encoders',
    glyph: '< >',
    icon: Binary,
    accent: 'calibration',
    description: 'Encode, decode, and convert data',
  },
  'Web/API': {
    category: 'Web/API',
    icon: Globe,
    accent: 'signal',
    description: 'Inspect, test, and work with APIs',
  },
  Text: {
    category: 'Text',
    glyph: 'T',
    icon: Type,
    accent: 'calibration',
    description: 'Edit, transform, and analyze text',
  },
  Crypto: {
    category: 'Crypto',
    icon: ShieldCheck,
    accent: 'calibration',
    description: 'Hash, encrypt, sign, and verify',
  },
  'Dev Utilities': {
    category: 'Dev Utilities',
    icon: Terminal,
    accent: 'signal',
    description: 'Developer workflows and utilities',
  },
  'Date & Time': {
    category: 'Date & Time',
    icon: CalendarClock,
    accent: 'signal',
    description: 'Convert timestamps and read schedules',
  },
  'Images & Codes': {
    category: 'Images & Codes',
    icon: Image,
    accent: 'signal',
    description: 'Convert, optimize, and inspect media',
  },
  Network: {
    category: 'Network',
    icon: Wifi,
    accent: 'calibration',
    description: 'Analyze addresses and network data',
  },
  Math: {
    category: 'Math',
    icon: Calculator,
    accent: 'calibration',
    description: 'Evaluate expressions and calculate',
  },
  Data: {
    category: 'Data',
    icon: Database,
    accent: 'signal',
    description: 'Generate, validate, and convert data',
  },
  'Schema & Types': {
    category: 'Schema & Types',
    glyph: '{ }',
    icon: FileCode2,
    accent: 'signal',
    description: 'JSON schemas, types, and validation',
  },
  'Config & Secrets': {
    category: 'Config & Secrets',
    icon: KeyRound,
    accent: 'calibration',
    description: 'Environment variables and secrets',
  },
  'Logs & Diagnostics': {
    category: 'Logs & Diagnostics',
    icon: Activity,
    accent: 'calibration',
    description: 'Inspect logs and clean stack traces',
  },
  Measurement: {
    category: 'Measurement',
    icon: Ruler,
    accent: 'calibration',
    description: 'Convert units and measure dimensions',
  },
  'CSS & Design': {
    category: 'CSS & Design',
    glyph: '</>',
    icon: Palette,
    accent: 'signal',
    description: 'Build layouts, palettes, and CSS styles',
  },
  'Documents & PDF': {
    category: 'Documents & PDF',
    icon: FileText,
    accent: 'signal',
    description: 'Merge, split, and generate documents',
  },
  'AI & Prompts': {
    category: 'AI & Prompts',
    icon: Sparkles,
    accent: 'signal',
    description: 'Estimate, split, and shape prompts and datasets',
  },
};

export const BADGE_ICONS: Record<ToolBadgeIcon, LucideIcon> = {
  fingerprint: Fingerprint,
  'key-round': KeyRound,
};

export function getCategoryMeta(category: string): CategoryMeta {
  return (
    CATEGORY_ICON_MAP[category as ToolCategory] ?? {
      category: category as ToolCategory,
      icon: Wrench,
      accent: 'signal',
      description: 'Developer utility tool',
    }
  );
}
