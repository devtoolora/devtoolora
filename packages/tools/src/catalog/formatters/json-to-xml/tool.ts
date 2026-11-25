import { ToolError } from '@devtoolora/core';
import {
  formatXml as formatXmlValue,
  jsonDocumentToXml as convertJsonToXml,
  jsonDuplicateWarning,
  xmlToJson as convertXmlToJson,
} from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { conversionPair } from '../../../adapters/conversionPair';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities, xmlFormatOptions } from '../shared';

const [jsonXmlTool, xmlJsonTool] = conversionPair({
  aliasId: 'xml-to-json',
  aliasName: 'XML to JSON',
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  decode: {
    fields: [
      {
        defaultValue: 'compact',
        help: 'Compact groups same-name siblings and omits layout-only whitespace. Preserve order keeps every child text/element node in #content, including interleaved repeated names.',
        id: 'mapping',
        label: 'JSON mapping',
        options: [
          { label: 'Compact data', value: 'compact' },
          { label: 'Preserve order', value: 'ordered' },
        ],
        presentation: 'segmented',
        type: 'select',
      },
    ],
    run: ({ fields, text }) =>
      withToolError(() => {
        const mapping = fields.mapping || 'compact';

        if (mapping !== 'compact' && mapping !== 'ordered')
          throw new ToolError('Choose Compact data or Preserve order.');

        const converted = JSON.stringify(
          convertXmlToJson(text, { preserveOrder: mapping === 'ordered' }),
          null,
          2,
        );

        return {
          artifact: {
            base64: encodeBase64Text(converted),
            fileName: 'converted.json',
            mimeType: 'application/json;charset=utf-8',
          },
          language: 'json',
          summary: `Converted XML to JSON · ${mapping === 'ordered' ? 'order preserved' : 'same-name elements grouped'} · values remain strings.`,
          text: converted,
        };
      }),
  },
  decodedLabel: 'JSON',
  description:
    'Convert JSON to XML or XML to JSON without dropping repeated elements, attributes, mixed text, comments or CDATA.',
  encode: {
    fields: [
      {
        defaultValue: 'root',
        help: 'Used for root arrays, scalars and objects with multiple keys. A single named key becomes the document root instead.',
        id: 'root',
        label: 'Fallback root element',
        type: 'text',
      },
      {
        defaultValue: 'pretty',
        help: 'Pretty normalizes layout between structural children. Compact keeps the mapped text and ordered whitespace without adding layout.',
        id: 'layout',
        label: 'Output layout',
        options: [
          { label: 'Pretty', value: 'pretty' },
          { label: 'Compact', value: 'compact' },
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
        visibleWhen: { field: 'layout', is: ['pretty'] },
      },
    ],
    run: ({ fields, text }) =>
      withToolError(() => {
        const layout = fields.layout || 'pretty';

        if (layout !== 'pretty' && layout !== 'compact')
          throw new ToolError('Choose Pretty or Compact XML output.');

        const xml = convertJsonToXml(text, fields.root || 'root');
        const converted = layout === 'pretty' ? formatXmlValue(xml, xmlFormatOptions(fields)) : xml;

        return {
          artifact: {
            base64: encodeBase64Text(converted),
            fileName: 'converted.xml',
            mimeType: 'application/xml;charset=utf-8',
          },
          language: 'xml',
          summary: withWarning(
            'Converted JSON to XML · JSON scalars become XML text.',
            jsonDuplicateWarning(text),
          ),
          text: converted,
        };
      }),
  },
  encodedLabel: 'XML',
  id: 'json-to-xml',
  inputKind: 'text',
  keywords: [
    'converter',
    'json to xml',
    'xml to json',
    'xml',
    'attributes',
    'repeated elements',
    'mixed content',
    'CDATA',
    'soap',
  ],
  name: 'JSON ↔ XML Converter',
  outputKind: 'text',
  relatedToolIds: ['xml-format', 'json-format', 'json-tree', 'json-to-yaml'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  supportsSelection: true,
  samples: [
    {
      fields: { indentation: '2', layout: 'pretty', mode: 'encode', root: 'root' },
      label: 'JSON → XML: Person object',
      text: '{"person":{"name":"Ada","active":true}}',
    },
    {
      fields: { indentation: '2', layout: 'pretty', mode: 'encode', root: 'root' },
      label: 'JSON → XML: Repeated users and attributes',
      text: '{\n  "users": {\n    "user": [\n      {"@attributes": {"id": "001"}, "name": "Ada", "roles": {"role": ["admin", "editor"]}},\n      {"@attributes": {"id": "002"}, "name": "Grace", "roles": {"role": []}}\n    ]\n  }\n}',
    },
    {
      fields: { indentation: '2', layout: 'compact', mode: 'encode', root: 'root' },
      label: 'JSON → XML: Mixed Unicode content',
      text: '{"p":{"@attributes":{"lang":"cs"},"#content":["Hello ",{"strong":"world"},"! Příliš žluťoučký kůň 🐎."]}}',
    },
    {
      fields: { indentation: '2', layout: 'pretty', mode: 'encode', root: 'users' },
      label: 'JSON → XML: Root array',
      text: '[{"name":"Ada"},{"name":"Grace"}]',
    },
    {
      fields: { mapping: 'compact', mode: 'decode' },
      label: 'XML → JSON: Person XML',
      text: '<person><name>Ada</name><active>true</active></person>',
    },
    {
      fields: { mapping: 'compact', mode: 'decode' },
      label: 'XML → JSON: Repeated users and attributes',
      text: '<users><user id="001"><name>Ada</name><roles><role>admin</role><role>editor</role></roles></user><user id="002"><name>Grace</name><roles/></user></users>',
    },
    {
      fields: { mapping: 'compact', mode: 'decode' },
      label: 'XML → JSON: Mixed Unicode content',
      text: '<p lang="cs">Hello <strong>world</strong>! Příliš žluťoučký kůň 🐎.</p>',
    },
    {
      fields: { mapping: 'ordered', mode: 'decode' },
      label: 'XML → JSON: Ordered document',
      text: '<?xml version="1.0" encoding="UTF-8"?><!--Local example--><root><?status ready?><script><![CDATA[if (a < b) run();]]></script><item/></root>',
    },
    {
      fields: { mapping: 'ordered', mode: 'decode' },
      label: 'XML → JSON: Interleaved names',
      text: '<root><a>first</a><b>middle</b><a>last</a></root>',
    },
  ],
});

export const jsonToXmlTool = jsonXmlTool;
export const xmlToJsonTool = xmlJsonTool;
