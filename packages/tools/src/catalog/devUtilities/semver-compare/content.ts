import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Semantic Versioning expresses a release as major.minor.patch, optionally followed by prerelease identifiers after a hyphen (-) and build metadata after +.',
        'The core numbers are compared numerically. For the same core, a final release sorts after a prerelease. Prerelease identifiers are then compared from left to right using SemVer rules.',
        'Build metadata does not influence precedence. Equal precedence is not necessarily identical version text, nor proof that two builds contain the same code.',
      ],
      title: 'What is Semantic Versioning?',
    },
    {
      content: [
        'Check whether one release has higher version precedence than another.',
        'Understand why beta.11 sorts after beta.2 or why a final release sorts after its release candidate.',
        'Inspect core, prerelease and build identifiers before debugging a version ordering issue.',
        'Save a comparison report for release notes or review.',
      ],
      title: 'When to compare semantic versions',
    },
  ],
  examples: [
    '1.9.0 vs 1.10.0 → Right has higher precedence: minor numbers use numeric comparison, not string order.',
    '2.0.0-beta.1 vs 2.0.0 → Right has higher precedence: a prerelease is lower than its corresponding final release.',
    '1.0.0-beta.2 vs 1.0.0-beta.11 → Right has higher precedence: numeric prerelease identifiers use numeric comparison.',
    '1.0.0-1 vs 1.0.0-alpha → Right has higher precedence: numeric identifiers sort before nonnumeric identifiers.',
    '1.0.0-alpha vs 1.0.0-alpha.1 → Right has higher precedence: after an equal shared prefix, more identifiers means higher precedence.',
    '1.0.0+001 vs 1.0.0+002 → Equal precedence with identical: false; build metadata is ignored.',
  ],
  faq: [
    {
      answer:
        'Each part of the major.minor.patch core is compared as a number, so minor 10 beats minor 9. Plain text sorting would put 1.10.0 first, because the character 1 sorts before 9.',
      question: 'Why is 1.10.0 newer than 1.9.0?',
    },
    {
      answer:
        'No. A prerelease has lower precedence than the final release with the same core, so 2.0.0-beta.1 < 2.0.0-rc.1 < 2.0.0.',
      question: 'Is 2.0.0-beta.1 newer than 2.0.0?',
    },
    {
      answer:
        'No. Everything after + appears in the report but is ignored for precedence, so 1.0.0+001 and 1.0.0+002 compare as equal while identical is false.',
      question: 'Does build metadata like +build.7 change the order?',
    },
    {
      answer:
        'No. Each field must be one complete version such as 1.2.3 or 1.2.3-rc.1; a v prefix, ^ or ~ ranges, wildcards and missing parts are rejected. Remove the v from a Git tag before comparing.',
      question: 'Can I compare v1.2.3 tags or ranges like ^1.2.0?',
    },
    {
      answer:
        'Text identifiers are compared in case-sensitive ASCII order, where every uppercase letter comes before every lowercase one. Keep prerelease labels in one case to avoid surprises.',
      question: 'Why does 1.0.0-Beta sort before 1.0.0-alpha?',
    },
  ],
  help: 'Enter one complete version on each side or select a sample. ASCII spaces, tabs and line breaks around a version are removed; the original field input remains in the audit.\n\nRun the comparison. The summary states which side has higher precedence and explains the first decisive core component or prerelease rule.\n\nInspect the JSON for exact core strings, prerelease identifiers, build metadata, comparison (−1, 0 or 1), identical normalized version text and the reason. Numeric strings avoid precision loss.\n\nCopy or save semver-comparison.json. Editing either field clears the previous result. No version is installed or changed.',
  notes: [
    'Uses Semantic Versioning 2.0.0 precedence; this is not a dependency-range or compatibility checker.',
    'Each raw version field is limited to 1,024 characters. Numeric components stay exact even beyond JavaScript’s safe-integer range.',
    'Requires exactly three nonnegative core numbers with no leading zeroes. Missing components, v prefixes, wildcard/range syntax, trailing junk and non-ASCII identifiers are rejected.',
    'Prerelease and build identifiers must be nonempty ASCII letters, digits or hyphens separated by dots. A numeric prerelease identifier cannot contain leading zeroes; build metadata may.',
    'Nonnumeric prerelease identifiers use case-sensitive ASCII order, not locale ordering or a fixed alpha/beta/rc list.',
    'Build metadata is present in the report but ignored for precedence. Equal precedence does not mean identical artifacts or compatible software.',
    'SemVer ordering does not prove that an upgrade is safe, supported or correctly labeled by its publisher. This tool makes no package-manager or network requests.',
  ],
};
