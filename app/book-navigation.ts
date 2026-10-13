/** A desktop spread advances two leaves; a phone advances one page. */
export function movePage(current: number, direction: -1 | 1, singlePage: boolean, totalPages: number): number {
  const step = singlePage ? 1 : 2;
  const origin = singlePage ? current : Math.floor(current / 2) * 2;
  const last = singlePage ? totalPages - 1 : Math.max(0, totalPages - 2);
  return Math.max(0, Math.min(last, origin + direction * step));
}

export function chapterForPage(page: number): number {
  return Math.floor(page / 2);
}
