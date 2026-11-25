export const aiLimits = {
  chunker: { chunks: 10_000, maxSize: 100_000, minSize: 50, outputChars: 5_000_000 },
  jsonl: {
    displayedIssues: 500,
    fileBytes: 50 * 1024 * 1024,
    issues: 10_000,
    lineChars: 1_000_000,
    lines: 100_000,
  },
  schema: {
    depth: 30,
    descriptionChars: 1_024,
    examples: { max: 20, min: 1 },
    examplesChars: 1_000_000,
    generatedNodes: 5_000,
    nodes: 50_000,
    namePattern: /^[a-zA-Z0-9_-]{1,64}$/,
  },
  template: {
    iterations: 100_000,
    outputChars: 2_000_000,
    sectionDepth: 32,
    steps: 5_000_000,
    templateChars: 200_000,
    variablesChars: 1_000_000,
    variablesDepth: 64,
  },
  textUnits: 1_000_000,
} as const;
