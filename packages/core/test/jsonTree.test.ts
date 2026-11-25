import assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  initialJsonTreeExpansion,
  visibleJsonTreeNodes,
  type JsonTreeNode,
} from '@devtoolora/core';

it('filters a preorder JSON outline by expansion or search without losing ancestors', () => {
  const nodes: JsonTreeNode[] = [
    {
      childCount: 1,
      depth: 0,
      id: 0,
      label: '$',
      parentId: null,
      pointer: '',
      token: '{}',
      type: 'object',
    },
    {
      childCount: 1,
      depth: 1,
      id: 1,
      label: '"user"',
      parentId: 0,
      pointer: '/user',
      token: '{}',
      type: 'object',
    },
    {
      childCount: 0,
      depth: 2,
      id: 2,
      label: '"name"',
      parentId: 1,
      pointer: '/user/name',
      token: '"Ada"',
      type: 'string',
    },
  ];

  assert.deepEqual(
    visibleJsonTreeNodes(nodes, new Set(), '').map((node) => node.id),
    [0],
  );

  assert.deepEqual(
    visibleJsonTreeNodes(nodes, new Set([0]), '').map((node) => node.id),
    [0, 1],
  );

  assert.deepEqual(
    visibleJsonTreeNodes(nodes, new Set([0, 1]), '').map((node) => node.id),
    [0, 1, 2],
  );

  assert.deepEqual(
    visibleJsonTreeNodes(nodes, new Set(), 'ADA').map((node) => node.id),
    [0, 1, 2],
  );

  assert.deepEqual(visibleJsonTreeNodes(nodes, new Set(), 'missing'), []);
  assert.deepEqual([...initialJsonTreeExpansion(nodes)], [0]);

  assert.deepEqual(
    visibleJsonTreeNodes(nodes, initialJsonTreeExpansion(nodes, 2), '').map((node) => node.id),
    [0, 1, 2],
  );
});
