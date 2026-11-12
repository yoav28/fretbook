import { afterEach, describe, expect, it } from "vitest";

import { ownsPlayerKey } from "../lib/playerKeyboard";

function owns(target: HTMLElement, init: KeyboardEventInit = {}, prevented = false): boolean {
  const event = new KeyboardEvent("keydown", {
    key: " ",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  if (prevented) event.preventDefault();
  let result = false;
  const listener = (received: Event) => {
    result = ownsPlayerKey(received as KeyboardEvent);
  };
  document.addEventListener("keydown", listener, { once: true });
  target.dispatchEvent(event);
  return result;
}

function mount(tag: string, attributes: Record<string, string | undefined> = {}): HTMLElement {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined) element.setAttribute(name, value);
  }
  document.body.append(element);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("player keyboard ownership", () => {
  it.each([
    ["input", { type: "text" }],
    ["input", { type: "range" }],
    ["textarea", {}],
    ["select", {}],
    ["button", {}],
    ["a", { href: "#" }],
    ["div", { role: "tab" }],
    ["div", { role: "radio" }],
    ["div", { role: "slider" }],
    ["div", { contenteditable: "true" }],
  ] as const)("preserves native keys on %s %o", (tag, attributes) => {
    const target = mount(tag, attributes);
    expect(owns(target)).toBe(false);
    expect(owns(target, { key: "ArrowRight" })).toBe(false);
  });

  it.each([{ role: "dialog" }, { "aria-modal": "true" }, { role: "button" }])(
    "preserves keys from descendants of %o",
    (attributes) => {
      const container = mount("div", attributes);
      const child = document.createElement("span");
      container.append(child);
      expect(owns(child)).toBe(false);
    },
  );

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }])(
    "does not claim composing or modified shortcuts %o",
    (init) => {
      expect(owns(document.body, init)).toBe(false);
    },
  );

  it("respects a key already handled by another control", () => {
    expect(owns(document.body, {}, true)).toBe(false);
  });

  it("allows ordinary shortcuts from the body and the focused score region", () => {
    expect(owns(document.body)).toBe(true);
    const score = mount("div", { role: "region", tabindex: "0" });
    expect(owns(score, { key: "ArrowRight" })).toBe(true);
    expect(owns(score, { key: "?", shiftKey: true })).toBe(true);
  });
});
