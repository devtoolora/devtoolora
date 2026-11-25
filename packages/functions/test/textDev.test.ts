import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  calculateChmod,
  compareSemanticVersions,
  generateGitignore,
  inspectCronExpression,
  inspectDockerRun,
} from '@devtoolora/functions/dev';
import {
  cleanWhitespace,
  convertCase,
  findReplace,
  slugify,
  textStatistics,
  wrapText,
} from '@devtoolora/functions/text';

describe('text and developer functions', () => {
  it('handles reusable text transformations without tool contracts', () => {
    assert.equal(slugify('Crème brûlée #42'), 'creme-brulee-42');
    assert.equal(convertCase('API_response-code', 'camel'), 'apiResponseCode');
    assert.equal(textStatistics('one 2!').words, 2);
    assert.equal(cleanWhitespace('  one   two  '), 'one two');
    assert.equal(findReplace('Hello tools', 'tools', 'world'), 'Hello world');
    assert.equal(wrapText('one two three', 10), 'one two\nthree');
  });

  it('handles developer operations and typed gitignore sections', () => {
    assert.match(
      inspectDockerRun('docker run --name app -p 3000:3000 node:20').text,
      /container_name: "app"/,
    );

    assert.match(inspectCronExpression('*/15 * * * *').text, /every 15 minutes/);
    assert.equal(calculateChmod('755').compact, 'rwxr-xr-x');
    assert.equal(compareSemanticVersions('1.2.3', '1.3.0').result, 'right is newer');

    assert.equal(
      generateGitignore(
        [{ label: 'Node.js', rules: ['node_modules/', 'dist/'] }],
        ['custom/'],
        ['dist/'],
      ).text,
      '# Node.js\nnode_modules/\n\n# Custom rules\ncustom/\n',
    );
  });
});
