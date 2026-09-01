(function () {
  "use strict";

  const STYLE_ID = "element-zapper-style";
  const siteKey = EZStorage.siteKeyFromHostname(location.hostname);

  function styleElement() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    return style;
  }

  function cssFor(site) {
    if (!site.enabled) return "";
    return site.rules
      .map((selector) => `${selector} { display: none !important; }`)
      .join("\n");
  }

  async function apply() {
    const site = await EZStorage.getSite(siteKey);
    styleElement().textContent = cssFor(site);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && siteKey in changes) apply();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return undefined;

    switch (message.type) {
      case "EZ_PING":
        sendResponse({ ok: true, siteKey });
        return undefined;

      case "EZ_MATCH_COUNT":
        sendResponse({ count: EZSelector.matchCount(message.selector, document) });
        return undefined;

      case "EZ_HIGHLIGHT":
        EZPicker.flash(message.selector);
        sendResponse({ ok: true });
        return undefined;

      case "EZ_STOP_PICK": {
        const wasPicking = EZPicker.isActive();
        EZPicker.stop();
        sendResponse({ ok: true, wasPicking });
        return undefined;
      }

      case "EZ_START_PICK":
        EZPicker.start({
          siteKey,
          onPicked: (selector) => EZStorage.addRule(siteKey, selector),
        });
        sendResponse({ ok: true });
        return undefined;

      default:
        return undefined;
    }
  });

  apply();
})();
