import { FunctionError } from '../errors';

export type SemanticVersion = {
  build: string[];
  core: [string, string, string];
  input: string;
  prerelease: string[];
  version: string;
};
export type SemverComparison = {
  comparison: -1 | 0 | 1;
  criterion:
    | 'major'
    | 'minor'
    | 'patch'
    | 'release'
    | 'prerelease-identifier'
    | 'prerelease-length'
    | 'equal';
  identical: boolean;
  left: SemanticVersion;
  reason: string;
  result: 'equal' | 'left is newer' | 'right is newer';
  right: SemanticVersion;
};

export function parseSemanticVersion(input: string, label: string): SemanticVersion {
  if (input.length > 1024)
    throw new FunctionError('INVALID_DEV_INPUT', `${label} is limited to 1,024 characters.`);

  const version = input.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
  const match =
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(
      version,
    );

  if (!match || match[0] !== version)
    throw new FunctionError(
      'INVALID_DEV_INPUT',
      `${label} must be a complete SemVer such as 1.2.3 or 1.2.3-beta.1+build.7. No v prefix, ranges, missing parts or leading zeroes in core numbers.`,
    );

  const prerelease = match[4]?.split('.') ?? [];

  if (
    prerelease.some(
      (identifier) => /^[0-9]+$/.test(identifier) && identifier.length > 1 && identifier[0] === '0',
    )
  ) {
    throw new FunctionError(
      'INVALID_DEV_INPUT',
      `${label}: numeric prerelease identifiers cannot have leading zeroes.`,
    );
  }

  return {
    build: match[5]?.split('.') ?? [],
    core: [match[1]!, match[2]!, match[3]!],
    input,
    prerelease,
    version,
  };
}

const comparisonResults: Record<-1 | 0 | 1, SemverComparison['result']> = {
  '-1': 'right is newer',
  0: 'equal',
  1: 'left is newer',
};

function compareNumeric(left: string, right: string): -1 | 0 | 1 {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  if (left === right) return 0;

  return left < right ? -1 : 1;
}

function comparePrereleaseIdentifiers(
  a: string,
  b: string,
): { comparison: -1 | 0 | 1; rule: string } {
  const aNumeric = /^[0-9]+$/.test(a);
  const bNumeric = /^[0-9]+$/.test(b);

  if (aNumeric && bNumeric)
    return {
      comparison: compareNumeric(a, b),
      rule: 'Numeric identifiers are compared numerically.',
    };
  if (aNumeric !== bNumeric)
    return {
      comparison: aNumeric ? -1 : 1,
      rule: 'Numeric identifiers have lower precedence than nonnumeric identifiers.',
    };

  return {
    comparison: a < b ? -1 : 1,
    rule: 'Nonnumeric identifiers are compared in case-sensitive ASCII order.',
  };
}

type ComparisonOutcome = Pick<SemverComparison, 'comparison' | 'criterion' | 'reason'>;

export function compareSemanticVersions(leftInput: string, rightInput: string): SemverComparison {
  const left = parseSemanticVersion(leftInput, 'Left version');
  const right = parseSemanticVersion(rightInput, 'Right version');
  const outcome =
    compareCore(left, right) ?? comparePrerelease(left, right) ?? equalOutcome(left, right);

  return {
    ...outcome,
    identical: left.version === right.version,
    left,
    result: comparisonResults[outcome.comparison],
    right,
  };
}

export function compareVersionPrecedence(
  left: SemanticVersion,
  right: SemanticVersion,
): -1 | 0 | 1 {
  return (compareCore(left, right) ?? comparePrerelease(left, right) ?? equalOutcome(left, right))
    .comparison;
}

function compareCore(left: SemanticVersion, right: SemanticVersion): ComparisonOutcome | undefined {
  const coreNames: Array<'major' | 'minor' | 'patch'> = ['major', 'minor', 'patch'];

  for (const [index, criterion] of coreNames.entries()) {
    const a = left.core[index];
    const b = right.core[index];

    if (a === undefined || b === undefined) continue;

    const comparison = compareNumeric(a, b);

    if (comparison !== 0)
      return {
        comparison,
        criterion,
        reason: `The ${criterion} number differs: ${a} versus ${b}. Core numbers are compared numerically before prerelease identifiers.`,
      };
  }

  return undefined;
}

function comparePrerelease(
  left: SemanticVersion,
  right: SemanticVersion,
): ComparisonOutcome | undefined {
  if (left.prerelease.length === 0 && right.prerelease.length > 0)
    return {
      comparison: 1,
      criterion: 'release',
      reason:
        'The left version is a final release; the right is a prerelease of the same core. A final release has higher precedence.',
    };
  if (right.prerelease.length === 0 && left.prerelease.length > 0)
    return {
      comparison: -1,
      criterion: 'release',
      reason:
        'The right version is a final release; the left is a prerelease of the same core. A final release has higher precedence.',
    };

  for (
    let index = 0;
    index < Math.min(left.prerelease.length, right.prerelease.length);
    index += 1
  ) {
    const a = left.prerelease[index]!;
    const b = right.prerelease[index]!;

    if (a === b) continue;

    const { comparison, rule } = comparePrereleaseIdentifiers(a, b);

    return {
      comparison,
      criterion: 'prerelease-identifier',
      reason: `Prerelease identifier ${index + 1} differs: ${a} versus ${b}. ${rule}`,
    };
  }

  if (left.prerelease.length !== right.prerelease.length)
    return {
      comparison: left.prerelease.length < right.prerelease.length ? -1 : 1,
      criterion: 'prerelease-length',
      reason:
        'All shared prerelease identifiers are equal. The version with more identifiers has higher precedence.',
    };

  return undefined;
}

function equalOutcome(left: SemanticVersion, right: SemanticVersion): ComparisonOutcome {
  return {
    comparison: 0,
    criterion: 'equal',
    reason:
      left.version === right.version
        ? 'Both versions have equal precedence and identical version text.'
        : 'Both versions have equal precedence. Build metadata is ignored when ordering versions, even when version text differs.',
  };
}
