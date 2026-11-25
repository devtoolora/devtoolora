import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { calculateChmod, type ChmodSubject } from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

export const chmodCalculatorTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Decode octal permission bits into owner, group and others permissions, including setuid, setgid and sticky indicators. No files are changed.',
  fields: [
    {
      defaultValue: 'table',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Permission table', value: 'table' },
        { label: 'JSON audit', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'chmod-calculator',
  inputKind: 'text',
  keywords: ['chmod', 'octal', 'permissions', 'rwx', 'setuid', 'setgid', 'sticky'],
  name: 'chmod Calculator',
  outputKind: 'json',
  relatedToolIds: ['base-converter', 'cron-explain', 'docker-to-compose'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const output = fields.output ?? 'table';

    if (output !== 'table' && output !== 'report')
      throw new ToolError('Choose Permission table or JSON audit.');

    const result = withToolError(() => calculateChmod(text));
    const report = JSON.stringify({ ...result, originalInput: text }, null, 2);
    const subjects: ChmodSubject[] = ['owner', 'group', 'others'];
    const special = Object.entries(result.special)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);

    return {
      artifact: {
        base64: encodeBase64Text(report),
        fileName: 'chmod-report.json',
        mimeType: 'application/json;charset=utf-8',
      },
      jsonTable:
        output === 'table'
          ? {
              columns: ['Subject', 'Read', 'Write', 'Execute', 'Special', 'Symbolic'],
              presentation: 'plain',
              rows: subjects.map((subject) => {
                const permissions = result.groups[subject];

                return [
                  subject,
                  permissions.read ? 'Yes' : 'No',
                  permissions.write ? 'Yes' : 'No',
                  permissions.execute ? 'Yes' : 'No',
                  permissions.special ?? 'None',
                  permissions.symbolic,
                ];
              }),
            }
          : undefined,
      language: 'json',
      summary: `${result.octal} = ${result.compact} · special bits: ${special.length ? special.join(', ') : 'none'}. S/T means the corresponding execute bit is off. This only decodes bits; no file has been changed.`,
      text: report,
    };
  },
  samples: [
    { fields: { output: 'table' }, label: 'Owner rwx, group/others rx (755)', text: '755' },
    { fields: { output: 'table' }, label: 'Owner rw, group/others read (644)', text: '644' },
    { fields: { output: 'table' }, label: 'Owner-only read/write (600)', text: '600' },
    { fields: { output: 'table' }, label: 'No permission bits (000)', text: '000' },
    { fields: { output: 'table' }, label: 'Explicit zero special bits (0755)', text: '0755' },
    { fields: { output: 'table' }, label: 'Extra leading zeroes (00755)', text: '00755' },
    { fields: { output: 'table' }, label: 'Setuid with owner execute (4755)', text: '4755' },
    { fields: { output: 'table' }, label: 'Setuid without owner execute (4644)', text: '4644' },
    { fields: { output: 'table' }, label: 'Setgid with group execute (2750)', text: '2750' },
    { fields: { output: 'table' }, label: 'Setgid without group execute (2640)', text: '2640' },
    { fields: { output: 'table' }, label: 'Sticky with others execute (1777)', text: '1777' },
    { fields: { output: 'table' }, label: 'Sticky without others execute (1666)', text: '1666' },
    { fields: { output: 'table' }, label: 'All ordinary and special bits (7777)', text: '7777' },
    { fields: { output: 'report' }, label: 'Full JSON permission audit', text: '4755' },
  ],
  supportsSelection: true,
  freshResults: true,
};
