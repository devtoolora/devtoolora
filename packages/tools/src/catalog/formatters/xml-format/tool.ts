import { ToolDefinition } from '@devtoolora/core';
import { formatXml as formatXmlValue } from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, xmlFormatOptions } from '../shared';

export const xmlFormatTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Validate and indent XML while preserving attributes, mixed text, CDATA and xml:space content.',
  fields: [
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
  id: 'xml-format',
  inputKind: 'text',
  keywords: ['xml', 'formatter', 'indentation', 'pretty print'],
  name: 'XML Format',
  outputKind: 'text',
  relatedToolIds: ['json-to-xml', 'html-entities'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const formatted = formatXmlValue(text, xmlFormatOptions(fields));

      return {
        artifact: {
          base64: encodeBase64Text(formatted),
          fileName: 'formatted.xml',
          mimeType: 'application/xml;charset=utf-8',
        },
        language: 'xml',
        summary: 'XML formatted · well-formedness checked, not schema-validated.',
        text: formatted,
      };
    }),
  samples: [
    {
      fields: { indentation: '2' },
      label: 'Messy XML',
      text: '<root><user id="1"><name>Ada</name><email>ada@example.com</email></user><user id="2"><name>Grace</name><email>grace@example.com</email></user></root>',
    },
    {
      fields: { indentation: '2' },
      label: 'Mixed text and attributes',
      text: '<article note="a > b"><p>Hello <strong>world</strong>!</p><p>  Příliš žluťoučký kůň 🐎.  </p></article>',
    },
    {
      fields: { indentation: '2' },
      label: 'CDATA and comments',
      text: '<?xml version="1.0" encoding="UTF-8"?><root><!-- A comment with < and >. --><?status ready?><script><![CDATA[if (a < b) { run(); }]]></script><item/></root>',
    },
    {
      fields: { indentation: '2' },
      label: 'Protected whitespace',
      text: '<root><code xml:space="preserve">  first\n  <span>second</span>  \n</code><item/></root>',
    },
    {
      fields: { indentation: '4' },
      label: 'SOAP envelope with namespaces',
      text: '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header/><soap:Body><m:GetPrice xmlns:m="https://example.com/prices"><m:Item>Apple</m:Item><m:Currency>EUR</m:Currency></m:GetPrice></soap:Body></soap:Envelope>',
    },
    {
      fields: { indentation: 'tab' },
      label: 'Configuration with tabs',
      text: '<config><server host="localhost" port="8080"/><features><feature name="search" enabled="true"/><feature name=\'export\' enabled=\'false\'/></features></config>',
    },
  ],
  supportsSelection: true,
};
