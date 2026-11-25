import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'SPF, DKIM and DMARC are three DNS TXT records that let a receiving server decide whether mail claiming to come from your domain is genuine. SPF lists the servers allowed to send, DKIM publishes the public key that verifies a message signature, and DMARC tells receivers what to do when both checks fail and where to send reports.',
        'Parse mode takes a pasted record, a quoted TXT value or a whole zone-file or dig line, detects which of the three it is and explains every term or tag in one sentence. A findings list ranks the problems: a +all, more than 10 DNS lookups, a revoked or weak DKIM key, p=none or a missing report address.',
        'The three build modes write the record for you. SPF is assembled from include domains, IPv4 and IPv6 ranges, a and mx, and either a redirect or the all qualifier (all would make a redirect dead, so a redirect replaces it); DMARC from policy, reports, percentage and alignment; DKIM from a selector, a domain and a public key, with the host name and a zone-file form split into 255-character strings.',
      ],
      title: 'What are SPF, DKIM and DMARC records?',
    },
    {
      content: [
        'Check an existing record before you publish it, or paste what a domain currently serves to see why mail is failing or landing in spam.',
        'Build a first DMARC record in monitoring mode, read the aggregate reports, and tighten the policy from none to quarantine to reject in steps.',
        'Turn the public key your mail provider gave you into the exact TXT value and host name for your DNS panel. Use Email Header Analyzer to see the results of these checks on a real message.',
      ],
      title: 'When to use SPF, DKIM & DMARC Record Builder & Parser',
    },
  ],
  examples: [
    'v=spf1 include:_spf.google.com ip4:203.0.113.0/24 mx -all → four terms, two DNS lookups, no findings.',
    'v=spf1 +all → high finding: every sender on the internet is authorized.',
    '_dmarc.example.com. 3600 IN TXT "v=DMARC1; " "p=reject" → the quoted strings are joined and parsed as DMARC.',
    'v=DMARC1; p=none → medium findings for monitoring only and for no rua address.',
    'v=DKIM1; k=rsa; p= (empty) → high finding: the key is revoked.',
    'Build DKIM with selector sel1, domain example.com and a PEM key → host sel1._domainkey.example.com and the record split for a zone file.',
  ],
  faq: [
    {
      answer:
        'SPF allows at most 10 DNS lookups while evaluating a record. Each include, a, mx, ptr, exists and redirect term counts as one, and includes can nest more. Past 10 the receiver returns permerror and SPF fails.',
      question: 'Why does the SPF lookup count matter?',
    },
    {
      answer:
        'It tells receivers to only monitor: failing mail is still delivered. That is the right start while you collect reports, but the policy gives no protection until you move to quarantine or reject.',
      question: 'Why is p=none only a medium finding?',
    },
    {
      answer:
        'A 1,024-bit RSA key can be broken with enough computing power and is flagged below 2,048 bits. Most providers now issue 2,048-bit keys; ask for a new selector and key if yours is shorter.',
      question: 'What key size should DKIM use?',
    },
    {
      answer:
        'No. The tool never queries DNS, so it cannot flatten includes or confirm that a published record matches. It explains the text you give it, and the lookup count is the number of terms in that one record.',
      question: 'Does it check the live DNS records?',
    },
  ],
  help: 'Choose Parse to explain a pasted record, or one of the Build modes to write a record.\n\nIn Parse mode paste the TXT value, a quoted value or a zone-file line; the type is detected from v=spf1, v=DMARC1 or v=DKIM1.\n\nIn the Build modes fill in the fields; SPF and DMARC list addresses one per line, and DKIM takes the public key as an SPKI PEM block or bare base64 in the input.\n\nCopy the record, or download the result with its findings.',
  notes: [
    'A record is at most 4,096 characters before unquoting, and a DKIM public key is at most 16,384 characters. DMARC report addresses must be email addresses separated by spaces, commas or semicolons.',
    'SPF supports the mechanisms all, include, a, mx, ptr, ip4, ip6 and exists and the modifiers redirect and exp; an unknown mechanism is a high finding, because receivers return permerror for the whole record, and an unknown modifier is a low one, because they ignore it.',
    'The SPF lookup count adds include, a, mx, ptr, exists and redirect terms; a record over 10 is a high finding.',
    'DMARC build writes v, p, sp, rua, ruf, pct, adkim, aspf and fo in that order, and leaves out values equal to the defaults (pct=100, adkim=r, aspf=r, fo=0).',
    'DKIM key size is read from the SPKI structure of the key; Ed25519 keys are the raw 32 bytes and count as 256 bits.',
    'A zone-file or dig line is accepted: text before TXT is dropped and adjacent quoted strings are joined.',
    'No DNS lookup is made, includes are not flattened and DKIM signatures are not verified; no key is ever generated.',
  ],
};
