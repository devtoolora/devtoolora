import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A production build minifies and bundles code, so an error in the browser points at app.min.js:1:4021 instead of the file you wrote. A source map is the .map file the build emits next to the bundle. It records which original file, line and column each generated position came from, and sometimes the identifier written at that position.',
        'Paste the stack trace and add the .map files of the build. The tool finds every frame that ends in :line:column, looks up its position in the matching map and writes the original location in place of the generated one. Function names, indentation and the other lines of the trace stay as they were.',
        'Everything runs in your browser. Stack traces and maps often contain internal paths and source code, so neither is uploaded or saved in drafts.',
      ],
      title: 'What does a source map resolver do?',
    },
    {
      content: [
        'Read an error report from production monitoring when the stack points at a minified bundle.',
        'Check that the maps your build publishes really cover the code that ships.',
        'Turn a Chrome, Node, Firefox or Safari trace into readable file names for a bug report.',
        'See the lines of original code around each frame without opening the repository.',
      ],
      title: 'When to use Source Map Resolver',
    },
  ],
  examples: [
    'at x (https://cdn.test/app.min.js:1:12) → at x (src/app.ts:1:10)',
    'x@https://cdn.test/app.min.js#frag:1:12 → x@src/app.ts:1:10',
    'at x (file:///C:/app/dist/app.min.js:1:12) → found through the file name app.min.js',
    'at x (webpack:///./dist/app.min.js?v=3:1:12) → the ?v=3 query is ignored when matching',
    'at r (vendor.js:1:4021) with no vendor.js.map → kept as written and counted as without a map',
    'one bundle.js.map and a trace from main.js → paired by position and noted in the summary',
  ],
  faq: [
    {
      answer:
        'The tool matches the file name at the end of the frame location, such as app.min.js, with the file field inside each map or with the name of the .map file. Folders, query strings and hashes are ignored.',
      question: 'How does a frame find its source map?',
    },
    {
      answer:
        'A source map names the identifier at a position, not the function that contains it. At a call site that is the function being called, so using it would label each frame with the name from the frame above. The location is exact, and the JSON report lists the identifier as nameAtPosition.',
      question: 'Why does the frame keep its minified function name?',
    },
    {
      answer:
        'The map has no sourcesContent entry for that file. Many builds leave it out to keep the map small. Rebuild with sourcesContent enabled or open the file in your repository at the printed line.',
      question: 'Why are no source lines shown?',
    },
    {
      answer:
        'The position falls on a generated line or column that the map does not describe, or the nearest mapping has no original file. The frame is kept as written and marked unmapped in the JSON report.',
      question: 'What does unmapped mean?',
    },
    {
      answer:
        'Index maps with a sections list are not supported. Provide the maps of the individual bundles instead, or merge the sections with your build tool before pasting.',
      question: 'Are index source maps supported?',
    },
    {
      answer:
        'Only if the map file keeps your sources and you share the output. The tool itself runs locally and nothing is uploaded, so you decide what leaves the browser.',
      question: 'Does the tool send my code anywhere?',
    },
  ],
  help: 'Paste the stack trace into the input and add one or more .map files in the Source maps field. V8 frames such as at name (file:line:column) and Firefox or Safari frames such as name@file:line:column are rewritten. Other lines are copied unchanged.\n\nThe summary counts resolved frames, frames without a matching map, unmapped frames and, when you show source lines, frames whose map has no source content. When there is one map and the trace uses one file name, the map is paired with that file by position and the summary says so.\n\nTurn on Show original source lines to print up to five lines of the original file after each frame, with the mapped line marked by >. Choose JSON for the generated and original position of every frame; the other format stays available as a second download.\n\nNot supported: index maps with sections, maps inside data URLs or sourceMappingURL comments, and column-exact matching inside minified lines beyond the nearest earlier mapping.',
  notes: [
    'Processing is local; nothing is uploaded and the input is not saved in drafts.',
    'Limits: a trace of 1,048,576 characters and 5,000 frame lines; 1 to 20 maps of 50 MiB each and 100 MiB in total.',
    'A frame uses the nearest mapping at or before its column on the same generated line.',
    'Only the location is rewritten; the function name of the frame is kept as written.',
    'The resolved output is limited to 5,000,000 characters; with source lines on, long code lines are cut at 300 characters.',
    'Lines are numbered from 1 in both the trace and the output, as browsers print them.',
  ],
};
