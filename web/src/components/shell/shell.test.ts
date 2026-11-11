import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import SideNav from "./SideNav.svelte";

describe("app shell navigation", () => {
  it("shows the library and add action", () => {
    render(SideNav);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(Array.from(nav.querySelectorAll("a")).map((link) => link.dataset.testid)).toEqual([
      "nav-library",
    ]);
    expect(screen.getByTestId("add-song")).toBeInTheDocument();
  });
});
