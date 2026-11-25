import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Unix-style mode bits describe read, write and execute/search permissions for the file owner, group and others. Each permission digit combines read = 4, write = 2 and execute/search = 1.',
        'An optional leading digit contains set-user-ID = 4, set-group-ID = 2 and sticky = 1. This calculator decodes that supplied bitmask; it does not inspect a file or predict every effect of applying a chmod command.',
        'Symbolic s or t means a special bit and the corresponding execute bit are set. Uppercase S or T means the special bit is set but that execute bit is not.',
      ],
      title: 'What are chmod permission bits?',
    },
    {
      content: [
        'Understand an octal mode found in a configuration or deployment script.',
        'Inspect permissions separately for owner, group and others.',
        'Distinguish ordinary execute bits from special-bit notation such as rws or rwS.',
        'Export an exact permission-bit audit before reviewing a change in your own environment.',
      ],
      title: 'When to use chmod Calculator',
    },
  ],
  examples: [
    '755 → rwxr-xr-x: owner has rwx; group and others have r-x.',
    '644 → rw-r--r--: owner has rw-; group and others have r--.',
    '000 and 0 → ---------: no ordinary permission bits are set.',
    '4755 → rwsr-xr-x: setuid and owner execute are set.',
    '4644 → rwSr--r--: setuid is set, but owner execute is not.',
    '1777 → rwxrwxrwt; 1666 → rw-rw-rwT. Lowercase t includes others execute, uppercase T does not.',
  ],
  faq: [
    {
      answer:
        '755 gives the owner read, write and execute (rwx) and gives the group and everyone else read and execute (r-x), written rwxr-xr-x. It suits scripts, programs and directories that others may open but not change.',
      question: 'What does chmod 755 mean?',
    },
    {
      answer:
        'Both let only the owner write. 644 (rw-r--r--) has no execute bits, which suits ordinary files, while 755 (rwxr-xr-x) adds execute, which programs need to run and directories need to be entered.',
      question: 'What is the difference between 644 and 755?',
    },
    {
      answer:
        'An optional fourth digit in front holds the special bits: 4 is setuid, 2 is setgid and 1 is sticky. 1777 is the classic /tmp mode, where everyone can create files but only a file’s owner, the directory owner or root can delete them.',
      question: 'What does the first digit in 4755 or 1777 mean?',
    },
    {
      answer:
        'No. Enter octal digits for a mode from 0000 to 7777, such as 755 or 04755. Symbolic forms like u+x, rwx strings, 0o prefixes and whole chmod commands are rejected with an error.',
      question: 'Can I enter symbolic modes like u+x or rwxr-xr-x?',
    },
    {
      answer:
        'No. It only decodes the number you type: it never runs chmod, reads a file or contacts a server. Apply the mode yourself after reviewing the result.',
      question: 'Does this change permissions on my files?',
    },
  ],
  help: 'Paste one octal mode or select a sample. Input accepts mode bits 0000–7777 with optional extra leading zeroes; missing leading digits are zero. Surrounding ASCII whitespace is removed. No shell command is executed.\n\nPermission table shows owner, group and others, with readable Yes/No flags for read/write/execute, special-bit name and symbolic triplet. For directories, execute means search/traversal. The summary shows the complete nine-character form.\n\nSwitch to JSON audit for exact grouped booleans, all special bits, canonical octal and full four-digit octal. Copy/save always exports this audit, not a table screenshot or a chmod command.\n\nSave chmod-report.json or open it in an editor. Changing input or output clears old exports. Review file type, ownership, ACLs, filesystem and OS behavior separately before applying any mode.',
  notes: [
    'Digits are interpreted as octal, not decimal. Accepts bitmasks 0000–7777 with optional extra leading zeroes; symbolic u+x notation, ls file-type bits, 0o prefixes and whole shell commands are rejected.',
    'Input is limited to 64 UTF-16 units before trimming. Extra leading zeroes such as 00755 are retained in originalInput but normalized to the same bitmask as 0755. GNU directory/operator-specific command semantics are not simulated.',
    'A three-digit 755 is decoded as bitmask 0755. The report retains the original input, canonical octal and all four digits, including zero special bits.',
    'The ordinary permission groups remain separate from special flags. S and T do not imply execute permission; the table shows No and the audit execute: false explicitly.',
    'For regular files, x denotes execution; for directories, it denotes search/traversal. Directory read/write have listing and entry-modification meanings, not identical file-data meanings.',
    'setuid/setgid/sticky effects depend on file type and operating-system rules. Special bits can be ignored, retained or cleared by the filesystem, command or security policy; this is a bit decoder, not a runtime access check.',
    'In particular, GNU chmod can preserve directory setuid/setgid bits in some numeric-mode cases, while explicit leading-zero forms can behave differently. The decoded zero special bits are not a guarantee of the resulting mode on an existing directory.',
    'The calculator does not inspect ownership, ACLs, umask, mount options, capabilities or symlink behavior and does not diagnose effective access.',
    'No mode is recommended as universally safe. Broad write permissions and special bits require review. The tool never executes chmod, writes a mode to a file or changes your editor source with the report.',
  ],
};
