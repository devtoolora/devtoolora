import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { browserTextTools as textTools } from '@devtoolora/tools';
import { browserWorkerTools } from '@devtoolora/browser-catalog';
import { ToolError } from '@devtoolora/core';
import { contentOf } from './toolContent';
import { demoLeaf, demoRoot } from '../src/catalog/crypto/shared';
import { result, run, textDataUri } from './tools.helpers';

describe('text and crypto tools', () => {
  it('documents naming rules, resets every sample option and exports the exact text including empty results', async () => {
    for (const id of ['slugify', 'case-convert']) {
      const tool = textTools.find((entry) => entry.id === id);

      assert.ok(tool);
      assert.equal(contentOf(tool).documentation?.length, 2);

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(
          Object.keys(sample.fields ?? {}).sort(),
          id === 'slugify'
            ? ['alphabet', 'lowercase', 'preserveNumbers', 'removeAccents', 'separator']
            : ['case', 'locale', 'removeAccents'],
        );

        const output = await result(id, sample.text, sample.fields);

        assert.equal(
          output.artifact?.fileName,
          id === 'slugify' ? 'slug.txt' : 'converted-case.txt',
        );

        assert.equal(
          Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
          output.text,
        );
      }
    }

    assert.equal(await run('slugify', '你好 世界', { alphabet: 'unicode' }), '你好-世界');
    await assert.rejects(result('slugify', '你好', { alphabet: 'ascii' }), /Choose Unicode/);

    await assert.rejects(
      result('case-convert', 'a', { removeAccents: 'yes' }),
      /Remove Latin accents must be true or false\./,
    );

    await assert.rejects(result('slugify', 'text', { separator: '/' }), /separator must be/);
    await assert.rejects(result('slugify', 'text', { lowercase: 'yes' }), /true or false/);
    await assert.rejects(result('case-convert', 'text', { case: 'unknown' }), /supported target/);

    await assert.rejects(
      result('case-convert', 'text', { locale: 'invalid' }),
      /supported case-rule/,
    );

    const empty = await result('case-convert', '😀', { case: 'snake' });

    assert.equal(empty.text, '');
    assert.equal(empty.artifact?.base64, '');
    assert.match(empty.summary ?? '', /empty result/);
  });

  it('converts Unicode cases, slugifies with options, and tests regexes', async () => {
    assert.equal(await run('case-convert', 'hello world', { case: 'pascal' }), 'HelloWorld');
    assert.equal(await run('case-convert', 'déjà vu 123!!!', { case: 'camel' }), 'dejaVu123');

    assert.equal(
      await run('case-convert', 'API_response-code', { case: 'kebab' }),
      'api-response-code',
    );

    assert.equal(await run('case-convert', 'hello WORLD', { case: 'sentence' }), 'Hello world');

    assert.equal(
      await run('slugify', 'Crème brûlée #42!!!', {
        separator: '_',
        lowercase: 'true',
        preserveNumbers: 'true',
        removeAccents: 'true',
      }),
      'creme_brulee_42',
    );

    assert.equal(
      JSON.parse(await run('regex-test', 'abc 123', { pattern: '\\d+', flags: 'g' })).count,
      1,
    );

    const markdown = await result('markdown-helper', '# Hi\n\n\n<script>x</script>', {
      stripHtml: 'true',
      collapseWhitespace: 'true',
    });

    assert.equal(markdown.text, '# Hi\n\n');
    assert.match(markdown.summary ?? '', /Headings: 1/);

    assert.match(
      await run('markdown-to-html', '# Hi\n\nThis is **bold**.'),
      /<strong>bold<\/strong>/,
    );

    const diff = JSON.parse(await run('text-diff', '', { left: 'a\nb', right: 'a\nc' }));

    assert.equal(diff.added, 1);
    assert.equal(diff.removed, 1);
    assert.equal(diff.rows[1].before.text, 'b');
    assert.equal(diff.rows[1].after.text, 'c');
    const oneSentence = await run('lorem-ipsum', '', { sentences: '1' });
    const fiveSentences = await run('lorem-ipsum', '', { sentences: '5' });
    const sixSentences = await run('lorem-ipsum', '', { sentences: '6' });
    const hundredSentences = await run('lorem-ipsum', '', { sentences: '100' });
    const countSentences = (text: string) => text.match(/\./g)?.length ?? 0;

    assert.match(oneSentence, /^Lorem ipsum/);
    assert.equal(countSentences(oneSentence), 1);
    assert.equal(countSentences(fiveSentences), 5);
    assert.equal(countSentences(sixSentences), 6);
    assert.equal(countSentences(hundredSentences), 100);
    assert.equal(fiveSentences.includes('\n\n'), false);
    assert.equal(sixSentences.split('\n\n').length, 2);
    assert.notEqual(sixSentences.split('. ')[0], sixSentences.split('. ')[1]);
    await assert.rejects(async () => run('lorem-ipsum', '', { sentences: '0' }), /whole number/);
    await assert.rejects(async () => run('lorem-ipsum', '', { sentences: '101' }), /whole number/);

    await assert.rejects(
      async () => run('lorem-ipsum', '', { sentences: 'invalid' }),
      /whole number/,
    );
  });

  it('calculates text statistics for multiline special-character text', async () => {
    const stats = JSON.parse(
      await run('text-statistics', 'Hello 123!\nČau světe #2', { output: 'json' }),
    );

    assert.equal(stats.lines, 2);
    assert.equal(stats.words, 5);
    assert.equal(stats.digits, 4);
    assert.equal(stats.symbols, 2);
    assert.ok(stats.bytes > stats.characters);
  });

  it('generates FIGlet ASCII text with bundled fonts and validates input', async () => {
    const asciiTool = browserWorkerTools.find((tool) => tool.id === 'ascii-text-generator');
    const fontField = asciiTool?.fields?.find((field) => field.id === 'font');
    const standard = await run('ascii-text-generator', 'Hi');
    const big = await run('ascii-text-generator', 'Hi', { font: 'Big' });
    const multiline = await run('ascii-text-generator', 'Hi\nBye');

    assert.equal(asciiTool?.autoRun, true);
    assert.deepEqual(asciiTool?.resultActions, ['copy', 'insert', 'scratch', 'save']);
    assert.equal(fontField?.type, 'select');

    if (fontField?.type === 'select') {
      assert.equal(fontField.searchable, true);
      assert.ok(fontField.options.length >= 300);
      assert.ok(fontField.options.some((option) => option.value === 'Standard'));
    }

    assert.match(standard, /_   _/);
    assert.notEqual(big, standard);
    assert.ok(multiline.split('\n').length > standard.split('\n').length);
    await assert.rejects(() => run('ascii-text-generator', '   '), /Text is required/);

    await assert.rejects(
      () => run('ascii-text-generator', 'a'.repeat(101)),
      /limited to 100 characters/,
    );

    await assert.rejects(
      () => run('ascii-text-generator', 'Hi', { font: 'Missing Font' }),
      /Unknown FIGlet font/,
    );
  });

  it('generates hashes, HMACs, UUIDs, ULIDs, tokens, and passwords', async () => {
    assert.equal(
      await run('hash', 'hello', { algorithm: 'sha256' }),
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );

    assert.equal(
      await run('hash', 'hello', { algorithm: 'md5' }),
      '5d41402abc4b2a76b9719d911017c592',
    );

    assert.match(
      await run('hmac', 'hello', { algorithm: 'sha256', secret: 'secret' }),
      /^[a-f0-9]{64}$/,
    );

    assert.match(await run('uuid', '', { count: '2' }), /^[0-9a-f-]{36}\n[0-9a-f-]{36}$/);
    assert.match(await run('ulid'), /^[0-9A-HJKMNP-TV-Z]{26}$/);

    assert.match(
      await run('random-token', '', {
        mode: 'custom',
        length: '12',
        count: '1',
        lowercase: 'true',
        uppercase: 'false',
        numbers: 'false',
        symbols: 'false',
      }),
      /^[a-z]{12}$/,
    );

    assert.match(
      await run('password-generator', '', {
        length: '16',
        count: '1',
        lowercase: 'true',
        uppercase: 'true',
        numbers: 'true',
        symbols: 'false',
      }),
      /^[A-Za-z0-9]{16}$/,
    );

    assert.equal(
      JSON.parse(await run('password-strength', 'Correct horse battery staple 42!')).rating,
      'strong',
    );
  });
});

