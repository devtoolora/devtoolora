import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'An .editorconfig file tells editors and IDEs how to indent and save the files in a project, so everyone on the team gets the same tabs, line endings and charset no matter which editor they use. Most editors read it natively or through a small plugin.',
        'The file is a list of sections. Each section starts with a glob such as [*] or [*.py] and sets properties for the files that match. When several sections match, the later one wins, which is why the language sections come after [*]. A line root = true at the top stops editors from looking for more .editorconfig files in parent folders.',
        'This tool writes only properties from the EditorConfig specification: indent_style, indent_size, end_of_line, charset, trim_trailing_whitespace and insert_final_newline. Any of them can be left unset.',
      ],
      title: 'What is an .editorconfig file?',
    },
    {
      content: [
        'Add one to a new repository so contributors do not fight over tabs and spaces.',
        'Pin LF line endings on a team that mixes macOS, Linux and Windows.',
        'Give Makefiles and Go files tabs while the rest of the project uses spaces.',
        'Keep trailing whitespace in Markdown, where two spaces at the end of a line mean a line break.',
      ],
      title: 'When to use .editorconfig Generator',
    },
  ],
  examples: [
    'Defaults → root = true and a [*] section with 2 spaces, LF, UTF-8, trimmed whitespace and a final newline.',
    'Indent size blank → no indent_size line, so the editor uses its own setting.',
    'Markdown section → [*.md] with trim_trailing_whitespace = false.',
    'Python section → [*.py] with 4 spaces.',
    'Windows scripts section → [*.{bat,cmd,ps1}] with end_of_line = crlf.',
    'Every setting Not set and no sections → an error, because the file would be empty.',
  ],
  faq: [
    {
      answer:
        'Put it in the root of the repository and keep root = true. Editors look for .editorconfig in the folder of the file and every parent folder, and stop at the first one marked root.',
      question: 'Where does the file go?',
    },
    {
      answer:
        'Yes, in a section for those files. A later matching section overrides the earlier one, so the [*.md] section can keep trailing whitespace while [*] trims it everywhere else.',
      question: 'Can sections override [*]?',
    },
    {
      answer:
        'Not set leaves the property out of the file. The editor then falls back to its own setting or to an .editorconfig further up the folder tree. Use it when you do not want to enforce a value.',
      question: 'What does Not set do?',
    },
    {
      answer:
        'This tool only writes properties from the EditorConfig specification, and max_line_length is not one of the properties it covers. Add it by hand if your editor plugin supports it.',
      question: 'Why is there no max_line_length?',
    },
    {
      answer:
        'It does not change the files. It only describes the style. Use a formatter such as Prettier, or the Line Ending and Whitespace Cleaner tools, to rewrite files that already break the rules.',
      question: 'Does it reformat my existing files?',
    },
  ],
  help: 'Pick the settings for the [*] section: indent style, indent size, end of line, charset, trim trailing whitespace and insert final newline. Each can be Not set. Leave the indent size blank to leave it out, or enter a whole number from 1 to 16.\n\nTick root = true to stop editors from searching parent folders. Tick language sections to add Markdown (keep trailing whitespace), Makefile and Go (tabs), Python (4 spaces), YAML (2 spaces) and Windows scripts (CRLF). The sections are always written in the same order.\n\nCopy the text or save it as .editorconfig in the root of your project. The summary counts the sections and properties, not the root line.\n\nIf every setting is Not set and no section is ticked, there is nothing to write and the tool reports an error.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: indent size 1-16.',
    'Only properties from the EditorConfig specification are written; there is no max_line_length.',
    'The language sections are fixed presets; their values cannot be edited here.',
  ],
};
