(function (root) {
  "use strict";

  function siteKeyFromHostname(hostname) {
    return String(hostname || "").replace(/^www\./i, "").toLowerCase();
  }

  function siteKeyFromUrl(url) {
    try {
      return siteKeyFromHostname(new URL(url).hostname);
    } catch (error) {
      return "";
    }
  }

  function emptySite() {
    return { enabled: true, rules: [] };
  }

  function normalizeSite(value) {
    if (!value || typeof value !== "object") return emptySite();
    return {
      enabled: value.enabled !== false,
      rules: Array.isArray(value.rules) ? value.rules.filter((r) => typeof r === "string" && r.trim()) : [],
    };
  }

  async function getSite(siteKey) {
    if (!siteKey) return emptySite();
    const stored = await chrome.storage.sync.get(siteKey);
    return normalizeSite(stored[siteKey]);
  }

  async function setSite(siteKey, site) {
    if (!siteKey) return;
    const normalized = normalizeSite(site);
    if (!normalized.rules.length && normalized.enabled) {
      await chrome.storage.sync.remove(siteKey);
      return;
    }
    await chrome.storage.sync.set({ [siteKey]: normalized });
  }

  async function addRule(siteKey, selector) {
    const site = await getSite(siteKey);
    const trimmed = String(selector).trim();
    if (!trimmed || site.rules.includes(trimmed)) return site;
    site.rules.push(trimmed);
    await setSite(siteKey, site);
    return site;
  }

  async function removeRule(siteKey, selector) {
    const site = await getSite(siteKey);
    site.rules = site.rules.filter((r) => r !== selector);
    await setSite(siteKey, site);
    return site;
  }

  async function setEnabled(siteKey, enabled) {
    const site = await getSite(siteKey);
    site.enabled = Boolean(enabled);
    await setSite(siteKey, site);
    return site;
  }

  root.EZStorage = {
    siteKeyFromHostname,
    siteKeyFromUrl,
    emptySite,
    normalizeSite,
    getSite,
    setSite,
    addRule,
    removeRule,
    setEnabled,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
