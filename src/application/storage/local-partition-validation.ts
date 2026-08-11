export function localPartitionValid(manifest:any, shell:any, rows:any[]) {
  if (!manifest || !shell || !shell.state || Number(shell.savedAt || 0) > Number(manifest.savedAt || 0)) return false;
  return !(rows || []).some(row => !row || !Array.isArray(row.points) || Number(row.savedAt || 0) > Number(manifest.savedAt || 0));
}
