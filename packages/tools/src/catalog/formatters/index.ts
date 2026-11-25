import { ToolDefinition } from '@devtoolora/core';
import { jsonFormatTool, jsonMinifyTool, jsonValidateTool } from './json-format/tool';
import { jsonDiffTool } from './json-diff/tool';
import { jsonTreeTool } from './json-tree/tool';
import { jsonQueryTool } from './json-query/tool';
import { jsonTableTool } from './json-table/tool';
import { jsonFlattenTool } from './json-flatten/tool';
import { jsonCanonicalizeTool } from './json-canonicalize/tool';
import { jsonLinesConverterTool } from './json-lines-converter/tool';
import { jsonToTomlTool, tomlToJsonTool } from './json-to-toml/tool';
import { jsonToYamlTool, yamlToJsonTool } from './json-to-yaml/tool';
import { xmlFormatTool } from './xml-format/tool';
import { yamlFormatTool } from './yaml-format/tool';
import { tomlFormatTool } from './toml-format/tool';
import { htmlFormatTool } from './html-format/tool';
import { cssFormatTool } from './css-format/tool';
import { json5ToJsonTool, jsoncToJsonTool } from './jsonc-to-json/tool';
import { iniConverterTool } from './ini-converter/tool';
import { propertiesConverterTool } from './properties-converter/tool';
import { plistConverterTool } from './plist-converter/tool';
import { csvDelimiterConverterTool, csvToTsvTool } from './csv-delimiter-converter/tool';
import { csvColumnsTool } from './csv-columns/tool';
import { csvDiffTool } from './csv-diff/tool';
import { csvToSqlInsertTool, csvToSqlTool } from './csv-to-sql/tool';
import { sqlFormatTool } from './sql-format/tool';
import { jsonToXmlTool, xmlToJsonTool } from './json-to-xml/tool';
import { jsonToCsvTool, csvToJsonTool } from './json-to-csv/tool';
import { jsonPatchTool } from './json-patch/tool';
import { markdownTableGeneratorTool, tableGeneratorTool } from './table-generator/tool';

export * from './json-format/tool';
export * from './json-tree/tool';
export * from './json-diff/tool';
export * from './json-to-yaml/tool';
export * from './xml-format/tool';
export * from './sql-format/tool';
export * from './json-to-xml/tool';
export * from './json-to-csv/tool';
export * from './json-to-toml/tool';
export * from './json-table/tool';
export * from './json-query/tool';
export * from './json-flatten/tool';
export * from './json-canonicalize/tool';
export * from './json-lines-converter/tool';
export * from './yaml-format/tool';
export * from './toml-format/tool';
export * from './html-format/tool';
export * from './css-format/tool';
export * from './jsonc-to-json/tool';
export * from './ini-converter/tool';
export * from './properties-converter/tool';
export * from './plist-converter/tool';
export * from './csv-delimiter-converter/tool';
export * from './csv-columns/tool';
export * from './csv-diff/tool';
export * from './csv-to-sql/tool';
export * from './json-patch/tool';
export * from './table-generator/tool';

export const browserFormatterTools: ToolDefinition[] = [
  jsonFormatTool,
  jsonMinifyTool,
  jsonValidateTool,
  jsonTreeTool,
  jsonDiffTool,
  jsonToYamlTool,
  yamlToJsonTool,
  xmlFormatTool,
  sqlFormatTool,
  jsonToXmlTool,
  xmlToJsonTool,
  jsonToCsvTool,
  csvToJsonTool,
  jsonToTomlTool,
  tomlToJsonTool,
  jsonTableTool,
  jsonQueryTool,
  jsonFlattenTool,
  jsonCanonicalizeTool,
  jsonLinesConverterTool,
  yamlFormatTool,
  tomlFormatTool,
  htmlFormatTool,
  cssFormatTool,
  jsoncToJsonTool,
  json5ToJsonTool,
  iniConverterTool,
  propertiesConverterTool,
  plistConverterTool,
  csvDelimiterConverterTool,
  csvToTsvTool,
  csvColumnsTool,
  csvDiffTool,
  csvToSqlTool,
  csvToSqlInsertTool,
  jsonPatchTool,
  tableGeneratorTool,
  markdownTableGeneratorTool,
];
