import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'When a process dies, a script fails or a log line says "exit status 137", the number is all you have. It can be a shell convention, a value chosen by the program, a Linux errno or 128 plus a signal number, and the meaning depends on which of those it is.',
        'This tool looks a code or name up in four built-in tables: shell exit codes, the sysexits.h codes 64 to 78, the 31 standard Linux signals and the Linux errno values. A number is matched in every table it appears in; a name such as ENOENT, SIGTERM or EX_USAGE finds its row directly.',
        'Exit codes 129 to 159 are shown as "killed by signal N", and any other code up to 255 is described as program-defined. Everything runs locally in your browser.',
      ],
      title: 'What is Exit Code & errno Reference?',
    },
    {
      content: [
        'Decode an exit status from CI, a container or a crashed service.',
        'Find the number behind an errno name from a stack trace or strace output.',
        'Check which signal a process received and what its default action is.',
      ],
      title: 'When to use Exit Code & errno Reference',
    },
  ],
  examples: [
    '2 returns the shell code "Misuse of shell builtins", signal 2 SIGINT and errno 2 ENOENT.',
    '130 returns "Interrupted by Ctrl-C (SIGINT)", "Killed by signal 2 (SIGINT)" and errno 130 EOWNERDEAD.',
    '137 with the Exit codes table shows "Killed by signal 9 (SIGKILL)".',
    'ENOENT returns errno 2, "No such file or directory".',
    'term, sigterm and SIGTERM all find signal 15; usage finds EX_USAGE.',
    'An empty query with the Signals table lists all 31 signals with their default actions.',
  ],
  faq: [
    {
      answer:
        'When a process is killed by a signal, shells report 128 plus the signal number. 137 is 128 + 9 (SIGKILL), often the out-of-memory killer; 143 is SIGTERM.',
      question: 'Why is an exit code above 128 a signal?',
    },
    {
      answer:
        'Only 0 means success by convention. Programs are free to choose other values, so codes outside the shell and sysexits lists are shown as program-defined.',
      question: 'What does a code like 42 mean?',
    },
    {
      answer:
        'Yes. EWOULDBLOCK finds EAGAIN, EDEADLOCK finds EDEADLK and ENOTSUP finds EOPNOTSUPP, because they share a number on Linux.',
      question: 'Are errno aliases supported?',
    },
    {
      answer:
        'The numbers are for Linux on x86-64. macOS and the BSDs number many errno values above 34 differently, so do not use this table for them.',
      question: 'Does it work for macOS errno values?',
    },
  ],
  help: 'Type an exit code, an errno or signal name, or leave the input empty to list a table.\n\nChoose All to search every table, or limit the lookup to errno, Signals or Exit codes (shell codes and sysexits).\n\nA number matches every table it appears in. Names are matched exactly, ignoring case, and SIG and EX_ may be left out.\n\nCopy or save the result as text. The table view shows the same rows.',
  notes: [
    'The tables follow Linux on x86-64 (asm-generic errno 1 to 133 without 41 and 58, which Linux never assigns, and signal(7) numbers 1 to 31).',
    'macOS and BSD errno numbers above 34 differ from Linux; the signal numbers also differ for some signals.',
    'The query is limited to 64 characters. No network requests are made.',
    'Names are matched exactly (case-insensitive), not as substrings; SIG and EX_ prefixes are optional.',
    'Exit codes 129 to 159 are described as 128 plus a signal number; other codes up to 255 not in a table are program-defined.',
    'Codes above 255 are not valid exit statuses and only match errno values.',
    'Real-time signals (32 and above) are not listed.',
  ],
};
