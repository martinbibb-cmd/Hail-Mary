// packages/pwa/src/utils/clipboard.ts
export type CopyResult =
  | { ok: true; method: "clipboard-api" | "execCommand" }
  | { ok: false; error: string };

function fallbackCopyExecCommand(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;

    // Prevent iOS zoom + keep it off-screen
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    textarea.style.fontSize = "16px";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    // Note: execCommand is deprecated but kept as fallback for iOS Safari
    // and older browsers that don't support the Clipboard API
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function isClipboardApiAvailable(): boolean {
  // `navigator.clipboard` is often absent on iOS Safari / some webviews.
  // Also requires secure context for reliable behavior.
  return (
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function" &&
    typeof window !== "undefined" &&
    (window.isSecureContext ?? false)
  );
}

export async function safeCopyToClipboard(text: string): Promise<CopyResult> {
  try {
    if (isClipboardApiAvailable()) {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: "clipboard-api" };
    }

    const ok = fallbackCopyExecCommand(text);
    return ok
      ? { ok: true, method: "execCommand" }
      : { ok: false, error: "Copy not supported in this browser context." };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Copy failed." };
  }
}
