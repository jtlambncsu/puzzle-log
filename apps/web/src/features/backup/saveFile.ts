/**
 * Saves a file from the browser. On phones, the share sheet ("Save to Files", AirDrop...)
 * works best, especially in the installed app, where plain downloads are unreliable. Browsers
 * only allow it straight after a tap, so call this from a click handler, not after a long
 * wait. Elsewhere, or if sharing isn't allowed, it falls back to a normal download.
 */
export async function saveFile(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return; // closed the sheet
      // Not allowed (e.g. no recent tap): download instead.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  // Give the download time to start before releasing the data.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
