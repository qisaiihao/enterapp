export const SITE_PREFERENCE_KEY = "poementer:site";

function validSite(value) {
  return value === "classic" || value === "reader";
}

export function readSitePreference(storage) {
  try {
    const value = storage.getItem(SITE_PREFERENCE_KEY);
    return validSite(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberSiteChoice(url, storage) {
  const choice = new URL(url).searchParams.get("site");
  if (!validSite(choice)) return;
  try {
    storage.setItem(SITE_PREFERENCE_KEY, choice);
  } catch {
    // Explicit links still work when the browser disables local storage.
  }
}

export function selectSite({
  url,
  preference,
  userAgent = "",
  maxTouchPoints = 0,
  coarsePointer = false,
  width,
  height,
}) {
  const location = new URL(url);
  const explicit = location.searchParams.get("site");
  if (validSite(explicit)) return explicit;
  // A shared poem or a bookmarked reader page must open directly.
  if (/^#\/(home|poems|mine|me|about|journal)(?:\?|$)/.test(location.hash)) {
    return "reader";
  }
  if (validSite(preference)) return preference;
  const mobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) ||
    (coarsePointer && maxTouchPoints > 0 && !/Windows NT|X11/i.test(userAgent));
  return mobile && height >= width ? "classic" : "reader";
}

export function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function consumeSiteChoice() {
  const url = new URL(window.location.href);
  if (!validSite(url.searchParams.get("site"))) return;
  rememberSiteChoice(url, browserStorage());
  url.searchParams.delete("site");
  window.history.replaceState(window.history.state, "", url);
}
