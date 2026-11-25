import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';

const packageRoot = join(process.cwd(), 'packages', 'tool-ui');

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

describe('tool-ui package boundaries', () => {
  it('declares runtime and peer dependencies and is consumed from source', () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      main?: string;
      name: string;
      peerDependencies?: Record<string, string>;
      private?: boolean;
    };

    assert.equal(pkg.name, '@devtoolora/tool-ui');
    assert.equal(pkg.private, true);
    assert.equal(pkg.main, undefined);

    for (const dependency of [
      '@devtoolora/browser-catalog',
      '@devtoolora/core',
      '@devtoolora/functions',
      'lucide-react',
    ]) {
      assert.ok(pkg.dependencies?.[dependency], dependency);
    }

    for (const peer of ['react', 'react-dom']) {
      assert.ok(pkg.peerDependencies?.[peer], peer);
    }
  });

  it('is resolved from source through package exports and declared by the web app', () => {
    const toolUiPackage = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, string>;
    };

    assert.deepEqual(toolUiPackage.exports, {
      '.': './src/index.ts',
      './ui': './src/ui/index.ts',
    });

    const webPackage = JSON.parse(
      readFileSync(join(process.cwd(), 'apps', 'web', 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };

    assert.ok(webPackage.dependencies['@devtoolora/tool-ui']);
  });

  it('leaves tool-ui styling to tool-ui instead of app :global selectors', () => {
    const classNames = (root: string, pattern: RegExp) =>
      new Set(
        listFiles(root)
          .filter((path) => path.endsWith('.tsx'))
          .flatMap((path) =>
            [...readFileSync(path, 'utf8').matchAll(pattern)].flatMap((match) =>
              (match[1] ?? match[2])!.split(/\s+/),
            ),
          )
          .filter((name) => /^[a-z]+(?:-[a-z]+)+$/.test(name)),
      );
    const classAttribute = /className=(?:"([^"]+)"|\{`([^`]+)`\})/g;
    const toolUiClasses = classNames(join(packageRoot, 'src'), classAttribute);
    // A class the app also renders itself (eyebrow, active) is the app's own hook.
    const appClasses = classNames(join(process.cwd(), 'apps', 'web', 'src'), classAttribute);
    const webModules = listFiles(join(process.cwd(), 'apps', 'web', 'src')).filter((path) =>
      path.endsWith('.module.scss'),
    );
    const hits = webModules.flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(/:global\(\.([a-z-]+)/g)]
        .map((match) => match[1]!)
        .filter((name) => toolUiClasses.has(name) && !appClasses.has(name))
        .map((name) => `${path.slice(process.cwd().length + 1)}: .${name}`),
    );

    assert.deepEqual(hits, []);
  });

  it('keeps the runner free of app-shell imports', () => {
    const sources = listFiles(join(packageRoot, 'src'));

    for (const path of sources.filter((candidate) => /\.(?:ts|tsx)$/.test(candidate))) {
      const source = readFileSync(path, 'utf8');

      assert.doesNotMatch(
        source,
        /from ['"](?:react-router|@components|@styles|@\/|@tauri-apps)/,
        path,
      );

      assert.doesNotMatch(source, /\?worker/, path);

      // The runner may use the isolated worker helper and the tool texts, never the executable tool
      // catalog itself.
      assert.doesNotMatch(
        source
          .replaceAll('@devtoolora/browser-catalog/worker', '')
          .replaceAll('@devtoolora/browser-catalog/content', ''),
        /@devtoolora\/(?:browser-catalog|tools)/,
        path,
      );
    }

    for (const path of sources.filter((candidate) => candidate.endsWith('.scss'))) {
      assert.doesNotMatch(readFileSync(path, 'utf8'), /@styles\//, path);
    }
  });

  it('compares no tool id with a string literal in shared code', () => {
    const knownToolIds = new Set(
      [
        ...readFileSync(
          join(process.cwd(), 'packages', 'browser-catalog', 'src', 'toolDomains.generated.ts'),
          'utf8',
        ).matchAll(/^\s*'([a-z0-9-]+)':/gm),
      ].map((match) => match[1]!),
    );
    const offenders: string[] = [];

    for (const root of sharedCodeRoots) {
      const files = listFiles(join(process.cwd(), root)).filter(
        (path) => /\.(?:ts|tsx)$/.test(path) && !path.endsWith('.generated.ts'),
      );

      for (const path of files) {
        const relative = relativePath(path);

        if (toolIdLiteralAllowlist.has(relative)) continue;

        const hits = toolIdUses(readFileSync(path, 'utf8'), knownToolIds);

        if (hits.length > 0) offenders.push(`${relative}: ${hits.join(', ')}`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      'Declare it on the tool definition (preview, badge, visibleWhen, runRequires, selectionTarget).',
    );
  });
});

const sharedCodeRoots = [
  'packages/core/src',
  'packages/tool-ui/src',
  'apps/web/src',
  'apps/vscode/src',
];

const toolIdLiteralAllowlist = new Set([
  // The tool opened by default.
  'apps/web/src/features/desktop/components/desktop-app/DesktopApp.tsx',
  // The suggestions shown before anything is typed.
  'apps/web/src/features/search/searchTools.ts',
  // The context type to tools table.
  'packages/core/src/contextDetection.ts',
]);

function relativePath(path: string): string {
  return path.slice(process.cwd().length + 1);
}

function toolIdUses(rawSource: string, knownToolIds: Set<string>): string[] {
  // A preview kind ('color-palette') and a union member of ToolPreviewKind may equal a tool id
  // without naming the tool.
  const source = rawSource
    .replace(/\.preview\s*[!=]==\s*'[a-z-]+'/g, '')
    .replace(/^\s*\|\s*'[a-z0-9-]+'$/gm, '');
  const hits = new Set<string>();

  for (const match of source.matchAll(/(['"`])([a-z0-9]+(?:-[a-z0-9]+)*)\1/g)) {
    if (knownToolIds.has(match[2]!)) hits.add(`'${match[2]}'`);
  }

  for (const match of source.matchAll(/(?<![\w$.'"`])([a-z][a-z0-9]*)\s*:/g)) {
    if (knownToolIds.has(match[1]!)) hits.add(`${match[1]}:`);
  }

  if (/\b(?:tool|definition|metadata)\.id\.startsWith\(/.test(source)) hits.add('id.startsWith(');

  return [...hits];
}
