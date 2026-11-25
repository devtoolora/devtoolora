import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join, posix } from 'node:path';
import { beforeEach, describe, it, vi } from 'vitest';
import { applyResult } from '../src/extension/resultActions';

type FakeUri = { fsPath: string; path: string; scheme: string; toString(): string };
type FakeDocument = { isClosed: boolean; uri: FakeUri; version: number };

const vscode = vi.hoisted(() => {
  const uri = (path: string, scheme = 'file'): FakeUri => ({
    fsPath: path,
    path,
    scheme,
    toString: () => `${scheme}:${path}`,
  });

  return {
    edits: [] as Array<{ kind: string; text: string; uri: FakeUri; where: unknown }>,
    saveDialogUris: [] as FakeUri[],
    scratch: [] as string[],
    textDocuments: [] as FakeDocument[],
    uri,
    workspaceFolders: undefined as Array<{ uri: FakeUri }> | undefined,
  };
});

vi.mock('vscode', () => ({
  Uri: {
    file: (path: string) => vscode.uri(path),
    joinPath: (base: FakeUri, ...parts: string[]) =>
      vscode.uri(posix.join(base.path, ...parts), base.scheme),
  },
  WorkspaceEdit: class {
    insert(uri: FakeUri, where: unknown, text: string): void {
      vscode.edits.push({ kind: 'insert', text, uri, where });
    }

    replace(uri: FakeUri, where: unknown, text: string): void {
      vscode.edits.push({ kind: 'replace', text, uri, where });
    }
  },
  window: {
    activeTextEditor: undefined,
    showSaveDialog: async (options: { defaultUri: FakeUri }) => {
      vscode.saveDialogUris.push(options.defaultUri);

      return undefined;
    },
    showTextDocument: async () => undefined,
  },
  workspace: {
    applyEdit: async () => true,
    openTextDocument: async (options: { content: string }) => {
      vscode.scratch.push(options.content);

      return {};
    },
    get textDocuments() {
      return vscode.textDocuments;
    },
    get workspaceFolders() {
      return vscode.workspaceFolders;
    },
  },
}));

const selection = { active: { character: 3, line: 0 } };

function openDocument({ isClosed = false, version = 1 } = {}) {
  const uri = vscode.uri('/repo/src/data.json');

  vscode.textDocuments = [{ isClosed, uri, version }];

  return { selection, uri, version: 1 } as never;
}

describe('applyResult', () => {
  beforeEach(() => {
    vscode.edits = [];
    vscode.saveDialogUris = [];
    vscode.scratch = [];
    vscode.textDocuments = [];
    vscode.workspaceFolders = undefined;
  });

  it('replaces the text the tool was opened with while the tool panel has focus', async () => {
    const source = openDocument();

    await applyResult('replace', { text: '{\n  "a": 1\n}' }, source);

    assert.deepEqual(
      vscode.edits.map(({ kind, text, uri, where }) => [kind, uri.path, where, text]),
      [['replace', '/repo/src/data.json', selection, '{\n  "a": 1\n}']],
    );

    assert.deepEqual(vscode.scratch, []);
  });

  it('inserts at the source cursor and falls back to a scratch editor once it is closed', async () => {
    await applyResult('insert', { text: 'x' }, openDocument());
    assert.deepEqual(vscode.edits[0]?.where, selection.active);
    await applyResult('insert', { text: 'y' }, openDocument({ isClosed: true }));
    assert.deepEqual(vscode.scratch, ['y']);
  });

  it('opens a scratch editor once the source document changed since the tool opened', async () => {
    await applyResult('replace', { text: 'new' }, openDocument({ version: 2 }));
    await applyResult('insert', { text: 'moved' }, openDocument({ version: 2 }));
    await applyResult('replace', { text: 'none' }, undefined);
    assert.deepEqual(vscode.edits, []);
    assert.deepEqual(vscode.scratch, ['new', 'moved', 'none']);
  });

  it('suggests saving next to the source, in the workspace, or in the home folder', async () => {
    await applyResult('save', { text: 'a' }, openDocument());
    vscode.workspaceFolders = [{ uri: vscode.uri('/workspace') }];
    await applyResult('save', { text: 'b' }, undefined);
    vscode.workspaceFolders = undefined;
    await applyResult('save', { text: 'c' }, undefined);

    assert.deepEqual(
      vscode.saveDialogUris.map((uri) => uri.fsPath),
      [
        '/repo/src/devtoolora-result.txt',
        '/workspace/devtoolora-result.txt',
        join(homedir(), 'devtoolora-result.txt'),
      ],
    );
  });
});
