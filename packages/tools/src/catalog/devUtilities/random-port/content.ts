import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A port number identifies a transport endpoint used by a service. This generator picks numeric candidates for configuration; it does not open, reserve or test those ports.',
        'Each generated batch contains distinct candidates. A later run may repeat a port from an earlier batch. Results stay unchanged until you run again or edit settings.',
        'IANA defines System Ports as 0–1023, User Ports as 1024–49151 and Dynamic/Private Ports as 49152–65535. This tool excludes port 0; operating-system ephemeral ranges can differ.',
      ],
      title: 'What is a random port candidate?',
    },
    {
      content: [
        'Choose candidate ports for separate local development services.',
        'Prepare distinct port values for a test configuration within your chosen range.',
        'Pick from the dynamic/private range when you do not need a fixed service assignment.',
        'Export a candidate list and its exact range for review before configuring your application.',
      ],
      title: 'When to generate port candidates',
    },
  ],
  examples: [
    'Count 5, min 3000, max 9999 → five distinct integers within the inclusive bounds, one per line; the exact values vary.',
    'Count 3, min 3000, max 3002 → 3000, 3001 and 3002 in random order, not duplicates.',
    'Count 1, min 65535, max 65535 → 65535. A one-port range has no random choice.',
    'Count 4, min 3000, max 3002 → error: Count exceeds the 3 distinct ports in the inclusive range.',
    'Count 1, min 1, max 1 → 1, with a warning that the range includes System Ports.',
    'Count 10, min 49152, max 65535 → ten candidates from IANA’s Dynamic/Private range, not a promise that the operating system leaves those ports free.',
  ],
  faq: [
    {
      answer:
        'No. It only picks numbers; it never opens, binds, scans or reserves a port. Start your service on the chosen port to confirm that it is free on that machine.',
      question: 'Does the generator check whether a port is free?',
    },
    {
      answer:
        'Ports 1024–49151 are registered User Ports and 49152–65535 are Dynamic/Private ports that no service is assigned to. Ports below 1024 often need administrator rights, and the tool warns when your range includes them.',
      question: 'Which port range should I use for local development?',
    },
    {
      answer:
        'Not within one batch: ports are drawn without replacement, so a batch of 5 holds 5 different numbers. A new run starts fresh and can repeat ports from an earlier batch.',
      question: 'Can the same port appear twice?',
    },
    {
      answer:
        'Each draw uses the Web Crypto random source with rejection sampling, so every port in the range is equally likely. There is no Math.random fallback.',
      question: 'How random are the generated ports?',
    },
    {
      answer:
        'Up to 1,000 per run, and never more than the range holds: 3000–3002 allows at most 3. Asking for more shows an error instead of returning duplicates.',
      question: 'How many ports can I generate at once?',
    },
  ],
  help: 'Set count and inclusive min/max ports or apply a complete sample. Every field requires a decimal integer; invalid or empty edited fields are rejected rather than silently rounded or clamped.\n\nRun to generate a fresh batch. The output contains one distinct candidate per line. Editing settings clears old results and exports but does not silently generate another batch.\n\nReview the range and warning. A candidate may already be used, reserved by a service, blocked by a firewall or require elevated permissions.\n\nCopy or save random-ports.txt. The additional random-ports-report.json records the same batch, range, count, uniqueness and availabilityChecked: false. Verify by actually binding the service in your target environment.',
  notes: [
    'Bounds are inclusive integers from 1 through 65,535. Count is an integer from 1 through 1,000 and cannot exceed max − min + 1.',
    'ASCII digits with surrounding whitespace are accepted. Fractions, exponent/hex notation, signs, empty edited fields and out-of-range values are rejected. No silent flooring or clamping occurs.',
    'Distinct selection uses sampling without replacement and unbiased rejection of random draws outside the usable range.',
    'Random draws use the shared Web Crypto source, without a Math.random fallback. A range with one candidate is deterministic and does not need randomness.',
    'Uniqueness applies only within one batch. Regenerating can return a previously generated candidate; no global reservation or history exists.',
    'The tool never scans, opens, binds or reserves sockets, detects occupied ports, modifies firewall rules or checks IANA service assignments.',
    'The default 3000–9999 range is for candidate generation, not a recommendation that every port there is available. System Ports below 1024 may involve permissions and established services.',
    'IANA’s Dynamic/Private range is 49152–65535. Actual operating-system ephemeral allocation and network policies can differ.',
    'TXT contains only ports separated by LF, without a trailing newline. The JSON audit records the same generation; requesting another run creates a fresh batch.',
  ],
};
