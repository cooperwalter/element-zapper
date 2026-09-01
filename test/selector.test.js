const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  isStableClass,
  isStableId,
  stableClasses,
  buildCandidates,
  generateSelector,
  matchCount,
  isValidSelector,
} = require("../src/selector.js");

function makeEl({ tag = "div", id = null, classes = [], attrs = {}, children = [] } = {}) {
  const el = {
    tagName: tag.toUpperCase(),
    id: id || "",
    className: classes.join(" "),
    classList: {
      contains: (c) => classes.includes(c),
      [Symbol.iterator]: function* () { yield* classes; },
    },
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    hasAttribute: (name) => name in attrs,
    parentElement: null,
    children: [],
  };
  for (const child of children) {
    child.parentElement = el;
    el.children.push(child);
  }
  return el;
}

function makeTree(spec) {
  const el = makeEl({ ...spec, children: (spec.children || []).map(makeTree) });
  return el;
}

function makeDoc(matches = {}) {
  return {
    querySelectorAll(selector) {
      if (selector in matches) return matches[selector];
      return [];
    },
  };
}

test("isStableClass should reject emotion hashed class names like css-1x2y3z", () => {
  assert.equal(isStableClass("css-1x2y3z"), false);
});

test("isStableClass should reject styled-components hashed class names like sc-bdVaJa", () => {
  assert.equal(isStableClass("sc-bdVaJa"), false);
});

test("isStableClass should reject CSS-module hashed class names like Button_root__2xY3z", () => {
  assert.equal(isStableClass("Button_root__2xY3z"), false);
});

test("isStableClass should reject Next.js jsx-1234567 runtime class names", () => {
  assert.equal(isStableClass("jsx-1234567"), false);
});

test("isStableClass should reject bare hex hash class names like a1b2c3d4", () => {
  assert.equal(isStableClass("a1b2c3d4"), false);
});

test("isStableClass should reject transient state class names like active and is-open", () => {
  assert.equal(isStableClass("active"), false);
  assert.equal(isStableClass("is-open"), false);
  assert.equal(isStableClass("has-focus"), false);
});

test("isStableClass should accept human-authored class names like ad-banner and site-sidebar", () => {
  assert.equal(isStableClass("ad-banner"), true);
  assert.equal(isStableClass("site-sidebar"), true);
});

test("isStableId should reject Ember auto-generated ids like ember1234", () => {
  assert.equal(isStableId("ember1234"), false);
});

test("isStableId should reject React useId ids of the form :r3:", () => {
  assert.equal(isStableId(":r3:"), false);
});

test("isStableId should reject Radix generated ids like radix-:r1:-trigger", () => {
  assert.equal(isStableId("radix-:r1:-trigger"), false);
});

test("isStableId should reject UUID ids", () => {
  assert.equal(isStableId("3f2504e0-4f89-11d3-9a0c-0305e82c3301"), false);
});

test("isStableId should reject purely numeric ids", () => {
  assert.equal(isStableId("12345"), false);
});

test("isStableId should accept human-authored ids like newsletter-modal", () => {
  assert.equal(isStableId("newsletter-modal"), true);
});

test("stableClasses should keep authored class names and drop hashed ones from the same element", () => {
  const el = makeEl({ classes: ["ad-banner", "css-1x2y3z", "promo", "active"] });
  assert.deepEqual(stableClasses(el), ["ad-banner", "promo"]);
});

test("buildCandidates should put the id selector first when the element has a stable id", () => {
  const el = makeEl({ tag: "div", id: "newsletter-modal", classes: ["promo"] });
  assert.equal(buildCandidates(el)[0], "#newsletter-modal");
});

test("buildCandidates should prefer a data-testid attribute selector over class-based selectors", () => {
  const el = makeEl({ tag: "div", classes: ["promo"], attrs: { "data-testid": "signup-cta" } });
  const candidates = buildCandidates(el);
  const testIdIndex = candidates.indexOf('div[data-testid="signup-cta"]');
  const classIndex = candidates.indexOf("div.promo");
  assert.ok(testIdIndex !== -1, "expected a data-testid candidate");
  assert.ok(testIdIndex < classIndex, "expected data-testid to rank above class selectors");
});

test("buildCandidates should not emit an attribute selector when the attribute value looks generated", () => {
  const el = makeEl({ tag: "div", attrs: { "data-testid": "a1b2c3d4e5f6" } });
  assert.ok(!buildCandidates(el).some((c) => c.includes("data-testid")));
});

