import type { ToolDefinition } from '@devtoolora/core';
import { generateRandomPorts } from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { numericField } from '../../../adapters/fields';

export const randomPortTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Generate distinct random port candidates within an inclusive range. Availability is not checked and no network request is made.',
  fields: [
    {
      defaultValue: '5',
      help: '1–1,000 distinct candidates. Count must not exceed the number of ports in the inclusive range.',
      id: 'count',
      label: 'Count',
      type: 'number',
    },
    {
      defaultValue: '3000',
      help: 'Inclusive lower bound, 1–65,535. Port 0 is not generated.',
      id: 'min',
      label: 'Min port',
      type: 'number',
    },
    {
      defaultValue: '9999',
      help: 'Inclusive upper bound, at least Min port and no greater than 65,535.',
      id: 'max',
      label: 'Max port',
      type: 'number',
    },
  ],
  id: 'random-port',
  inputKind: 'none',
  keywords: ['port', 'random', 'local development', 'dynamic', 'private', 'unique'],
  name: 'Random Port Generator',
  outputKind: 'text',
  relatedToolIds: ['docker-to-compose', 'dotenv-formatter'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => {
    const count = numericField(fields.count, 'Count', 1, 1000, 5);
    const min = numericField(fields.min, 'Min port', 1, 65535, 3000);
    const max = numericField(fields.max, 'Max port', 1, 65535, 9999);
    const ports = withToolError(() => generateRandomPorts(count, min, max));
    const text = ports.join('\n');
    const report = JSON.stringify(
      {
        availabilityChecked: false,
        count,
        distinct: true,
        ports,
        range: { max, min },
        selection: 'without replacement',
      },
      null,
      2,
    );

    return {
      artifact: {
        base64: encodeBase64Text(text),
        fileName: 'random-ports.txt',
        mimeType: 'text/plain;charset=utf-8',
      },
      artifacts: [
        {
          base64: encodeBase64Text(report),
          fileName: 'random-ports-report.json',
          mimeType: 'application/json;charset=utf-8',
        },
      ],
      language: 'plaintext',
      summary: `${count} distinct port candidates · inclusive range ${min}–${max} · availability not checked. No port has been opened or reserved.${min < 1024 ? ' Warning: range includes System Ports; permissions and service conflicts may apply.' : ''}`,
      text,
    };
  },
  samples: [
    { fields: { count: '5', max: '9999', min: '3000' }, label: 'Five development candidates' },
    { fields: { count: '1', max: '65535', min: '49152' }, label: 'One dynamic/private candidate' },
    {
      fields: { count: '10', max: '65535', min: '49152' },
      label: 'Ten dynamic/private candidates',
    },
    { fields: { count: '3', max: '3002', min: '3000' }, label: 'Entire three-port range' },
    { fields: { count: '1', max: '65535', min: '65535' }, label: 'Single upper-bound candidate' },
    { fields: { count: '1', max: '1', min: '1' }, label: 'Single System Port candidate' },
    {
      fields: { count: '1000', max: '65535', min: '49152' },
      label: 'One thousand distinct candidates',
    },
  ],
  supportsSelection: false,
  freshResults: true,
};
