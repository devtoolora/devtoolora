import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Conventional Commits is a small convention for commit messages: a type, an optional scope in parentheses, a colon and a short description. A body and footers may follow, each after one blank line.',
        'The type says what kind of change it is: feat for a feature, fix for a bug fix, and docs, style, refactor, perf, test, build, ci, chore or revert for the rest. Tools such as changelog generators and release bots read the type to choose the next version.',
        'A breaking change is marked with an exclamation mark after the type or scope, and may be explained in a BREAKING CHANGE footer. Other footers look like Refs: #123 or Closes #7.',
      ],
      title: 'What is a Conventional Commit?',
    },
    {
      content: [
        'Write commit messages that automated changelogs and release tooling can read.',
        'Check the format of a breaking change and its footer before committing.',
        'Keep a team on one style without memorizing the rules.',
        'Draft the message here, copy it, then paste it into git commit or your editor.',
      ],
      title: 'When to use Conventional Commit Builder',
    },
  ],
  examples: [
    'feat, scope parser, "add arrays" → feat(parser): add arrays.',
    'fix with no scope and breaking on → fix!: add arrays.',
    'Breaking on with the text "drops Node 18" → a final BREAKING CHANGE: drops Node 18 footer.',
    'Footers "Refs: #12" and "Closes #7" → one footer per line after a blank line.',
    'A body of two paragraphs → kept as typed, after one blank line below the header.',
    'A 70-character description with a type and scope → a header over 72 characters, shown as a warning.',
  ],
  faq: [
    {
      answer:
        'Add an exclamation mark after the type or scope, which this tool does when Breaking change is on. Adding a description also appends a BREAKING CHANGE footer that explains the change for readers and release tools.',
      question: 'How do I mark a breaking change?',
    },
    {
      answer:
        'The scope is optional and names the part of the code the change touches, such as parser or api. It may contain letters, digits and . _ / , - only, so spaces are not allowed. Leave it empty to omit the parentheses.',
      question: 'What is the scope for?',
    },
    {
      answer:
        'Each footer line must be a token followed by ": " or " #" and a value, such as Refs: #123 or Closes #7. The token uses letters, digits and hyphens, or is BREAKING CHANGE. Blank lines between footers are ignored. Multi-line footer values are not supported.',
      question: 'What format do footers need?',
    },
    {
      answer:
        'No. A header over 72 characters is shown as a warning in the summary, but the message is still built. Many projects keep headers short so they read well in git log and on code hosting sites.',
      question: 'Is a long header an error?',
    },
    {
      answer:
        'The type is limited to the eleven types from the common Angular-style set. Conventional Commits itself allows other types, but these cover most projects and keep the choice simple.',
      question: 'Can I use a custom type?',
    },
  ],
  help: 'Choose a type, add an optional scope and write a short description in the imperative mood, such as "add array support". The header updates as you type.\n\nTurn on Breaking change to add an exclamation mark to the header. Fill in the breaking change description to also add a BREAKING CHANGE footer after your other footers.\n\nThe body is kept as typed and placed after one blank line, with trailing blank lines removed. Enter footers one per line, for example Refs: #123 or Reviewed-by: Ada. Each line must be a token and a value separated by ": " or " #", and multi-line footer values are not supported.\n\nCopy the message or save it as COMMIT_EDITMSG. The summary shows the header length and warns when it passes 72 characters. Everything is built on your device.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: description one line; scope 1-50 characters; 100 footer lines.',
    'The type is one of feat, fix, docs, style, refactor, perf, test, build, ci, chore and revert.',
    'A header over 72 characters is a warning, not an error.',
    'The message ends with one line break, and CRLF line breaks in the body and footers become LF.',
  ],
};
