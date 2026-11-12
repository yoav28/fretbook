import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FirstRun from "./FirstRun.svelte";
import { ui } from "../lib/ui.svelte";

const mockSaveSettings = vi.fn();

vi.mock("../lib/api", () => ({
  saveSettings: (...args: unknown[]) => mockSaveSettings(...args),
}));

const presets = [
  { id: "bass-4", label_key: "x", label: "4-string bass", family: "bass" },
  { id: "guitar-6", label_key: "y", label: "6-string guitar", family: "guitar" },
];

describe("FirstRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ui.presets = presets as typeof ui.presets;
    ui.defaultInstrument = "bass-4";
    ui.sheet = "";
    mockSaveSettings.mockResolvedValue({ default_instrument: "guitar-6" });
  });

  it("opens the add sheet from the empty-library welcome", async () => {
    render(FirstRun);
    await fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(ui.sheet).toBe("add");
  });

  it("saves the chosen default instrument", async () => {
    render(FirstRun);
    const instrument = screen.getByRole("combobox", { name: "Default instrument" });
    await fireEvent.change(instrument, { target: { value: "guitar-6" } });
    expect(mockSaveSettings).toHaveBeenCalledWith({ default_instrument: "guitar-6" });
    expect(instrument).toHaveValue("guitar-6");
  });

  it("explains when saving the default instrument fails", async () => {
    mockSaveSettings.mockRejectedValueOnce(new Error("boom"));
    render(FirstRun);
    await fireEvent.change(screen.getByRole("combobox", { name: "Default instrument" }), {
      target: { value: "guitar-6" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
