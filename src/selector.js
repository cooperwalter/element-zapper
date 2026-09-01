(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.EZSelector = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_NAME_LENGTH = 40;
  const MAX_PATH_DEPTH = 6;
  const MAX_CLASSES_PER_PART = 2;

  const ATTRIBUTE_PRIORITY = [
    "data-testid",
    "data-test-id",
    "data-test",
    "data-qa",
    "data-cy",
    "data-component",
    "data-module",
    "data-section",
    "data-block",
    "aria-label",
    "name",
  ];

  const VOLATILE_CLASS_PATTERNS = [
    /^css-[a-z0-9]{4,}$/i,
    /^sc-[a-z0-9]{5,}$/i,
    /^jsx-\d+$/i,
    /^emotion-/i,
    /^[a-z0-9]+_[a-z0-9]+__[a-z0-9]{4,}$/i,
    /^[a-f0-9]{8,}$/i,
    /^[a-z][a-z-]*-[a-f0-9]{6,}$/i,
    /^(is|has|js)-/i,
    /\d{5,}/,
  ];

  const VOLATILE_CLASS_NAMES = new Set([
    "active", "open", "opened", "closed", "close", "selected", "hover", "focus",
    "focused", "visible", "invisible", "hidden", "show", "shown", "expanded",
    "collapsed", "loading", "loaded", "sticky", "stuck", "pinned", "current",
    "disabled", "enabled", "dragging", "animating", "entering", "leaving",
    "first", "last", "even", "odd",
  ]);

  const VOLATILE_ID_PATTERNS = [
    /^ember\d+$/i,
    /^:[a-z0-9]+:$/i,
    /:r[0-9a-z]+:/i,
    /^radix-/i,
    /^headlessui-/i,
    /^mui-\d+$/i,
    /^react-aria/i,
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    /^\d+$/,
    /^[a-f0-9]{10,}$/i,
    /\d{5,}/,
  ];

  function escapePart(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }
    return String(value).replace(/([^\w-])/g, "\\$1");
  }

  function escapeAttributeValue(value) {
    return String(value).replace(/(["\\])/g, "\\$1");
  }

  function tagOf(el) {
    return String(el.tagName || "").toLowerCase();
  }

  function classNamesOf(el) {
    if (typeof el.className === "string" && el.className.trim()) {
      return el.className.trim().split(/\s+/);
    }
    if (el.classList) return Array.from(el.classList);
    return [];
  }

  function isStableClass(name) {
    if (typeof name !== "string") return false;
    const value = name.trim();
    if (!value || value.length > MAX_NAME_LENGTH) return false;
    if (VOLATILE_CLASS_NAMES.has(value.toLowerCase())) return false;
    return !VOLATILE_CLASS_PATTERNS.some((pattern) => pattern.test(value));
  }

  function isStableId(id) {
    if (typeof id !== "string") return false;
    const value = id.trim();
    if (!value || value.length > MAX_NAME_LENGTH) return false;
    return !VOLATILE_ID_PATTERNS.some((pattern) => pattern.test(value));
  }

  function isStableAttributeValue(value) {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) return false;
    if (/^[a-f0-9]{8,}$/i.test(trimmed)) return false;
    if (/\d{5,}/.test(trimmed)) return false;
    return true;
  }

  function stableClasses(el) {
    return classNamesOf(el).filter(isStableClass);
  }

  function hasAllClasses(el, classes) {
    const own = classNamesOf(el);
    return classes.every((c) => own.includes(c));
  }

  function nthOfTypeIndex(el) {
    const parent = el.parentElement;
    if (!parent) return 1;
    let index = 0;
    for (const child of parent.children) {
      if (child.tagName === el.tagName) {
        index += 1;
        if (child === el) return index;
      }
    }
    return index || 1;
  }

  function buildCandidates(el) {
    const candidates = [];
    const tag = tagOf(el);

    if (isStableId(el.id)) candidates.push("#" + escapePart(el.id));

    for (const attribute of ATTRIBUTE_PRIORITY) {
      const value = el.getAttribute ? el.getAttribute(attribute) : null;
      if (value && isStableAttributeValue(value)) {
        candidates.push(tag + "[" + attribute + '="' + escapeAttributeValue(value.trim()) + '"]');
      }
    }

    const classes = stableClasses(el).map(escapePart);
    if (classes.length) {
      const all = "." + classes.join(".");
      candidates.push(tag + all);
      if (classes.length > 1) candidates.push(all);
      for (const cls of classes) {
        const single = tag + "." + cls;
        if (!candidates.includes(single)) candidates.push(single);
      }
    }

    return candidates;
  }

  function selectorPart(el) {
    const tag = tagOf(el);
    const classes = stableClasses(el).slice(0, MAX_CLASSES_PER_PART);
    let part = classes.length ? tag + "." + classes.map(escapePart).join(".") : tag;

    const parent = el.parentElement;
    if (parent) {
      const twins = Array.from(parent.children).filter(
        (child) => child.tagName === el.tagName && hasAllClasses(child, classes)
      );
      if (twins.length > 1) part += ":nth-of-type(" + nthOfTypeIndex(el) + ")";
    }

    return part;
  }

  function matchCount(selector, doc) {
    if (!selector || !String(selector).trim()) return 0;
    try {
      return doc.querySelectorAll(selector).length;
    } catch (error) {
      return 0;
    }
  }

  function isValidSelector(selector, doc) {
    if (!selector || !String(selector).trim()) return false;
    try {
      doc.querySelectorAll(selector);
      return true;
    } catch (error) {
      return false;
    }
  }

  function isUnique(selector, doc, el) {
    try {
      const matches = doc.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === el;
    } catch (error) {
      return false;
    }
  }

  function generateSelector(el, doc) {
    if (!el || !el.tagName) return "";

    for (const candidate of buildCandidates(el)) {
      if (isUnique(candidate, doc, el)) return candidate;
    }

    const parts = [selectorPart(el)];
    let node = el.parentElement;
    let depth = 0;

    while (node && depth < MAX_PATH_DEPTH) {
      for (const anchor of buildCandidates(node)) {
        const anchored = anchor + " " + parts.join(" > ");
        if (isUnique(anchored, doc, el)) return anchored;
      }
      parts.unshift(selectorPart(node));
      const path = parts.join(" > ");
      if (isUnique(path, doc, el)) return path;
      node = node.parentElement;
      depth += 1;
    }

    return parts.join(" > ");
  }

  return {
    isStableClass,
    isStableId,
    isStableAttributeValue,
    stableClasses,
    buildCandidates,
    selectorPart,
    generateSelector,
    matchCount,
    isValidSelector,
    nthOfTypeIndex,
  };
});