describe('dev utilities', () => {
  it('converts common docker run commands', async () => {
    const output = await run(
      'docker-to-compose',
      'docker run --name web -p 8080:80 -e NODE_ENV=production nginx:latest',
    );

    assert.match(output, /container_name: "web"/);
    assert.match(output, /image: "nginx:latest"/);
    assert.match(output, /8080:80/);
  });

  it('explains cron, calculates subnets, and documents chmod', async () => {
    assert.match(await run('cron-explain', '*/15 * * * *'), /Plain English/);

    assert.match(
      await run('cron-explain', '0 9 * * 1-5'),
      /from 1 \(Monday\) through 5 \(Friday\)/,
    );

    assert.match(await run('cron-explain', '0 0 1 * *'), /Day of month: at 1/);
    const subnet = JSON.parse(await run('ipv4-subnet', '192.168.1.10/24'));

    assert.equal(subnet.networkAddress, '192.168.1.0');
    assert.equal(subnet.broadcastAddress, '192.168.1.255');
    assert.equal(JSON.parse(await run('chmod-calculator', '755')).symbolic.owner, 'rwx');

    assert.ok(contentOf({ id: 'chmod-calculator' }).help?.includes('owner'));

    assert.equal(
      JSON.parse(await run('semver-compare', '', { left: '1.2.3', right: '1.3.0' })).result,
      'right is newer',
    );

    assert.match(await run('cron-generator', '', { preset: 'weekdays9' }), /0 9 \* \* 1-5/);

    assert.match(
      await run('random-port', '', { count: '2', min: '3000', max: '3010' }),
      /^\d+\n\d+$/,
    );
  });

  it('builds a deterministic .gitignore with overrides and a save artifact', async () => {
    const generated = await result('gitignore-generator', '', {
      languages: 'node,python',
      frameworks: 'react-vite',
      excludeGeneratedRules: 'node_modules/\ndist/',
      customRules: 'node_modules/\ncoverage/\ncoverage/',
    });

    assert.match(generated.text, /^# Node\.js\n(?!node_modules\/)/);
    assert.ok(generated.text.indexOf('# Node.js') < generated.text.indexOf('# Python'));
    assert.ok(generated.text.indexOf('# Python') < generated.text.indexOf('# React / Vite'));
    assert.equal(generated.text.includes('\ndist/\n'), false);
    assert.match(generated.text, /# Custom rules\nnode_modules\/\ncoverage\/\ncoverage\/\n$/);
    assert.equal(generated.artifact?.fileName, '.gitignore');

    assert.equal(
      Buffer.from(generated.artifact?.base64 ?? '', 'base64').toString('utf8'),
      generated.text,
    );

    assert.deepEqual(generated.resultActions, ['copy', 'save', 'scratch']);

    const empty = await run('gitignore-generator');

    assert.equal(empty, '# Select one or more templates or add custom rules.\n');
  });

  it('generates QR artifacts through the canonical SVG-safe tool', async () => {
    const svg = await result('qr-code-generator', 'hello', {
      format: 'svg',
      size: '128',
      foreground: '#123456',
      background: '#abcdef',
    });

    assert.match(svg.text, /<svg/);
    assert.match(svg.text, /#123456/);
    assert.equal(svg.artifact?.mimeType, 'image/svg+xml');
    assert.match(svg.previewDataUri ?? '', /^data:image\/svg\+xml;base64,/);

    await assert.rejects(
      () => result('qr-code-generator', 'hello', { format: 'png', size: '128' }),
      ToolError,
    );

    assert.match(
      await run('wifi-qr', '', {
        ssid: 'Guest',
        password: 'secret',
        security: 'WPA',
        hidden: 'false',
      }),
      /WIFI:T:WPA;S:Guest;P:secret/,
    );

    const placeholder = await result('svg-placeholder', '', {
      width: '300',
      height: '150',
      text: 'Preview',
      background: '#111111',
      foreground: '#ffffff',
    });

    assert.equal(placeholder.artifact?.mimeType, 'image/svg+xml');
  });

  it('optimizes SVG safely and rejects invalid SVG input', async () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- comment --><metadata>editor data</metadata><path id="mark" class="icon" data-role="logo" aria-label="Mark" d="M 2.0000 2.0000 L 22.0000 22.0000" /></svg>';
    const optimized = await result('svg-optimizer', source);

    assert.match(optimized.text, /viewBox="0 0 24 24"/);
    assert.match(optimized.text, /id="mark"/);
    assert.match(optimized.text, /class="icon"/);
    assert.match(optimized.text, /data-role="logo"/);
    assert.match(optimized.text, /aria-label="Mark"/);
    assert.doesNotMatch(optimized.text, /comment|metadata/);
    assert.ok(optimized.text.length < source.length);
    assert.equal(optimized.artifact?.fileName, 'optimized.svg');
    assert.match(optimized.previewDataUri ?? '', /^data:image\/svg\+xml;base64,/);
    await assert.rejects(() => run('svg-optimizer', 'not svg'), ToolError);
  });
});

describe('certificates and keys tools', () => {
  it('inspects PEM certificates and gives selected files precedence over pasted text', async () => {
    const output = await run('certificate-inspector', 'not a certificate', {
      certificateFile: textDataUri(demoLeaf),
    });
    const report = JSON.parse(output);

    assert.match(report.subject, /CN=api\.local\.test/);
    assert.match(report.issuer, /CN=Dev Toolora Demo Root/);
    assert.match(report.subjectAltName, /DNS:api\.local\.test/);
    assert.match(report.fingerprintSha256, /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/);
    assert.equal(report.publicKey.algorithm, 'rsa');
    assert.equal(typeof report.validityStatus, 'string');
    assert.doesNotMatch(output, /BEGIN CERTIFICATE|MIIDqz/);
    await assert.rejects(() => run('certificate-inspector', 'not a certificate'), ToolError);
  });

  it('analyzes certificate links in the supplied bundle order', async () => {
    const valid = JSON.parse(await run('certificate-chain-analyzer', `${demoLeaf}\n${demoRoot}`));

    assert.equal(valid.certificateCount, 2);
    assert.equal(valid.links[0].issuerMatchesNextSubject, true);
    assert.equal(valid.links[0].signatureVerified, true);
    assert.equal(valid.terminal.selfSignatureVerified, true);
    assert.match(valid.notice, /does not establish browser or operating-system trust/);

    const reversed = JSON.parse(
      await run('certificate-chain-analyzer', `${demoRoot}\n${demoLeaf}`),
    );

    assert.equal(reversed.links[0].issuerMatchesNextSubject, false);
    assert.equal(reversed.links[0].signatureVerified, false);
  });

  it('inspects public and encrypted private PEM keys without exposing their contents', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const encryptedPrivatePem = privateKey
      .export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'correct-horse' })
      .toString();

    const publicReport = JSON.parse(await run('pem-key-inspector', publicPem));

    assert.equal(publicReport.kind, 'public');
    assert.equal(publicReport.algorithm, 'rsa');
    assert.equal(publicReport.details.modulusLength, 2048);
    assert.match(publicReport.publicKeyFingerprintSha256, /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/);

    const privateOutput = await run('pem-key-inspector', encryptedPrivatePem, {
      passphrase: 'correct-horse',
    });
    const privateReport = JSON.parse(privateOutput);

    assert.equal(privateReport.kind, 'private');
    assert.equal(privateReport.encryptedPrivateKey, true);
    assert.equal(privateReport.algorithm, 'encrypted');
    assert.doesNotMatch(privateOutput, /BEGIN|correct-horse|PRIVATE KEY/);
  });
});
