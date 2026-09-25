import {
  browserStorage,
  consumeSiteChoice,
  readSitePreference,
  selectSite,
} from "./lib/siteEntry";

const site = selectSite({
  url: window.location.href,
  preference: readSitePreference(browserStorage()),
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints,
  coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  width: window.innerWidth,
  height: window.innerHeight,
});
consumeSiteChoice();

if (site === "classic") {
  window.location.replace("/classic/");
} else {
  // The mobile landing page does not load the reader or its CloudBase SDK.
  import("./reader");
}
