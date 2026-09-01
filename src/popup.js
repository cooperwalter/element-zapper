(function () {
  "use strict";

  const els = {
    site: document.getElementById("site"),
    main: document.getElementById("main"),
    unsupported: document.getElementById("unsupported"),
    rules: document.getElementById("rules"),
    empty: document.getElementById("empty"),
    selector: document.getElementById("selector"),
    add: document.getElementById("add"),
    hint: document.getElementById("hint"),
    pick: document.getElementById("pick"),
    enabled: document.getElementById("enabled"),
  };

  let tabId = null;
  let siteKey = "";

  function askTab(message) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response);
      });
    });
  }

  async function countFor(selector) {
    const response = await askTab({ type: "EZ_MATCH_COUNT", selector });
    return response ? response.count : null;
  }

  function setHint(text, isError = false) {
    els.hint.textContent = text;
    els.hint.classList.toggle("error", isError);
  }

  async function renderRules() {
    const site = await EZStorage.getSite(siteKey);
    els.enabled.checked = site.enabled;
    els.rules.replaceChildren();
    els.empty.hidden = site.rules.length > 0;

    for (const selector of site.rules) {
      const li = document.createElement("li");

      const label = document.createElement("span");
      label.className = "selector";
      label.textContent = selector;
      label.title = selector;

      const count = document.createElement("span");
      count.className = "count";
      count.textContent = "…";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "Remove this rule";
      remove.addEventListener("click", async () => {
        await EZStorage.removeRule(siteKey, selector);
        renderRules();
      });

      li.addEventListener("mouseenter", () => {
        askTab({ type: "EZ_HIGHLIGHT", selector });
      });

      li.append(label, count, remove);
      els.rules.appendChild(li);

      countFor(selector).then((n) => {
        if (n === null) {
          count.textContent = "";
          return;
        }
        count.textContent = `${n}`;
        count.classList.toggle("zero", n === 0);
      });
    }
  }

  async function addCurrentSelector() {
    const selector = els.selector.value.trim();
    if (!selector) return;

    const count = await countFor(selector);
    if (count === null) {
      setHint("Can't reach this page to verify the selector.", true);
      return;
    }

    await EZStorage.addRule(siteKey, selector);
    els.selector.value = "";
    setHint("");
    renderRules();
  }

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https?:/i.test(tab.url || "")) {
      els.unsupported.hidden = false;
      return;
    }

    tabId = tab.id;
    siteKey = EZStorage.siteKeyFromUrl(tab.url);
    els.site.textContent = siteKey;
    els.site.title = siteKey;
    els.main.hidden = false;

    askTab({ type: "EZ_STOP_PICK" });

    await renderRules();

    els.add.addEventListener("click", addCurrentSelector);

    els.selector.addEventListener("keydown", (event) => {
      if (event.key === "Enter") addCurrentSelector();
    });

    els.selector.addEventListener("input", async () => {
      const selector = els.selector.value.trim();
      if (!selector) {
        setHint("");
        return;
      }
      const count = await countFor(selector);
      if (count === null) {
        setHint("Can't reach this page.", true);
        return;
      }
      if (count === 0) {
        setHint("Matches nothing on this page.", true);
        return;
      }
      setHint(`Matches ${count} element${count === 1 ? "" : "s"}.`);
      askTab({ type: "EZ_HIGHLIGHT", selector });
    });

    els.enabled.addEventListener("change", async () => {
      await EZStorage.setEnabled(siteKey, els.enabled.checked);
    });

    els.pick.addEventListener("click", async () => {
      const response = await askTab({ type: "EZ_START_PICK" });
      if (!response) {
        setHint("Reload the page, then try picking again.", true);
        return;
      }
      window.close();
    });
  }

  init();
})();
