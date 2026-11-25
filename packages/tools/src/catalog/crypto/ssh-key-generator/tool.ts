import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { generateSshEd25519 } from '@devtoolora/functions/crypto';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, cryptoTextResult } from '../shared';

const comments = ['alice@laptop', 'deploy@ci', 'backup@nas', 'dev@workstation', 'admin@server', ''];

export const sshKeyGeneratorTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Generate an Ed25519 SSH key pair in your browser: an authorized_keys line, an OpenSSH private key and the SHA256 fingerprint.',
  fields: [{ defaultValue: '', id: 'comment', label: 'Comment', type: 'text' }],
  freshResults: true,
  id: 'ssh-key-generator',
  inputKind: 'none',
  keywords: ['ssh', 'ed25519', 'openssh', 'authorized_keys', 'id_ed25519', 'fingerprint', 'keygen'],
  name: 'SSH Key Pair Generator',
  outputKind: 'text',
  relatedToolIds: [
    'key-pair-generator',
    'pem-key-inspector',
    'random-token',
    'ssh-config-generator',
  ],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => withToolErrorAsync(() => runSshKey(fields.comment ?? '')),
  samples: comments.map((comment) => ({
    fields: { comment },
    label: comment || 'No comment',
  })),
  supportsSelection: false,
};

async function runSshKey(comment: string): Promise<ToolResult> {
  const { fingerprint, privateKey, publicKey } = await generateSshEd25519(comment);
  const text = [
    '# Public key (authorized_keys)',
    `${publicKey}\n`,
    '# Private key (id_ed25519)',
    `${privateKey}`,
    '# Fingerprint',
    `${fingerprint}\n`,
  ].join('\n');

  return cryptoTextResult(
    'ssh-key',
    text,
    `Ed25519 · ${fingerprint} · ${comment ? `comment "${comment}"` : 'no comment'}`,
  );
}
