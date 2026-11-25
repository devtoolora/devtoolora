import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A 48-bit MAC address identifies an interface at the link layer. Its six bytes are often displayed as colon-separated hexadecimal pairs.\n\nThis generator sets the local-administration bit and clears the multicast bit in the first byte. The other 46 bits come from secure runtime randomness.\n\nThe output is a candidate address, not a vendor-assigned identity or a change to your device. Generation does not inspect or configure an interface.',
      title: 'What is a locally administered MAC address?',
    },
    {
      content: [
        'Create fixtures for MAC-address parsers and configuration forms.',
        'Prepare virtual-interface candidates after checking the target network for conflicts.',
        'Compare colon, hyphen, dotted and plain representations of a 48-bit address.',
      ],
      title: 'When to generate MAC addresses',
    },
  ],
  examples: [
    '02:34:56:78:9a:bc is a local unicast example, not a vendor OUI.',
    'Hyphen style: 02-34-56-78-9a-bc.',
    'Dotted style: 0234.5678.9abc.',
    'Plain style: 023456789abc.',
    'The first octet’s last digit is 2, 6, a or e because local/unicast bits are fixed.',
    'Count 5 produces five newline-separated candidates; every explicit run draws fresh bytes.',
  ],
  faq: [
    {
      answer:
        'It is an address with the local-administration bit set in the first byte, marking it as assigned by you rather than a manufacturer. With the multicast bit cleared, the first byte’s second hex digit is always 2, 6, a or e.',
      question: 'What is a locally administered MAC address?',
    },
    {
      answer:
        'Yes. 46 of the 48 bits come from crypto.getRandomValues; only the local and unicast bits are fixed. There is no seed, so every run produces new addresses.',
      question: 'Are the generated MAC addresses random?',
    },
    {
      answer:
        'It is unlikely but possible. Nothing checks the batch, a registry or your network for duplicates, so check for conflicts before assigning an address.',
      question: 'Can two generated addresses be the same?',
    },
    {
      answer:
        'No. The tool only prints candidate addresses. Set an address through your operating system, hypervisor or container settings.',
      question: 'Will this change my device’s MAC address?',
    },
    {
      answer:
        'Colon (02:34:56:78:9a:bc), Hyphen (02-34-56-78-9a-bc), Dotted (0234.5678.9abc) and Plain (023456789abc), all in lowercase hexadecimal.',
      question: 'Which MAC address formats are available?',
    },
  ],
  help: 'Choose a count from 1–100 and the representation expected by your application, or apply a sample.\n\nRun explicitly to generate a batch. Changing options does not silently replace a previously generated set.\n\nReview the candidates and keep a chosen address stable if assigned. Regeneration does not update an interface using an older address.\n\nCopy or save mac-addresses.txt. Check conflicts and follow the device’s configuration procedure separately.',
  notes: [
    'Addresses are lowercase, 48-bit, locally administered and unicast. EUI-64 and multicast generation are not supported.',
    'Local administration means leading bytes must not be treated as an assigned manufacturer OUI.',
    'Collisions are unlikely, not impossible. No registry or network is checked; uniqueness is not guaranteed.',
    'Secure crypto.getRandomValues is required. Without it, generation fails instead of falling back to Math.random.',
    'Count must be an integer from 1–100. Text input and deterministic seeds are not used.',
    'Formats change separators, not semantics. New runs generate new values; samples specify settings rather than fixed addresses.',
    'Generation does not change your MAC address, promise anonymity or bypass network access rules.',
  ],
};
