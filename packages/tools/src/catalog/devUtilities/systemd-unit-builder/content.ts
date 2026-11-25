import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A systemd service unit is a small text file that tells Linux how to start, stop and restart a program in the background. Put it in /etc/systemd/system for the whole machine, or in ~/.config/systemd/user for one user, and systemd keeps the program running across crashes and reboots.',
        'The file has three sections. [Unit] describes the service and its order relative to others, [Service] says what to run and how to restart it, and [Install] says which target pulls it in at boot. This tool writes exactly those three sections for a single service, in a fixed order.',
        'Values are checked and quoted for you. Each Environment= line is written in quotes with backslashes, quotes and percent signs escaped, so a value cannot break out of its line.',
      ],
      title: 'What is a systemd service unit?',
    },
    {
      content: [
        'Run a Node, Python or Go program as a service that restarts after a failure.',
        'Start a script once at boot with Type=oneshot.',
        'Run a development server for your own user without root, using the user scope.',
        'Give a service its own user, a working directory and an environment file instead of editing a unit by hand.',
      ],
      title: 'When to use systemd Service Unit Builder',
    },
  ],
  examples: [
    'Defaults plus /usr/bin/node /srv/myapp/server.js → myapp.service with Restart=on-failure and RestartSec=5.',
    'Scope User → WantedBy=default.target, and the User, Group, hardening and network lines are left out.',
    'Restart No → the Restart=no line is written and RestartSec is left out.',
    'Environment GREETING=say "hi" 100% → Environment="GREETING=say \\"hi\\" 100%%".',
    'EnvironmentFile -/etc/myapp.env → the leading - makes the file optional.',
    'ExecStart /usr/bin/a | b → written as typed, with a warning that systemd does not run a shell.',
  ],
  faq: [
    {
      answer:
        'systemd starts the program directly, not through a shell. Pipes, redirects and && do nothing there. Wrap the command as /bin/sh -c and quote the whole script to get shell behavior.',
      question: 'Why does ExecStart warn about pipes?',
    },
    {
      answer:
        'Save the file as /etc/systemd/system/NAME.service, run systemctl daemon-reload, then systemctl enable --now NAME. For the user scope put it in ~/.config/systemd/user and add --user to each command.',
      question: 'How do I install the unit?',
    },
    {
      answer:
        'systemd expands specifiers such as %i and %h in most values. This tool writes every percent sign as %% so the text stays literal. Template units with @ are not supported.',
      question: 'Why are percent signs doubled?',
    },
    {
      answer:
        'In ExecStart, $VAR and ${VAR} are expanded by systemd from the unit environment, and $$ gives a literal dollar sign. Inside Environment= lines the dollar sign is always literal.',
      question: 'How do dollar signs behave?',
    },
    {
      answer:
        'Environment values are often secrets, so that field is not saved in drafts. For real secrets prefer an EnvironmentFile with restricted permissions over values in the unit file.',
      question: 'Is the Environment field saved?',
    },
  ],
  help: 'Enter a unit name without .service, a description and the ExecStart command. ExecStart must start with an absolute path such as /usr/bin/node. systemd can also search a fixed list of directories for a bare name, but this tool asks for the full path so the program that runs is never in doubt. Optional prefixes such as - or @ are accepted, each at most once, plus one of +, ! or !!. In ExecStart, $VAR is expanded by systemd and $$ gives a literal dollar sign; Environment values keep every dollar sign literal.\n\nChoose the scope. A system unit can set User and Group and gets the hardening lines NoNewPrivileges, PrivateTmp and ProtectSystem. A user unit ignores those fields and Wait for network, because user managers have no network-online.target. Pick the Type and the Restart policy; RestartSec is hidden when Restart is no. Type oneshot cannot use Restart always, because systemd refuses to load that unit.\n\nAdd environment variables one per line as KEY=value, at most 100. Duplicate keys are an error. EnvironmentFile takes an absolute path, with a leading - when the file may be missing.\n\nCopy the text or save it as NAME.service. The summary shows the file name, the scope, the variable count and any warning about shell operators in ExecStart.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 100 environment variables, 4,096 characters per value, 200 characters for the name and description.',
    'Every value must be one line and must not end in a backslash.',
    'Specifiers such as %i and %h are not expanded; a percent sign is written as %%.',
    'Install with systemctl daemon-reload and systemctl enable --now NAME; add --user for the user scope.',
    'Timers, sockets, template units and editing an existing unit file are not supported.',
  ],
};
