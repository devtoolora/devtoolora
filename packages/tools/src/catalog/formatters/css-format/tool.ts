import { ToolDefinition, ToolError } from '@devtoolora/core';
import { formatCss } from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

export const cssFormatTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Format or minify CSS locally. Nested at-rules and CSS nesting are indented, and values are never rewritten.',
  fields: [
    {
      defaultValue: 'format',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Format', value: 'format' },
        { label: 'Minify', value: 'minify' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '2',
      id: 'indentation',
      label: 'Indentation',
      options: [
        { label: '2 spaces', value: '2' },
        { label: '4 spaces', value: '4' },
        { label: 'Tabs', value: 'tab' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'css-format',
  inputKind: 'text',
  keywords: ['css', 'formatter', 'minifier', 'beautify', 'pretty print', 'stylesheet', 'compress'],
  name: 'CSS Formatter & Minifier',
  outputKind: 'text',
  relatedToolIds: ['html-format', 'css-box-shadow-generator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = fields.mode ?? 'format';
      const indentation = fields.indentation ?? '2';

      if (mode !== 'format' && mode !== 'minify') throw new ToolError('Choose Format or Minify.');
      if (indentation !== '2' && indentation !== '4' && indentation !== 'tab')
        throw new ToolError('Choose 2 spaces, 4 spaces or tabs.');

      const result = formatCss(text, {
        indent: indentation === 'tab' ? 'tab' : (Number(indentation) as 2 | 4),
        mode,
      });

      return {
        artifact: {
          base64: encodeBase64Text(result.text),
          fileName: mode === 'minify' ? 'minified.css' : 'formatted.css',
          mimeType: 'text/css;charset=utf-8',
        },
        language: 'css',
        summary: `CSS ${mode === 'minify' ? 'minified' : 'formatted'} · ${result.rules} ${result.rules === 1 ? 'rule' : 'rules'}.`,
        text: result.text,
      };
    }),
  samples: [
    {
      fields: { mode: 'format' },
      label: 'Compressed rules',
      text: 'body{margin:0;font-family:system-ui,sans-serif}a{color:#0366d6;text-decoration:none}a:hover{text-decoration:underline}',
    },
    {
      fields: { mode: 'format' },
      label: 'Media query',
      text: '@media (min-width:600px){.grid{display:grid;grid-template-columns:repeat(2,1fr)}}',
    },
    {
      fields: { mode: 'format' },
      label: 'CSS nesting',
      text: '.card{padding:1rem;&:hover{box-shadow:0 2px 8px rgb(0 0 0 / 20%)}.title{font-weight:600}}',
    },
    {
      fields: { mode: 'format' },
      label: 'Strings and url()',
      text: '.icon{content:"} { ;";background:url(data:image/svg+xml;utf8,<svg/>)}',
    },
    {
      fields: { mode: 'minify' },
      label: 'Minify with license',
      text: '/*! MIT License */\n/* layout */\n.box {\n  margin: 0 auto;\n  color: #FFFFFF;\n}\n',
    },
    {
      fields: { mode: 'minify' },
      label: 'Minify media query',
      text: '@media screen and (min-width: 1px) {\n  nav a {\n    padding: 0 8px;\n  }\n}\n',
    },
  ],
  supportsSelection: true,
};