test("buildCandidates should produce no candidates for an element with no id, stable class, or attribute", () => {
  const el = makeEl({ tag: "span", classes: ["css-9z8y7x"] });
  assert.deepEqual(buildCandidates(el), []);
});

test("generateSelector should return the id selector when the id uniquely matches the element", () => {
  const el = makeEl({ tag: "div", id: "newsletter-modal" });
  const doc = makeDoc({ "#newsletter-modal": [el] });
  assert.equal(generateSelector(el, doc), "#newsletter-modal");
});

test("generateSelector should skip a candidate that matches more than one element on the page", () => {
  const target = makeEl({ tag: "div", classes: ["promo", "banner"] });
  const other = makeEl({ tag: "div", classes: ["promo", "banner"] });
  const parent = makeEl({ tag: "section", id: "sidebar", children: [target, other] });
  const doc = makeDoc({
    "div.promo.banner": [target, other],
    ".promo.banner": [target, other],
    "div.promo": [target, other],
    "div.banner": [target, other],
    "#sidebar": [parent],
    "#sidebar div.promo.banner:nth-of-type(1)": [target],
  });
  assert.equal(generateSelector(target, doc), "#sidebar div.promo.banner:nth-of-type(1)");
});

test("generateSelector should anchor the path on the nearest ancestor carrying a stable id", () => {
  const target = makeEl({ tag: "li", classes: ["item"] });
  const list = makeEl({ tag: "ul", classes: ["css-4h5j6k"], children: [target] });
  const root = makeEl({ tag: "nav", id: "main-nav", children: [list] });
  const doc = makeDoc({
    "li.item": [target, makeEl({ tag: "li" })],
    ".item": [target, makeEl({ tag: "li" })],
    "#main-nav": [root],
    "#main-nav ul > li.item": [target],
  });
  assert.equal(generateSelector(target, doc), "#main-nav ul > li.item");
});

test("generateSelector should append nth-of-type when siblings share the element's tag and classes", () => {
  const first = makeEl({ tag: "div", classes: ["card"] });
  const second = makeEl({ tag: "div", classes: ["card"] });
  const parent = makeEl({ tag: "main", id: "content", children: [first, second] });
  const doc = makeDoc({
    "div.card": [first, second],
    ".card": [first, second],
    "#content": [parent],
    "#content div.card:nth-of-type(2)": [second],
  });
  assert.equal(generateSelector(second, doc), "#content div.card:nth-of-type(2)");
});

test("generateSelector should omit nth-of-type when the element is the only sibling of its tag and classes", () => {
  const target = makeEl({ tag: "aside", classes: ["rail"] });
  const sibling = makeEl({ tag: "article", classes: ["post"] });
  const parent = makeEl({ tag: "main", id: "content", children: [target, sibling] });
  const doc = makeDoc({
    "aside.rail": [target, makeEl({ tag: "aside" })],
    ".rail": [target, makeEl({ tag: "aside" })],
    "#content": [parent],
    "#content aside.rail": [target],
  });
  assert.equal(generateSelector(target, doc), "#content aside.rail");
});

test("generateSelector should escape class names containing CSS-special characters such as Tailwind md:flex", () => {
  const el = makeEl({ tag: "div", classes: ["md:flex"] });
  const doc = makeDoc({ "div.md\\:flex": [el] });
  assert.equal(generateSelector(el, doc), "div.md\\:flex");
});

test("matchCount should report how many elements a selector matches", () => {
  const doc = makeDoc({ ".promo": [makeEl(), makeEl(), makeEl()] });
  assert.equal(matchCount(".promo", doc), 3);
});

test("matchCount should report zero for a selector that is syntactically invalid", () => {
  const doc = {
    querySelectorAll() {
      throw new Error("invalid selector");
    },
  };
  assert.equal(matchCount("div..broken", doc), 0);
});

test("isValidSelector should reject a syntactically invalid selector", () => {
  const doc = {
    querySelectorAll() {
      throw new Error("invalid selector");
    },
  };
  assert.equal(isValidSelector("div..broken", doc), false);
});

test("isValidSelector should accept a well-formed selector", () => {
  assert.equal(isValidSelector(".promo", makeDoc({ ".promo": [] })), true);
});

test("isValidSelector should reject an empty or whitespace-only selector", () => {
  const doc = makeDoc();
  assert.equal(isValidSelector("   ", doc), false);
});

void makeTree;
