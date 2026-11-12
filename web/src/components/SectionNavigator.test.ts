import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { sectionMarks } from "../lib/playerSheet";
import SectionNavigator from "./SectionNavigator.svelte";

const marks = sectionMarks(
  [{ section: "Intro" }, {}, { section: "Chorus" }, {}],
  [0, 1, 2, 3, 0, 1, 2, 3],
);

describe("SectionNavigator", () => {
  it("distinguishes repeated sections and seeks their played-bar index", async () => {
    const onseek = vi.fn();
    render(SectionNavigator, { props: { marks, current: 0, onseek } });

    expect(screen.getByRole("option", { name: "Intro · Bar 1" })).toHaveValue("0");
    expect(screen.getByRole("option", { name: "Intro · Bar 5" })).toHaveValue("4");
    const select = screen.getByRole("combobox", { name: "Jump to section" });
    await fireEvent.change(select, { target: { value: "6" } });

    expect(onseek).toHaveBeenCalledExactlyOnceWith(6);
  });

  it("follows the section containing the current played bar across repeats and backward seeks", async () => {
    const onseek = vi.fn();
    const view = render(SectionNavigator, { props: { marks, current: 3, onseek } });
    const select = screen.getByRole("combobox", { name: "Jump to section" });
    expect(select).toHaveValue("2");

    await view.rerender({ marks, current: 5, onseek });
    expect(select).toHaveValue("4");
    await view.rerender({ marks, current: 7, onseek });
    expect(select).toHaveValue("6");
    await view.rerender({ marks, current: 1, onseek });
    expect(select).toHaveValue("0");
    expect(onseek).not.toHaveBeenCalled();
  });

  it("shows a prompt before the first section and omits empty navigation", async () => {
    const onseek = vi.fn();
    const view = render(SectionNavigator, {
      props: { marks: [{ index: 4, label: "Verse" }], current: 0, onseek },
    });
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByRole("option", { name: "Jump to section" })).toBeDisabled();

    await view.rerender({ marks: [], current: 0, onseek });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
