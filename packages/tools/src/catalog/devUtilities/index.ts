import { ToolDefinition } from '@devtoolora/core';
import { semverCompareTool } from './semver-compare/tool';
import { randomPortTool } from './random-port/tool';
import { chmodCalculatorTool } from './chmod-calculator/tool';
import { cronGeneratorTool, cronExplainTool } from './cron-explain/tool';
import { dockerToComposeTool } from './docker-to-compose/tool';
import { gitignoreGeneratorTool } from './gitignore-generator/tool';
import { idInspectorTool, uuidDecoderTool } from './id-inspector/tool';
import { bitwiseCalculatorTool, programmerCalculatorTool } from './bitwise-calculator/tool';
import { conventionalCommitTool } from './conventional-commit/tool';
import { semverRangeTool } from './semver-range/tool';
import { licenseGeneratorTool } from './license-generator/tool';
import { editorconfigGeneratorTool } from './editorconfig-generator/tool';
import { systemdUnitBuilderTool } from './systemd-unit-builder/tool';
import { sshConfigGeneratorTool } from './ssh-config-generator/tool';
import { dockerComposeValidatorTool } from './docker-compose-validator/tool';

export * from './docker-to-compose/tool';
export * from './cron-explain/tool';
export * from './chmod-calculator/tool';
export * from './semver-compare/tool';
export * from './random-port/tool';
export * from './gitignore-generator/tool';
export * from './id-inspector/tool';
export * from './bitwise-calculator/tool';
export * from './conventional-commit/tool';
export * from './semver-range/tool';
export * from './license-generator/tool';
export * from './editorconfig-generator/tool';
export * from './systemd-unit-builder/tool';
export * from './ssh-config-generator/tool';
export * from './docker-compose-validator/tool';

export const devUtilityTools: ToolDefinition[] = [
  dockerToComposeTool,
  cronExplainTool,
  chmodCalculatorTool,
  semverCompareTool,
  randomPortTool,
  cronGeneratorTool,
  gitignoreGeneratorTool,
  idInspectorTool,
  uuidDecoderTool,
  bitwiseCalculatorTool,
  programmerCalculatorTool,
  conventionalCommitTool,
  semverRangeTool,
  licenseGeneratorTool,
  editorconfigGeneratorTool,
  systemdUnitBuilderTool,
  sshConfigGeneratorTool,
  dockerComposeValidatorTool,
];
