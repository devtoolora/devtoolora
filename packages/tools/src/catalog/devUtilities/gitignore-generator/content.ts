import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A .gitignore lists patterns for files Git should leave untracked, such as dependencies, build output, logs and local secrets. It does not remove files from disk or stop tracking files that are already committed.',
        'Choose bundled starter templates for languages, frameworks, operating systems, editors and DevOps tools, optionally exclude exact generated lines, then append project-specific rules.',
      ],
      title: 'What is a .gitignore?',
    },
    {
      content: [
        'Start a new repository with ignore rules for your stack, OS and editor without fetching templates from the internet.',
        'Combine several templates into one file with a heading per template and no repeated lines.',
        'Keep one file inside an ignored folder, or drop a template rule for something your project needs to commit.',
      ],
      title: 'When to generate a .gitignore',
    },
  ],
  examples: [
    'Languages Node.js → # Node.js, then node_modules/, npm-debug.log*, yarn-debug.log*, yarn-error.log*, pnpm-debug.log*, .env and .env.*.local.',
    'Operating systems Linux + Editors Vim → # Linux with *~, .fuse_hidden*, .directory and .Trash-*, then # Vim with *.swp, *.swo and *.swn; the repeated *~ is written once.',
    'React / Vite, Exclude generated rules dist/, Custom rules dist/* and !dist/keep.txt → # React / Vite with .vite/ and *.local, then # Custom rules with dist/* and !dist/keep.txt.',
    'Node.js, Exclude generated rules .env, Custom rules .env and !sample.env → .env leaves the Node.js section but stays under # Custom rules, followed by !sample.env.',
    'Custom rules *.log, !keep.log, *.log → all three lines in that order, because a later pattern can override an earlier negation.',
    'Nothing selected → # Select one or more templates or add custom rules.',
  ],
  faq: [
    {
      answer:
        '.gitignore only affects untracked files. Stop tracking a committed file with git rm --cached <file> and commit; the file stays on disk and the ignore rule keeps it out from then on.',
      question: 'Why is a file still tracked after I add it to .gitignore?',
    },
    {
      answer:
        'Ignore the folder’s contents rather than the folder, then re-include the file: dist/* followed by !dist/keep.txt. If dist/ itself is ignored, Git never looks inside it, so a negation cannot bring the file back.',
      question: 'How do I ignore a folder but keep one file inside it?',
    },
    {
      answer:
        'No. Every template is bundled with the tool and the file is built locally, so it works offline and nothing about your project is sent anywhere.',
      question: 'Does the generator download templates from GitHub?',
    },
    {
      answer:
        'Yes. Git reads patterns from top to bottom and the last match wins, so !keep.log only works after *.log. Custom rules keep the order you type them and come after the template sections.',
      question: 'Does the order of rules in a .gitignore matter?',
    },
    {
      answer:
        'The VS Code template ignores .vscode/* but re-includes extensions.json, tasks.json, launch.json and settings.json, so shared editor settings can be committed while other local files stay out.',
      question: 'Should I commit the .vscode folder?',
    },
  ],
  help: 'Tick templates under Languages, Frameworks, Operating systems, Editors and DevOps, or pick a sample from Apply sample.\n\nEnter template lines to leave out in Exclude generated rules, one exact line per row, such as dist/.\n\nAdd project patterns, comments and ! negations in Custom rules; they are appended under # Custom rules in the order you type them.\n\nCopy the result or save .gitignore, and download gitignore-report.json to review the selected templates, exclusions and counts.',
  notes: [
    'Templates are bundled starter lists, not exhaustive recommendations. Sections follow the order of the template lists, not the order you tick them.',
    'A template line that already appeared in an earlier selected template is skipped, unless a ! negation came in between. Custom lines, comments and blank lines are preserved in order, including duplicates and escaped trailing spaces.',
    'Exclusions compare exact generated lines. They do not match globs or filenames and never remove custom rules.',
    'Output uses LF line endings with a trailing newline. Input is limited to 10,000 lines and 100,000 characters, and lines cannot contain NUL characters.',
  ],
};
