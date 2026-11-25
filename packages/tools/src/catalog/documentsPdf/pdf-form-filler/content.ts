import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Many PDF forms use AcroForm fields: text boxes, check boxes, radio groups, dropdowns and option lists, each with a name. This tool reads those fields in the browser. List mode shows them as a table and as a JSON template with the current values, ready to edit. Fill mode takes that JSON, writes the values into the fields and saves a new PDF. Nothing is uploaded.\n\nThe values object maps field names to values. Text, dropdown and radio fields take a string, a check box takes true or false, and an option list takes an array of strings. A field you leave out, or set to null, keeps its value. Unknown names, wrong types, options that are not in the list, text over the maximum length and read-only fields are errors, so a typo never silently fills nothing.',
      title: 'Listing and filling fields',
    },
    {
      content: [
        'Filled text is drawn with the bundled Noto Sans font, which covers Latin and Latin Extended scripts, so names such as Žluťoučký kůň appear correctly in any viewer. Plain ASCII text uses the standard form font.',
        'A character outside that coverage, such as Chinese or an emoji, is an error that names the field and the character. The tool never writes a broken appearance.',
        'Flatten turns the filled fields into ordinary page content. The values can no longer be edited, which suits a form you want to send as final.',
        'Some forms carry XFA data, an older XML form layer that many viewers ignore. When it is present, the tool removes it and fills the AcroForm fields, and the summary says so.',
      ],
      title: 'Fonts, flattening and XFA',
    },
  ],
  examples: [
    'Open List fields on a tax or application form to see every field name and its type.',
    'Copy the JSON template from List mode, edit the values and paste it into Fill mode.',
    'Set a check box with {"agree": true} and a radio group with {"size": "M"}.',
    'Fill an option list with an array such as {"tags": ["news", "offers"]}.',
    'Turn on Flatten after filling to send a copy that cannot be edited.',
    'Check the Options column before filling a dropdown, because values outside the list are rejected.',
  ],
  faq: [
    {
      answer:
        'The PDF probably has no AcroForm fields. Some forms are only drawn as lines and boxes on the page. Then List mode shows no fields and Fill mode reports an error, because there is nothing to fill.',
      question: 'Why does the tool find no fields?',
    },
    {
      answer:
        'The bundled font covers Latin and Latin Extended scripts. Chinese, Japanese, Korean, Cyrillic, Arabic and emoji are not included, so a value with such a character stops with an error naming the field and the character.',
      question: 'Why is my text rejected?',
    },
    {
      answer:
        'Only if the dropdown is editable, because editable dropdowns accept any text. A normal dropdown, a radio group and an option list accept only the listed options, and the error message lists them.',
      question: 'Can I enter a value that is not in the dropdown?',
    },
    {
      answer:
        'Signature and button fields cannot be filled, and neither can read-only fields. Signing a PDF needs a certificate and is not done by this tool. A password-protected PDF must be unlocked first.',
      question: 'Can it fill signatures or protected files?',
    },
  ],
  help: 'Choose a PDF form. List fields shows every fillable field with its type, value, options, required and read-only flags and maximum length.\n\nCopy the JSON template from the result, edit the values and switch to Fill.\n\nPaste the JSON into Values. Text, dropdown and radio fields take strings, check boxes take true or false and option lists take arrays.\n\nTurn on Flatten after filling if the fields should become plain page content, then save the filled PDF.',
  notes: [
    'Everything runs locally with pdf-lib; the PDF never leaves your device.',
    'Fields you do not mention, or set to null, keep their current value.',
    'Latin and Latin Extended text is drawn with the bundled Noto Sans; other scripts are an error naming the field and character.',
    'Non-ASCII text is drawn without word wrap and shrinks to fit a single-line box; a line break needs a multiline field, and tabs become spaces.',
    'Signature and button fields, read-only fields and unknown names are errors, so nothing is skipped silently.',
    'XFA form data is removed when present; the AcroForm fields are filled instead.',
  ],
};
