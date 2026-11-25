export interface JsonTreeNode {
  childCount: number;
  depth: number;
  id: number;
  label: string;
  parentId: number | null;
  pointer: string;
  token: string;
  type: 'array' | 'boolean' | 'null' | 'number' | 'object' | 'string';
}

export function initialJsonTreeExpansion(nodes: JsonTreeNode[], expandedLevels = 1): Set<number> {
  return new Set(
    nodes
      .filter((node) => node.id === 0 || (node.childCount > 0 && node.depth < expandedLevels))
      .map((node) => node.id),
  );
}

export function visibleJsonTreeNodes(
  nodes: JsonTreeNode[],
  expanded: ReadonlySet<number>,
  query: string,
): JsonTreeNode[] {
  const search = query.trim().toLowerCase();
  const allowed = new Set<number>();

  if (search) {
    const byId = new Map(nodes.map((node) => [node.id, node]));

    for (const node of nodes) {
      const parts = [node.label, node.pointer, node.type];

      if (node.type !== 'array' && node.type !== 'object') parts.push(node.token);
      if (!parts.some((part) => part.toLowerCase().includes(search))) continue;

      let current: JsonTreeNode | undefined = node;

      while (current && !allowed.has(current.id)) {
        allowed.add(current.id);
        current = current.parentId === null ? undefined : byId.get(current.parentId);
      }
    }

    return nodes.filter((node) => allowed.has(node.id));
  }

  const visible = new Set<number>();

  return nodes.filter((node) => {
    if (node.parentId !== null && (!visible.has(node.parentId) || !expanded.has(node.parentId)))
      return false;

    visible.add(node.id);

    return true;
  });
}
