import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A port number tells the operating system which program on a host should receive a connection or datagram. IANA keeps the public registry that maps port numbers and transport protocols (TCP, UDP, SCTP, DCCP) to service names such as ssh on 22 or https on 443.\n\nThe registry splits ports into three ranges: System Ports 0-1023, User Ports 1024-49151 and Dynamic Ports 49152-65535. System Ports are assigned by IANA; most software also uses unregistered ports by convention, such as 5173 for Vite or 6443 for the Kubernetes API server.\n\nThis tool searches a bundled table, so it works offline. A query is a port number, a range such as 20-23, or text matched against service names and descriptions.',
      title: 'What is a port reference?',
    },
    {
      content: [
        'Find out which service a port in a firewall rule, log line or netstat output belongs to.',
        'Look up the default port of a database, broker or protocol before opening it in a security group.',
        'Spot well-known ports when reviewing an nmap or ss listing.',
        'Check whether a port you picked for a local server collides with a registered service.',
      ],
      title: 'When to look up ports',
    },
  ],
  examples: [
    '22 → ssh: The Secure Shell (SSH) Protocol, on TCP, UDP and SCTP.',
    '5432 → postgresql: PostgreSQL Database, on TCP and UDP.',
    '1521 → the IANA entry ncube-lm and the unofficial Oracle Database listener.',
    '6885 → the unofficial BitTorrent entry for 6881-6889.',
    '20-23 → every entry whose port falls from 20 to 23.',
    'redis → port 6379, matched by the service name.',
  ],
  faq: [
    {
      answer:
        'No. It holds every assigned System Port (0-1023) and a fixed list of widely used registered ports. Other ports are reported as not in the offline table, together with the range they belong to.',
      question: 'Does it contain the whole IANA registry?',
    },
    {
      answer:
        'Entries marked unofficial are hand-written common uses, such as Vite on 5173 or Kafka on 9092. They are conventions, not IANA assignments, so another program may legitimately use the same port.',
      question: 'What does unofficial mean?',
    },
    {
      answer:
        'The filter keeps only the chosen protocol on IANA entries, so 22 with UDP shows the ssh entry as udp. Unofficial entries are always shown because they do not name a transport protocol.',
      question: 'How does the protocol filter work?',
    },
    {
      answer:
        'The list shows the first 500 matching entries, and the summary says so. Narrow the query with a longer search text or a port range to see the rest.',
      question: 'What if a search matches too many entries?',
    },
  ],
  help: 'Type a port number such as 443, a range such as 20-23, or text such as redis or kafka. Text is matched case-insensitively against service names and descriptions.\n\nChoose Any, TCP or UDP to limit the IANA entries to one transport protocol. Unofficial entries are shown for every choice.\n\nRun the tool. Each line shows the port, its protocols, the service name and a description; the summary counts the entries found.\n\nCopy or save port-reference.txt. Use Random Port Generator to pick a free port and IPv4 Subnet Calculator to work with the addresses around it.',
  notes: [
    'The query is limited to 128 characters.',
    'At most 500 entries are listed; the summary says first 500 shown when the list is cut.',
    'The table is an offline subset of the IANA registry: all System Ports 0-1023 and a fixed list of registered ports.',
    'A port in 0-65535 without an entry is reported as not in the offline table, not as an error.',
    'A range lists every entry inside it; an unofficial range such as 6881-6889 matches any port within it.',
    'Entries marked unofficial are common conventions written by hand, not IANA assignments.',
    'This is a local lookup: no scan, DNS query or server request is performed, so it says nothing about whether a port is open.',
  ],
};
