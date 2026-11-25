import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { inspectDockerRun } from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

export const dockerToComposeTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Convert a supported docker run command into a reviewable Compose service, preserving argument boundaries and flagging deployment differences.',
  fields: [
    {
      defaultValue: 'yaml',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Compose YAML', value: 'yaml' },
        { label: 'JSON audit', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'docker-to-compose',
  inputKind: 'text',
  keywords: ['docker', 'compose', 'container', 'yaml', 'run'],
  name: 'Docker Run to Compose',
  outputKind: 'text',
  relatedToolIds: ['json-to-yaml', 'dotenv-validator', 'random-port', 'docker-compose-validator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const output = fields.output ?? 'yaml';

    if (output !== 'yaml' && output !== 'report')
      throw new ToolError('Choose Compose YAML or JSON audit.');

    const result = withToolError(() => inspectDockerRun(text));
    const audit = JSON.stringify({ runtimeValidated: false, result }, null, 2);
    const yamlArtifact = {
      base64: encodeBase64Text(result.text),
      fileName: 'compose.yaml',
      mimeType: 'application/yaml;charset=utf-8',
    };
    const auditArtifact = {
      base64: encodeBase64Text(audit),
      fileName: 'docker-compose-report.json',
      mimeType: 'application/json;charset=utf-8',
    };

    return {
      artifact: output === 'report' ? auditArtifact : yamlArtifact,
      artifacts: [output === 'report' ? yamlArtifact : auditArtifact],
      language: output === 'report' ? 'json' : 'yaml',
      summary: `${result.image} → app service.\n${result.warnings.join('\n')}`,
      text: output === 'report' ? audit : result.text,
    };
  },
  samples: [
    {
      fields: { output: 'yaml' },
      label: 'Nginx container',
      text: 'docker run -d --name web -p 8080:80 -v /data:/usr/share/nginx/html --restart always nginx:alpine',
    },
    {
      fields: { output: 'yaml' },
      label: 'Postgres container',
      text: 'docker run -d --name db -p 5432:5432 -e POSTGRES_PASSWORD=example-only -e POSTGRES_DB=app -v pgdata:/var/lib/postgresql/data postgres:16',
    },
    {
      fields: { output: 'yaml' },
      label: 'Command after image',
      text: 'docker run --name worker node:22 node --version',
    },
    {
      fields: { output: 'yaml' },
      label: 'Quoted values and arguments',
      text: 'docker run -e "GREETING=hello world" alpine printf "%s" "hello world"',
    },
    {
      fields: { output: 'yaml' },
      label: 'Literal container dollar',
      text: 'docker run alpine sh -c \'echo "$HOME"\'',
    },
    {
      fields: { output: 'yaml' },
      label: 'Read-only bind mount',
      text: 'docker run --mount type=bind,source=/srv/site,target=/usr/share/nginx/html,readonly nginx:alpine',
    },
    {
      fields: { output: 'yaml' },
      label: 'Interactive one-off container',
      text: 'docker run --rm -it alpine sh',
    },
    {
      fields: { output: 'yaml' },
      label: 'Existing external network',
      text: 'docker run --network app-net -e API_TOKEN alpine sleep 60',
    },
    {
      fields: { output: 'yaml' },
      label: 'Attached and equals flags',
      text: 'docker container run --name=web -p127.0.0.1:8080:80 --restart=unless-stopped nginx:alpine',
    },
    {
      fields: { output: 'yaml' },
      label: 'Backslash continuation',
      text: 'docker run \\\n  --name web \\\n  -p 8080:80 \\\n  nginx:alpine',
    },
    {
      fields: { output: 'yaml' },
      label: 'Resource and security controls',
      text: 'docker run --read-only --init --cap-drop ALL --security-opt no-new-privileges=true --memory 256m --cpus 0.5 --user 1000:1000 --workdir /app alpine sleep 60',
    },
    {
      fields: { output: 'report' },
      label: 'Structured conversion audit',
      text: 'docker run --env-file ./app.env --label team=platform --hostname worker -v cache:/cache:ro alpine sleep 60',
    },
  ],
  supportsSelection: true,
  freshResults: true,
};
