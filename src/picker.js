(function (root) {
  "use strict";

  const CONTAINER_ID = "element-zapper-picker";
  const Z_INDEX = "2147483647";

  let container = null;
  let box = null;
  let label = null;
  let toast = null;
  let target = null;
  let session = null;

  function buildOverlay() {
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    Object.assign(container.style, {
      position: "fixed",
      inset: "0",
      zIndex: Z_INDEX,
      pointerEvents: "none",
      cursor: "crosshair",
    });

    box = document.createElement("div");
    Object.assign(box.style, {
      position: "fixed",
      border: "2px solid #2f7bff",
      background: "rgba(47, 123, 255, 0.18)",
      borderRadius: "2px",
      pointerEvents: "none",
      transition: "all 40ms linear",
      display: "none",
    });

    label = document.createElement("div");
    Object.assign(label.style, {
      position: "fixed",
      maxWidth: "min(520px, 90vw)",
      padding: "6px 9px",
      background: "#12172b",
      color: "#f4f6ff",
      font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
      borderRadius: "5px",
      boxShadow: "0 4px 14px rgba(0,0,0,.35)",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "none",
    });

    toast = document.createElement("div");
    Object.assign(toast.style, {
      position: "fixed",
      left: "50%",
      bottom: "24px",
      transform: "translateX(-50%)",
      padding: "9px 14px",
      background: "#12172b",
      color: "#f4f6ff",
      font: "13px/1.4 system-ui, -apple-system, sans-serif",
      borderRadius: "7px",
      boxShadow: "0 6px 20px rgba(0,0,0,.4)",
      pointerEvents: "none",
      opacity: "0",
      transition: "opacity 160ms ease",
    });

    container.append(box, label, toast);
    (document.body || document.documentElement).appendChild(container);
  }

  function isOverlay(node) {
    return Boolean(node && container && (node === container || container.contains(node)));
  }

  function showToast(text, duration = 2200) {
    if (!toast) return;
    toast.textContent = text;
    toast.style.opacity = "1";
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.style.opacity = "0";
    }, duration);
  }

  function render() {
    if (!target || !target.getBoundingClientRect) return;
    const rect = target.getBoundingClientRect();

    box.style.display = "block";
    box.style.top = `${rect.top}px`;
    box.style.left = `${rect.left}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;

    const selector = EZSelector.generateSelector(target, document);
    const count = EZSelector.matchCount(selector, document);
    label.style.display = "block";
    label.textContent = `${selector}  ·  ${count} match${count === 1 ? "" : "es"}`;

    const labelTop = rect.top > 30 ? rect.top - 28 : rect.bottom + 6;
    label.style.top = `${Math.max(4, labelTop)}px`;
    label.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 240))}px`;
  }

  function setTarget(next) {
    if (!next || isOverlay(next) || next === document.documentElement) return;
    target = next;
    render();
  }

  function onMouseMove(event) {
    setTarget(event.target);
  }

  function onScroll() {
    render();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      stop();
      return;
    }
    if (event.key === "ArrowUp" && target && target.parentElement) {
      event.preventDefault();
      setTarget(target.parentElement);
      return;
    }
    if (event.key === "ArrowDown" && target && target.children.length) {
      event.preventDefault();
      setTarget(target.children[0]);
    }
  }

  async function onClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!target) return;

    const selector = EZSelector.generateSelector(target, document);
    const count = EZSelector.matchCount(selector, document);
    if (!selector) {
      showToast("Could not build a selector for that element");
      return;
    }

    await session.onPicked(selector);
    showToast(`Hiding ${selector} · ${count} element${count === 1 ? "" : "s"} · Esc to finish`);
    target = null;
    box.style.display = "none";
    label.style.display = "none";
  }

  function start(options) {
    if (session) return;
    session = options;
    buildOverlay();

    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);

    showToast("Click an element to hide it · ↑ ↓ to resize selection · Esc to finish", 4000);
  }

  function stop() {
    if (!session) return;
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("scroll", onScroll, true);

    container.remove();
    container = box = label = toast = target = session = null;
  }

  function flash(selector) {
    let matches;
    try {
      matches = document.querySelectorAll(selector);
    } catch (error) {
      return;
    }
    for (const el of matches) {
      const previous = el.style.outline;
      el.style.outline = "2px solid #2f7bff";
      setTimeout(() => {
        el.style.outline = previous;
      }, 900);
    }
  }

  root.EZPicker = { start, stop, flash };
})(typeof globalThis !== "undefined" ? globalThis : this);
