export function shouldIgnorePath(
  path: string,
  prefixes?: string | string[],
): boolean {
  if (!prefixes) return false;
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  return list.some((p) => {
    const base = p.endsWith("/") ? p.slice(0, -1) : p;
    return path === base || path.startsWith(`${base}/`);
  });
}
