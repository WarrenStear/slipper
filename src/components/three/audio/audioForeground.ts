/** DOM lifecycle only. Descendant button focus is not a window interruption. */
export function audioDocumentIsForeground(document: Pick<Document, "hidden" | "hasFocus">) {
  return !document.hidden && document.hasFocus();
}

export function observeAudioForeground(
  window: Window, document: Document, changed: (foreground: boolean) => void,
) {
  const windowChanged = (event: Event) => {
    if (event.target !== window) return;
    changed((event.type === "focus" || event.type === "pageshow") && audioDocumentIsForeground(document));
  };
  const visibilityChanged = () => changed(audioDocumentIsForeground(document));
  window.addEventListener("blur", windowChanged, true);
  window.addEventListener("focus", windowChanged, true);
  window.addEventListener("pagehide", windowChanged);
  window.addEventListener("pageshow", windowChanged);
  document.addEventListener("visibilitychange", visibilityChanged);
  return () => {
    window.removeEventListener("blur", windowChanged, true);
    window.removeEventListener("focus", windowChanged, true);
    window.removeEventListener("pagehide", windowChanged);
    window.removeEventListener("pageshow", windowChanged);
    document.removeEventListener("visibilitychange", visibilityChanged);
  };
}
