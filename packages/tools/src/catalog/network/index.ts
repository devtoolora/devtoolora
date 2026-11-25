import { type ToolDefinition } from '@devtoolora/core';
import { ipv4ConverterTool } from './ipv4-converter/tool';
import { ipv4RangeTool } from './ipv4-range/tool';
import { ipv4SubnetTool } from './ipv4-subnet/tool';
import { macGeneratorTool } from './mac-generator/tool';
import { ipv6UlaTool } from './ipv6-ula/tool';
import { ipv6ConverterTool } from './ipv6-converter/tool';
import { ipv6SubnetTool } from './ipv6-subnet/tool';
import { cidrAggregatorTool } from './cidr-aggregator/tool';
import { portReferenceTool } from './port-reference/tool';
import { bandwidthCalculatorTool } from './bandwidth-calculator/tool';
import {
  wireguardConfigGeneratorTool,
  wireguardKeyGeneratorTool,
} from './wireguard-config-generator/tool';

export * from './ipv4-converter/tool';
export * from './ipv4-range/tool';
export * from './ipv4-subnet/tool';
export * from './mac-generator/tool';
export * from './ipv6-ula/tool';
export * from './ipv6-converter/tool';
export * from './ipv6-subnet/tool';
export * from './cidr-aggregator/tool';
export * from './port-reference/tool';
export * from './bandwidth-calculator/tool';
export * from './wireguard-config-generator/tool';

export const networkTools: ToolDefinition[] = [
  ipv4ConverterTool,
  ipv4RangeTool,
  ipv4SubnetTool,
  macGeneratorTool,
  ipv6UlaTool,
  ipv6ConverterTool,
  ipv6SubnetTool,
  cidrAggregatorTool,
  portReferenceTool,
  bandwidthCalculatorTool,
  wireguardConfigGeneratorTool,
  wireguardKeyGeneratorTool,
];
