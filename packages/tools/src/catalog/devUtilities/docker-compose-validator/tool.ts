import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { formatComposeReport, validateCompose } from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const stack = [
  'services:',
  '  web:',
  '    image: nginx:1.27',
  '    ports:',
  '      - "8080:80"',
  '    depends_on:',
  '      api:',
  '        condition: service_healthy',
  '    networks: [back]',
  '  api:',
  '    build: ./api',
  '    environment:',
  '      DATABASE_URL: postgres://app@db/app',
  '    volumes:',
  '      - uploads:/srv/uploads',
  '    healthcheck:',
  '      test: ["CMD-SHELL", "curl -f http://localhost:3000/health"]',
  '      interval: 1m30s',
  '    networks: [back]',
  '  db:',
  '    image: postgres:16',
  '    volumes:',
  '      - dbdata:/var/lib/postgresql/data',
  '    networks: [back]',
  'networks:',
  '  back:',
  'volumes:',
  '  dbdata:',
  '  uploads:',
].join('\n');

const typos = [
  'services:',
  '  web:',
  '    image: nginx:1.27',
  '    ports:',
  '      - "80:80:80"',
  '    enviroment:',
  '      - DEBUG=1',
  '    depends_on:',
  '      - api',
  '  api:',
  '    build: ./api',
  '    restart: false',
].join('\n');

const portsAndVolumes = [
  'services:',
  '  web:',
  '    image: nginx',
  '    ports:',
  '      - "70000:80"',
  '      - "8000-8010:8000-8020"',
  '      - { published: 8080 }',
  '    volumes:',
  '      - data:data',
  '      - ./site:/usr/share/nginx/html:readonly',
  '      - { type: bind, source: ./conf }',
].join('\n');

const references = [
  'services:',
  '  web:',
  '    image: nginx',
  '    depends_on: [cache]',
  '    links: ["db:database"]',
  '    volumes: ["uploads:/srv/uploads"]',
  '    networks: [front]',
  '    secrets: [api_key]',
  '    network_mode: service:proxy',
].join('\n');

const cycle = [
  'services:',
  '  web:',
  '    image: nginx',
  '    depends_on: [api]',
  '  api:',
  '    image: node:22',
  '    depends_on: [db]',
  '  db:',
  '    image: postgres:16',
  '    depends_on: [web]',
].join('\n');

const obsolete = [
  'version: "3.9"',
  'services:',
  '  web:',
  '    image: ${REGISTRY}/web:${TAG}',
  '    ports:',
  '      - "${PORT}:80"',
  '    volumes:',
  '      - "$DATA_DIR:/data"',
  '  worker:',
  '    image: worker:1',
  '    deploy:',
  '      replicas: 3',
].join('\n');

const sample = (label: string, text: string) => ({ fields: { output: 'report' }, label, text });

export const dockerComposeValidatorTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Check a Compose file for unknown keys, wrong value shapes, bad port and volume mappings, undefined references and dependency cycles.',
  fields: [
    {
      defaultValue: 'report',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Report', value: 'report' },
        { label: 'JSON', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'docker-compose-validator',
  inputKind: 'text',
  keywords: [
    'docker compose',
    'compose.yaml',
    'docker-compose.yml',
    'compose lint',
    'validate compose',
    'compose schema',
  ],
  name: 'Docker Compose Validator',
  outputKind: 'text',
  relatedToolIds: ['docker-to-compose', 'yaml-format', 'dotenv-validator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const output = fields.output ?? 'report';

    if (output !== 'report' && output !== 'json') {
      throw new ToolError('Choose Report or JSON.');
    }

    const validation = withToolError(() => validateCompose(text));
    const { report, summary } = formatComposeReport(validation);
    const json = JSON.stringify(
      {
        errors: validation.errors,
        services: validation.services,
        valid: validation.valid,
        warnings: validation.warnings,
      },
      null,
      2,
    );
    const reportArtifact = {
      base64: encodeBase64Text(report),
      fileName: 'compose-report.txt',
      mimeType: 'text/plain;charset=utf-8',
    };
    const jsonArtifact = {
      base64: encodeBase64Text(json),
      fileName: 'compose-report.json',
      mimeType: 'application/json;charset=utf-8',
    };

    return {
      artifact: output === 'json' ? jsonArtifact : reportArtifact,
      artifacts: [output === 'json' ? reportArtifact : jsonArtifact],
      language: output === 'json' ? 'json' : 'plaintext',
      summary,
      text: output === 'json' ? json : report,
    };
  },
  samples: [
    sample('Valid three-service stack', stack),
    sample('Typos and a bad port', typos),
    sample('Port and volume mistakes', portsAndVolumes),
    sample('Undefined references', references),
    sample('Dependency cycle', cycle),
    sample('Obsolete version and interpolation', obsolete),
  ],
  sensitiveInput: true,
  supportsSelection: true,
};
