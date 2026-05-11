export function getLoginHref(fromPath: string): string {
  const path = fromPath.startsWith("/") ? fromPath : `/${fromPath}`;
  return `/login?from=${encodeURIComponent(path)}`;
}
