import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { bytesToUtf8, dataUriFromBytes, utf8Bytes } from '@devtoolora/functions/binary';
import { fileBytesFromField, filesFromField, zipArtifact } from '../src/adapters/files';

describe('tool file adapters', () => {
  it('maps serialized form fields to reusable binary values', () => {
    const data = dataUriFromBytes(utf8Bytes('content'), 'text/plain');
    const file = fileBytesFromField(data, 'File');

    assert.equal(file.mimeType, 'text/plain');
    assert.equal(bytesToUtf8(file.bytes), 'content');

    const files = filesFromField(JSON.stringify([{ name: 'one.txt', data }]), 'Files');

    assert.equal(files[0]!.name, 'one.txt');
    assert.equal(bytesToUtf8(files[0]!.bytes), 'content');
  });

  it('keeps UI-specific errors and artifact wrapping in the tools package', () => {
    assert.throws(() => fileBytesFromField(undefined, 'Image'), /Image is required\./);
    assert.throws(() => filesFromField('invalid', 'Files'), /Files must contain selected files\./);

    const artifact = zipArtifact([{ name: 'one.txt', bytes: utf8Bytes('content') }], 'files.zip');

    assert.equal(artifact.fileName, 'files.zip');
    assert.equal(artifact.mimeType, 'application/zip');
    assert.ok(artifact.base64.length > 0);
  });
});
