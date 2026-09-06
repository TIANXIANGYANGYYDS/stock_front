/** Decorative scroll position; unsupported browsers simply omit the CSS indicator. */
export function ReadingProgress() {
  return <div className="studio-reading-progress" aria-hidden="true"><span /></div>;
}
