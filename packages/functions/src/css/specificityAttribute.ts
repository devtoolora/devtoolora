import type { Specificity } from './specificity';
import { fail, isDelim, isTypeName, type Cursor, type SelectorToken } from './specificityTokens';

const missingBracket = 'Missing "]" to close the attribute selector.';

export function skipNamespace(cursor: Cursor, isName: (token?: SelectorToken) => boolean): void {
  if (isDelim(cursor.peek(), '|') && isName(cursor.peek(1))) cursor.pos += 1;
  else if (isTypeName(cursor.peek()) && isDelim(cursor.peek(1), '|') && isName(cursor.peek(2)))
    cursor.pos += 2;
}

export function parseAttribute(cursor: Cursor): Specificity {
  const expect = (valid: boolean, message: string) => {
    if (!valid) fail(cursor.peek() ? message : missingBracket);
  };

  cursor.pos += 1;
  cursor.skipSpace();

  skipNamespace(cursor, (token) => token?.kind === 'ident');

  expect(cursor.peek()?.kind === 'ident', 'Expected an attribute name after "[".');
  cursor.pos += 1;
  cursor.skipSpace();

  if (!isDelim(cursor.peek(), ']')) {
    const operator = cursor.peek();
    const prefixed = ['~', '|', '^', '$', '*'].some((value) => isDelim(operator, value));

    expect(
      isDelim(operator, '=') || (prefixed && isDelim(cursor.peek(1), '=')),
      'Expected "]" or an operator: =, ~=, |=, ^=, $= or *=.',
    );

    cursor.pos += prefixed ? 2 : 1;
    cursor.skipSpace();

    expect(
      cursor.peek()?.kind === 'ident' || cursor.peek()?.kind === 'string',
      'Expected an attribute value; quote values that are not identifiers, e.g. [x="1"].',
    );

    cursor.pos += 1;
    cursor.skipSpace();

    const flag = cursor.peek();

    if (flag?.kind === 'ident' && ['i', 's'].includes(flag.value.toLowerCase())) {
      cursor.pos += 1;
      cursor.skipSpace();
    }
  }

  expect(isDelim(cursor.peek(), ']'), missingBracket);
  cursor.pos += 1;

  return [0, 1, 0];
}
