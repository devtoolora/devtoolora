import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The ssh client reads ~/.ssh/config to fill in connection settings for each host you type. A Host block gives a short alias to a server and sets its address, user, port, key and other options, so ssh prod replaces a long command line.',
        'This tool writes one Host block with the options in a fixed order and two-space indentation. Every value is checked against what ssh accepts and is quoted only when needed, so a value cannot add a line or a second option.',
        'ssh uses the first value it finds for each option, so the block belongs above any Host * defaults in the file. Patterns with * and ? apply to every matching name.',
      ],
      title: 'What is an ssh_config Host block?',
    },
    {
      content: [
        'Give a server a short alias with its user, port and key.',
        'Reach a private host through a bastion with ProxyJump.',
        'Keep long sessions alive with ServerAliveInterval.',
        'Forward a remote database to a local port with LocalForward.',
      ],
      title: 'When to use SSH Config Generator',
    },
  ],
  examples: [
    'Host prod, HostName 203.0.113.10, User deploy, Port 2222, IdentityFile ~/.ssh/id_ed25519 → five options, IdentitiesOnly yes included.',
    'IdentityFile ~/My Keys/id_ed25519 → written as IdentityFile "~/My Keys/id_ed25519".',
    'ProxyJump jump@bastion.example.com:2200,[2001:db8::1] → two hops, the second an IPv6 address.',
    'UseKeychain on → IgnoreUnknown UseKeychain above the Host line, then UseKeychain yes inside the block.',
    'LocalForward 127.0.0.1:8080 [2001:db8::5]:80 → a bind address and an IPv6 target.',
    'Host prod prod-* → one block that matches both names.',
  ],
  faq: [
    {
      answer:
        'ssh takes the first value it finds for each option while reading the file. A Host * block above yours would win, so put specific hosts first and the Host * defaults last.',
      question: 'Where do I put the block in ~/.ssh/config?',
    },
    {
      answer:
        'StrictHostKeyChecking no turns off the check that protects you from a changed or impersonated server. Use accept-new to trust a new host once and still reject a changed key.',
      question: 'Why is there no StrictHostKeyChecking no?',
    },
    {
      answer:
        'IdentitiesOnly yes makes ssh offer only the key you named instead of every key in your agent. That avoids too many authentication failures on servers that limit attempts.',
      question: 'What does IdentitiesOnly do?',
    },
    {
      answer:
        'UseKeychain is read only by Apple builds of ssh. Other versions stop with a bad configuration option for every host, unless IgnoreUnknown UseKeychain comes earlier and outside any Host block. Keep that line at the very top of ~/.ssh/config, above your first Host line.',
      question: 'Why does UseKeychain write two lines?',
    },
    {
      answer:
        'IdentityFile accepts only %d, %u, %i, %l, %h, %r and %%, because ssh expands them. A ${ is rejected since ssh would read it as an environment variable and a quote would break the value.',
      question: 'Which characters are rejected in IdentityFile?',
    },
  ],
  help: 'Enter the Host alias, or up to 10 space-separated patterns that may use * and ? and a leading ! to exclude a name. Add the HostName as a DNS name, an IPv4 address or an IPv6 address, then the User and a Port from 1 to 65,535. Leave a field empty to leave the option out.\n\nSet IdentityFile to the private key path. IdentitiesOnly appears once a path is set and is on by default. ProxyJump takes none or up to 8 comma-separated hops in the form [user@]host[:port], with IPv6 hosts in brackets.\n\nChoose ForwardAgent, AddKeysToAgent, UseKeychain and a ServerAliveInterval from 0 to 86,400 seconds, where 0 leaves the line out. StrictHostKeyChecking offers yes, accept-new and ask; no is not offered because it turns off the host key check. Add up to 10 LocalForward lines as [bind:]port host:hostport.\n\nCopy the block or save it as ssh_config, and paste it above any Host * defaults in ~/.ssh/config. With UseKeychain on, keep the IgnoreUnknown line above the first Host line of that file. The summary shows the Host patterns and how many option lines were written.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 10 Host patterns, 8 ProxyJump hops, 10 LocalForward lines and 1,024 characters for IdentityFile.',
    'Every value must be one line; IdentityFile must not end in a backslash or contain a double quote.',
    'ssh uses the first value it finds, so place the block above any Host * defaults.',
    'An IPv6 zone such as %eth0 is rejected because ssh reads % as a token.',
    'Match blocks, Include, RemoteForward, DynamicForward and editing an existing config file are not supported.',
  ],
};
