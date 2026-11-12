import { isTyping } from "./handsFree.svelte";

export function ownsPlayerKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
    return false;
  const target = event.target instanceof Element ? event.target : null;
  if (isTyping(target as HTMLElement | null)) return false;
  return !target?.closest(
    'button, a, input, select, textarea, [contenteditable], [role="button"], [role="radio"], [role="tab"], [role="slider"], [role="menuitem"], [role="dialog"], [aria-modal="true"]',
  );
}
