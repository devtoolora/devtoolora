import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A SemVer range tells npm, pnpm and Yarn which versions of a dependency are acceptable. It is a set of comparators such as >=1.2.3 <2.0.0-0, and a version satisfies the range when it passes every comparator of at least one set.',
        'Shorthand is expanded first. A caret allows changes that do not touch the leftmost nonzero number, so ^1.2.3 is >=1.2.3 <2.0.0-0 and ^0.2.3 is >=0.2.3 <0.3.0-0. A tilde allows patch changes, so ~1.2.3 is >=1.2.3 <1.3.0-0.',
        'An x, X or * stands for any number, a partial version such as 1.2 means 1.2.x, and a hyphen range such as 1.2.3 - 2.3.4 includes both ends. Sets are joined with ||.',
      ],
      title: 'How npm ranges work',
    },
    {
      content: [
        'Check which published versions a dependency range in package.json accepts.',
        'Understand why a prerelease such as 2.0.0-rc.1 is not installed by ^1.2.3.',
        'Test a list of Git tags against a release policy before tagging.',
        'See a caret, tilde or hyphen range rewritten as plain comparators.',
      ],
      title: 'When to use Semver Range Tester',
    },
  ],
  examples: [
    '^1.2.3 → Range: >=1.2.3 <2.0.0-0; 1.9.0 matches and 2.0.0 does not.',
    '~1.2 → >=1.2.0 <1.3.0-0; 1.2.9 matches and 1.3.0 does not.',
    '1.2.3 - 2.3 → >=1.2.3 <2.4.0-0, because a partial upper bound includes all of 2.3.x.',
    '>1.2.3-alpha.3 → 1.2.3-alpha.7 matches, 3.4.5-alpha.9 does not unless Include prereleases is on.',
    'A line such as latest or 1.2 → marked with ! and the reason, and the other lines are still tested.',
    'v2.1.4 → the leading v is dropped, so Git tags can be pasted as they are.',
  ],
  faq: [
    {
      answer:
        'The -0 is the lowest possible prerelease. node-semver writes the upper bound of ^1.2.3 as <2.0.0-0 so that no prerelease of 2.0.0 slips in, and this tool shows the range the same way.',
      question: 'Why does the range end in -0?',
    },
    {
      answer:
        'By default a prerelease only matches when a comparator in the same set names a prerelease of the same major, minor and patch. So >1.2.3-alpha.3 accepts 1.2.3-alpha.7 but not 3.4.5-alpha.9. Turn on Include prereleases to treat them like other versions.',
      question: 'Why does a prerelease not match?',
    },
    {
      answer:
        'Each line is tested on its own. A line that is not a complete SemVer, such as 1.2 or latest, is marked with ! and a reason, and the rest of the list is still tested. Blank lines are skipped.',
      question: 'What happens to invalid version lines?',
    },
    {
      answer:
        'It follows node-semver 7 in strict mode, the library npm uses, with two differences: exact numbers above 2^53 and versions longer than 256 characters are accepted, where node-semver rejects them. Loose mode is not supported, so a range such as ^01.2.3 with a leading zero is reported as invalid instead of being guessed.',
      question: 'Does it match what npm installs?',
    },
    {
      answer:
        'Build metadata after a + is ignored when ordering versions and is removed from the range, as node-semver does. A version with build metadata is still shown as you typed it.',
      question: 'How is build metadata handled?',
    },
  ],
  help: 'Enter an npm range such as ^1.2.3, ~1.2, 1.x, >=1.2.3 <2 or 1.2.3 - 2.3.4. Combine alternatives with ||. A * accepts every release.\n\nPaste versions in the main input, one per line. A leading v is dropped, so Git tags such as v1.4.0 work. Blank lines are skipped.\n\nThe result starts with the range desugared into plain comparators, the way node-semver prints it. Each line is then marked ✓ for a match, ✗ for no match, or ! with the reason it is not a valid version.\n\nTurn on Include prereleases to let versions such as 1.5.0-rc.1 match a range that does not name a prerelease. The summary counts matches and names the highest and lowest matching version.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: range 1,024 characters; 10,000 version lines.',
    'Ranges follow node-semver 7 in strict mode; loose mode is not supported.',
    'Unlike node-semver, exact numbers above 2^53 and versions longer than 256 characters are accepted.',
    'Versions must be complete SemVer: 1.2 or 1.2.3.4 is reported as invalid.',
    'The desugared range joins sets with || and shows a set that accepts everything as *.',
  ],
};
