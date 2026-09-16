export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Support browser clipboard restrictions, including local HTTP previews.
    const previousFocus = document.activeElement;
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(field);
    field.select();
    try {
      if (!document.execCommand("copy"))
        throw new Error("Clipboard unavailable");
    } finally {
      field.remove();
      previousFocus?.focus();
    }
  }
}
