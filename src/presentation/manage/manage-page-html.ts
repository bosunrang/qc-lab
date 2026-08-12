export function createManagePageHtml() {
  return (headHtml: string, shellHtml: string) => `${headHtml}${shellHtml}`;
}
