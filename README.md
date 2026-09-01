# Element Zapper

Hides elements you never want to see, per site, using CSS selectors you pick yourself.

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and choose this folder
4. Pin the extension so its icon stays in the toolbar

## Use

Open the popup on any site:

- **🎯 Pick element on page** — click the thing you want gone. Stays active so you can zap several in a row; `↑`/`↓` grow or shrink the selection before you click, `Esc` finishes.
- **Type a selector** — paste one from DevTools. The popup shows a live match count and highlights the matches on the page before you commit.
- **Enabled on this site** — toggle every rule for the current domain off and back on without deleting anything.

Rules are keyed by domain (`www.` is stripped, so `example.com` and `www.example.com` share rules) and stored in `chrome.storage.sync`, so they follow your Chrome profile across machines.

## How hiding works

Rules are applied as an injected stylesheet — one `display: none !important` rule per selector — rather than by removing DOM nodes. That means:

- Re-renders can't undo it, so no `MutationObserver` fighting the page's render loop
- It applies at `document_start`, so there's no flash of the element before it disappears
- Toggling a site off restores the page instantly, no reload

One selector per CSS rule keeps a malformed selector from taking the rest of the rules down with it.

## Selector generation

`src/selector.js` turns a clicked element into a selector that should survive a reload. It prefers, in order: a stable `id`, a whitelisted attribute (`data-testid`, `aria-label`, …), then class combinations, then a descendant path with `:nth-of-type` anchored on the nearest stable ancestor.

It deliberately skips generated names that change on every deploy — `css-1x2y3z` (emotion), `sc-bdVaJa` (styled-components), `Button_root__2xY3z` (CSS modules), `ember1234`, `:r3:` (React `useId`) — and transient state classes like `active` or `is-open`.

## Tests

```
npm test
```

Unit tests cover the selector logic, which is the only part with real branching. No dependencies — Node's built-in test runner and hand-built DOM fixtures.
