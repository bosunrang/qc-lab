export type EntryTreeNode = { role: string; key?: string; search?: string };

export function entryTreeVisibility(nodes: readonly EntryTreeNode[], query: string, openKeys: ReadonlySet<string>) {
  if (!query) {
    const visible = nodes.map(() => true);
    nodes.forEach((node, index) => {
      if (node.role === 'group' && !openKeys.has(String(node.key || ''))) {
        for (let cursor = index + 1; nodes[cursor]?.role === 'assay'; cursor += 1) visible[cursor] = false;
      }
      if (node.role === 'machine' && !openKeys.has(String(node.key || ''))) {
        for (let cursor = index + 1; cursor < nodes.length && nodes[cursor].role !== 'machine'; cursor += 1) visible[cursor] = false;
      }
    });
    return visible;
  }
  const visible = nodes.map(() => false);
  nodes.forEach((node, index) => {
    if (node.role !== 'assay' || !String(node.search || '').includes(query)) return;
    visible[index] = true;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (nodes[cursor].role === 'group') { visible[cursor] = true; break; }
    }
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (nodes[cursor].role === 'machine') { visible[cursor] = true; break; }
    }
  });
  return visible;
}
