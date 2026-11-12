<script lang="ts">
  import type { Snippet } from "svelte";

  // Shown on hover. Rendered only while visible so a
  // resting page does not carry a stack of hidden tooltips.
  let {
    text,
    placement = "below",
    children,
  }: {
    text: string;
    placement?: "above" | "below";
    children: Snippet<[string]>;
  } = $props();

  const tipId = `tip-${Math.random().toString(36).slice(2, 8)}`;
  let open = $state(false);
  let touchActive = false;

  function canHover(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return true;
    }
    return !window.matchMedia("(hover: none)").matches;
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === "touch") {
      touchActive = true;
      open = false;
    } else {
      touchActive = false;
    }
  }

  function handlePointerUp(event: PointerEvent) {
    if (event.pointerType === "touch") {
      open = false;
    }
  }

  function handlePointerCancel(event: PointerEvent) {
    if (event.pointerType === "touch") {
      open = false;
    }
  }

  function handleTouchStart() {
    touchActive = true;
    open = false;
  }

  function handleTouchEnd() {
    open = false;
  }

  function handlePointerEnter(event: PointerEvent) {
    if (event.pointerType === "touch" || !canHover()) {
      return;
    }
    touchActive = false;
    open = true;
  }

  function handlePointerLeave(event: PointerEvent) {
    if (event.pointerType === "touch") {
      open = false;
      return;
    }
    open = false;
  }

  function handleMouseEnter(event: MouseEvent) {
    if (!canHover() || touchActive) {
      return;
    }
    if ("pointerType" in event && (event as PointerEvent).pointerType === "touch") {
      return;
    }
    open = true;
  }

  function handleMouseLeave() {
    open = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      open = false;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class="tip"
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  onpointerenter={handlePointerEnter}
  onpointerleave={handlePointerLeave}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onkeydown={handleKeyDown}
>
  {@render children(open ? tipId : "")}
  {#if open}
    <span class="bubble {placement}" id={tipId} role="tooltip">{text}</span>
  {/if}
</span>

<style>
  .tip {
    position: relative;
    display: inline-flex;
    max-width: 100%;
  }

  .bubble {
    position: absolute;
    z-index: 70;
    left: 50%;
    width: max-content;
    max-width: 16rem;
    padding: var(--sp-1) var(--sp-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--r-sm);
    background: var(--surface);
    box-shadow: var(--shadow-md);
    color: var(--text);
    font-size: var(--fs-xs);
    font-weight: 600;
    line-height: 1.4;
    pointer-events: none;
    transform: translateX(-50%);
  }

  .below {
    top: calc(100% + var(--sp-2));
  }

  .above {
    bottom: calc(100% + var(--sp-2));
  }

</style>
