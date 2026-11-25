import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Transfer time, size and rate are tied together: time = size / rate. Link speeds are quoted in bits per second (Mbit/s, Gbit/s) while files are measured in bytes, so a 100 Mbit/s line moves at most 12.5 MB each second.\n\nReal transfers never reach the nominal rate. Protocol headers, retransmissions and encryption take a share, which this tool models as a protocol overhead percentage that lowers the effective rate.\n\nPick what to solve for and fill in the other two quantities. Decimal units (kB, MB, GB) use steps of 1000 and binary units (KiB, MiB, GiB) steps of 1024.',
      title: 'How transfer time is calculated',
    },
    {
      content: [
        'Estimate how long a backup, image pull or upload takes on a given connection.',
        'Find how much data a link can carry in a maintenance window.',
        'Work out the line rate needed to move a data set within a deadline.',
        'Compare a bits-per-second plan with a bytes-per-second download speed.',
      ],
      title: 'When to use Bandwidth & Transfer Time Calculator',
    },
  ],
  examples: [
    '1 GB at 100 Mbit/s → 1 min 20 s.',
    '1 GB at 100 Mbit/s with 10 % overhead → 1 min 28 s 889 ms.',
    '500 GiB at 1 Gbit/s → about 1 h 11 min 35 s.',
    '100 Mbit/s for 80 s → 1 GB.',
    '1 GiB in 1 min → about 17.9 MB/s.',
    '20 MB at 512 kbit/s → 5 min 12 s 500 ms.',
  ],
  faq: [
    {
      answer:
        'Providers quote speeds in bits per second, while files and download managers use bytes. One byte is eight bits, so 100 Mbit/s equals 12.5 MB/s at best.',
      question: 'Why is my download slower than my line speed?',
    },
    {
      answer:
        'It is the share of the nominal rate lost to headers, acknowledgements and retries. TCP over Ethernet often loses about 5 to 10 percent. The effective rate is shown below the result.',
      question: 'What is protocol overhead?',
    },
    {
      answer:
        'Decimal units such as MB and GB step by 1000, binary units such as MiB and GiB step by 1024. Operating systems and tools differ, so choose the unit your source uses.',
      question: 'What is the difference between MB and MiB?',
    },
    {
      answer:
        'No. Only the two quantities you are not solving for are used, and the unused fields are hidden. Switch the Solve for choice to change which one is calculated.',
      question: 'Do I need to fill in all fields?',
    },
  ],
  help: 'Choose whether to solve for time, size or rate.\n\nEnter the other two quantities with their units. Fields for the solved quantity are hidden.\n\nSet the protocol overhead from 0 to 99 percent if the line is not fully used.\n\nThe result updates automatically and lists the value in every unit; copy or save bandwidth.txt. Use Unit Converter for other conversions and Duration Converter for time formats.',
  notes: [
    'Each number is limited to 128 characters.',
    'Size, rate and time must be finite numbers above zero.',
    'Protocol overhead must be within 0-99 percent; the default is 0.',
    'Overhead lowers the effective rate: effective = nominal x (1 - overhead / 100).',
    'Decimal units step by 1000, binary units (KiB, MiB, GiB, TiB) by 1024, and one byte is eight bits.',
    'Time is rounded to milliseconds for the readable form; other values are doubles with up to 15 significant digits.',
    'Everything is calculated locally and the result is an estimate, not a measurement.',
  ],
};
