import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A LICENSE file tells other people what they may do with your code. Without one, the code is protected by copyright by default and nobody else has the right to use, copy or change it.',
        'MIT, BSD and ISC are short permissive licenses: use the code however you like, but keep the copyright notice. Apache 2.0 is permissive too and adds an explicit patent grant. MPL 2.0 and GPL 3.0 are copyleft licenses that require changes to be shared under the same terms, MPL per file and GPL for the whole work. The Unlicense dedicates the code to the public domain.',
        'The texts come from choosealicense.com, the same source GitHub uses for its license picker, pinned to one commit so the output never changes silently.',
      ],
      title: 'What is a software license?',
    },
    {
      content: [
        'Add a LICENSE file to a new repository before you publish it.',
        'Compare the common licenses by reading their exact text.',
        'Fill in the year and name for MIT, BSD and ISC without editing the text by hand.',
        'Save the result as LICENSE and commit it to the root of your project.',
      ],
      title: 'When to use License Generator',
    },
  ],
  examples: [
    'MIT, holder "Ada Lovelace", year 2026 → a header line "Copyright (c) 2026 Ada Lovelace".',
    'ISC with a blank year → the current year is filled in.',
    'BSD 3-Clause with holder "The Example Authors" → the name appears in the copyright line and the conditions.',
    'Apache 2.0 → the full text, with the appendix placeholders left as they are.',
    'GPL 3.0 → the full text of Version 3, 29 June 2007.',
    'Unlicense → the public domain dedication, with no name or year.',
  ],
  faq: [
    {
      answer:
        'Only MIT, BSD 2-Clause, BSD 3-Clause and ISC have a copyright line with a year and a name. Apache 2.0, MPL 2.0, GPL 3.0 and the Unlicense are used as published, so the holder and year are ignored.',
      question: 'Why do some licenses ignore the holder?',
    },
    {
      answer:
        'The Apache 2.0 appendix and the GPL "How to apply" section show a notice for the header of each source file. They are part of the published text, so they stay as they are. They do not belong in a LICENSE file.',
      question: 'Why are some placeholders still in the text?',
    },
    {
      answer:
        'Use the year the work was first published, or a range such as 2020-2026 if you add it by hand afterwards. This tool accepts one four-digit year, and a blank field uses the current year in UTC.',
      question: 'Which year should I use?',
    },
    {
      answer:
        'No. This is a convenience for copying standard license text, not legal advice. Read the license you choose, and ask a lawyer if you have employer, contributor or dependency questions.',
      question: 'Is this legal advice?',
    },
    {
      answer:
        'Save the result as LICENSE (or LICENSE.txt) in the root of your repository. GitHub and package registries detect the license from that file. Also set the license field in package.json or your manifest.',
      question: 'Where does the file go?',
    },
  ],
  help: 'Choose a license from the list. MIT, BSD 2-Clause, BSD 3-Clause and ISC also show a Copyright holder field, which is required for those four.\n\nThe year is filled in as four digits. Leave it blank to use the current year. The holder must be one line of at most 200 characters.\n\nOnly the [year] and [fullname] placeholders are replaced. The Apache 2.0 and GPL 3.0 texts keep their appendix placeholders, because those belong in source file headers and not in a LICENSE file.\n\nCopy the text or save it as LICENSE. The summary shows the license name and, where it applies, the year and holder. Everything is generated on your device.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: holder 200 characters; year 4 digits.',
    'The texts are from github/choosealicense.com at a pinned commit and are not changed.',
    'Only [year] and [fullname] are replaced; the other licenses are output as published.',
    'This is not legal advice, and it does not check license compatibility.',
  ],
};
