export function isPublishNow(item: { publishAt?: string } | null | undefined): boolean {
  if (!item || !item.publishAt) return true;
  const publishDate = new Date(item.publishAt);
  if (Number.isNaN(publishDate.getTime())) return true;
  return publishDate.getTime() <= Date.now();
}

export function filterPublished<T extends { publishAt?: string }>(items: T[] = []): T[] {
  return items.filter(isPublishNow);
}
