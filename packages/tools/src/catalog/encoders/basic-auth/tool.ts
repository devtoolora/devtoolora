import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { browserSafeCapabilities } from '../shared';

export const basicAuthTool: ToolDefinition = {
  id: 'basic-auth',
  name: 'Basic Auth Generator',
  category: 'Encoders',
  description:
    'Generate a UTF-8 HTTP Basic Authorization header from a username and password without sending a request.',
  samples: [
    { fields: { password: 'secret', username: 'demo' }, label: 'Demo credentials' },
    { fields: { password: 'pass', username: 'user' }, label: 'Placeholder user and pass' },
    { fields: { password: 'open sesame', username: 'Aladdin' }, label: 'RFC 7617 example' },
    { fields: { password: 'pa:ss', username: 'user' }, label: 'Colon in password' },
    { fields: { password: 'demo', username: 'demo@example.com' }, label: 'Email as username' },
    { fields: { password: 'pässwörd', username: 'demo' }, label: 'UTF-8 password' },
  ],
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  fields: [
    {
      id: 'username',
      label: 'Username',
      required: true,
      type: 'text',
      placeholder: 'user',
      help: 'Required; spaces are significant, and a username cannot contain a colon or control characters.',
    },
    {
      id: 'password',
      label: 'Password',
      required: true,
      type: 'password',
      placeholder: 'password',
      help: 'Required; spaces and colons are preserved, but control characters are not allowed.',
    },
  ],
  keywords: ['basic auth', 'authorization', 'http', 'header', 'username', 'password', 'base64'],
  relatedToolIds: ['base64-encode', 'http-request-builder'],
  run: ({ fields }) => {
    const username = fields.username ?? '';
    const password = fields.password ?? '';

    if (!username || !password) throw new ToolError('Username and password are required.');
    if (username.includes(':')) throw new ToolError('Username cannot contain a colon.');
    if (/[\u0000-\u001f\u007f]/.test(username + password))
      throw new ToolError('Credentials cannot contain ASCII control characters.');

    return {
      text: `Authorization: Basic ${encodeBase64Text(`${username}:${password}`)}`,
      language: 'plaintext',
      summary: 'Basic Auth header generated locally · UTF-8 credentials · no request sent.',
    };
  },
};
