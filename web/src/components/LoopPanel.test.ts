import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { defaultPractice } from "../lib/practice";
import LoopPanel from "./LoopPanel.svelte";

describe("LoopPanel", () => {
  it("renders loop buttons and triggers onsetloop and onclearloop", async () => {
    const practice = defaultPractice();
    const onsetloop = vi.fn();
    const onclearloop = vi.fn();
    const onchange = vi.fn();
    const onjump = vi.fn();

    render(LoopPanel, {
      props: {
        practice,
        loopA: null,
        loopB: null,
        onsetloop,
        onclearloop,
        onchange,
        onjump,
      },
    });

    expect(screen.getByRole("button", { name: "Set start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set end" })).toBeInTheDocument();
    expect(screen.getByTestId("loop-instructions")).toHaveTextContent("Seek to the first bar");
    await fireEvent.click(screen.getByTestId("player-loop-a"));
    expect(onsetloop).toHaveBeenCalledWith("a");

    await fireEvent.click(screen.getByTestId("player-loop-b"));
    expect(onsetloop).toHaveBeenCalledWith("b");

    expect(screen.getByTestId("player-clear-loop")).toBeDisabled();
  });

  it("allows saving a named loop and jumping to it", async () => {
    const practice = defaultPractice();
    const onsetloop = vi.fn();
    const onclearloop = vi.fn();
    const onchange = vi.fn();
    const onjump = vi.fn();

    render(LoopPanel, {
      props: {
        practice,
        loopA: 4,
        loopB: 8,
        onsetloop,
        onclearloop,
        onchange,
        onjump,
      },
    });

    expect(screen.getByTestId("current-loop-range")).toHaveTextContent("Bars 5–9");
    expect(screen.getByTestId("loop-instructions")).toHaveTextContent("adjust this range");
    const nameInput = screen.getByLabelText("Loop name");
    await fireEvent.input(nameInput, { target: { value: "Solo riff" } });

    await fireEvent.click(screen.getByTestId("save-loop-button"));

    expect(practice.loops).toHaveLength(1);
    expect(practice.loops[0].name).toBe("Solo riff");
    expect(practice.loops[0].a).toBe(4);
    expect(practice.loops[0].b).toBe(8);
    expect(onchange).toHaveBeenCalled();
    expect(onjump).toHaveBeenCalledWith(practice.loops[0]);
  });

  it("renders saved loops, handles jump and delete", async () => {
    const practice = defaultPractice();
    practice.loops = [{ id: "loop-1", name: "Solo", a: 10, b: 20 }];
    const onsetloop = vi.fn();
    const onclearloop = vi.fn();
    const onchange = vi.fn();
    const onjump = vi.fn();

    render(LoopPanel, {
      props: {
        practice,
        loopA: 10,
        loopB: 20,
        onsetloop,
        onclearloop,
        onchange,
        onjump,
      },
    });

    expect(screen.getByTestId("saved-loop-loop-1")).toBeInTheDocument();

    await fireEvent.click(screen.getByTestId("jump-loop-loop-1"));
    expect(onjump).toHaveBeenCalledWith(practice.loops[0]);

    await fireEvent.click(screen.getByRole("button", { name: "Delete loop Solo" }));
    expect(practice.loops).toHaveLength(0);
    expect(onchange).toHaveBeenCalled();
  });
});
