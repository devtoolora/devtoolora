import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  jsonDocumentToPlist,
  jsonDuplicateWarning,
  plistDocumentToJson,
} from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities } from '../shared';

const header =
  '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n';

function convert(mode: string, text: string) {
  const toPlist = mode === 'json-to-plist';
  const output = toPlist ? jsonDocumentToPlist(text) : plistDocumentToJson(text);

  return {
    artifact: {
      base64: encodeBase64Text(output),
      fileName: toPlist ? 'converted.plist' : 'converted.json',
      mimeType: toPlist ? 'application/xml;charset=utf-8' : 'application/json;charset=utf-8',
    },
    language: toPlist ? 'xml' : 'json',
    summary: toPlist
      ? withWarning('Converted JSON to plist.', jsonDuplicateWarning(text))
      : 'Converted plist to JSON.',
    text: output,
  };
}

export const plistConverterTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Convert Apple XML property lists (plist 1.0) to JSON and JSON back to plist locally. Big integers stay exact; DTDs are never fetched.',
  fields: [
    {
      defaultValue: 'plist-to-json',
      id: 'mode',
      label: 'Direction',
      options: [
        { label: 'Plist → JSON', value: 'plist-to-json' },
        { label: 'JSON → Plist', value: 'json-to-plist' },
      ],
      type: 'select',
    },
  ],
  id: 'plist-converter',
  inputKind: 'text',
  keywords: [
    'plist',
    'property list',
    'info.plist',
    'apple',
    'macos',
    'ios',
    'xcode',
    'entitlements',
    'json',
    'convert',
  ],
  name: 'Plist Converter',
  outputKind: 'text',
  relatedToolIds: ['xml-format', 'json-to-xml'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = fields.mode ?? 'plist-to-json';

      if (mode !== 'plist-to-json' && mode !== 'json-to-plist')
        throw new ToolError('Choose Plist → JSON or JSON → Plist.');

      return convert(mode, text);
    }),
  samples: [
    {
      fields: { mode: 'plist-to-json' },
      label: 'Info.plist',
      text: `${header}<dict>\n  <key>CFBundleIdentifier</key>\n  <string>com.example.app</string>\n  <key>CFBundleShortVersionString</key>\n  <string>1.4.0</string>\n  <key>CFBundleVersion</key>\n  <integer>42</integer>\n  <key>LSRequiresIPhoneOS</key>\n  <true/>\n</dict>\n</plist>\n`,
    },
    {
      fields: { mode: 'plist-to-json' },
      label: 'Entitlements',
      text: `${header}<dict>\n  <key>com.apple.security.app-sandbox</key>\n  <true/>\n  <key>com.apple.security.application-groups</key>\n  <array>\n    <string>group.com.example.shared</string>\n  </array>\n</dict>\n</plist>\n`,
    },
    {
      fields: { mode: 'plist-to-json' },
      label: 'Dates, data and reals',
      text: `${header}<dict>\n  <key>created</key>\n  <date>2024-01-02T03:04:05Z</date>\n  <key>icon</key>\n  <data>\n  iVBORw0KGgo=\n  </data>\n  <key>scale</key>\n  <real>2.5</real>\n</dict>\n</plist>\n`,
    },
    {
      fields: { mode: 'plist-to-json' },
      label: 'Array of dictionaries',
      text: `${header}<array>\n  <dict>\n    <key>name</key>\n    <string>Home</string>\n    <key>order</key>\n    <integer>1</integer>\n  </dict>\n  <dict>\n    <key>name</key>\n    <string>Settings</string>\n    <key>order</key>\n    <integer>2</integer>\n  </dict>\n</array>\n</plist>\n`,
    },
    {
      fields: { mode: 'json-to-plist' },
      label: 'JSON to plist',
      text: '{\n  "CFBundleName": "Demo",\n  "CFBundleVersion": 7,\n  "UIRequiresFullScreen": false,\n  "Scale": 1.5\n}\n',
    },
    {
      fields: { mode: 'json-to-plist' },
      label: 'Nested JSON to plist',
      text: '{\n  "servers": [\n    { "host": "a.example.com", "port": 443 },\n    { "host": "b.example.com", "port": 8443 }\n  ],\n  "retry": { "count": 3, "delay": 0.25 }\n}\n',
    },
  ],
  supportsSelection: true,
};
