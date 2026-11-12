import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SongDetail } from "../lib/types";
import { ui } from "../lib/ui.svelte";
import SongHeader from "./SongHeader.svelte";

const mockSetSongTags = vi.fn();
const mockSetFavourite = vi.fn();
const mockDeleteSong = vi.fn();
const mockListSongs = vi.fn();

vi.mock("../lib/api", () => ({
  setSongTags: (...args: unknown[]) => mockSetSongTags(...args),
  setFavourite: (...args: unknown[]) => mockSetFavourite(...args),
  deleteSong: (...args: unknown[]) => mockDeleteSong(...args),
  listSongs: (...args: unknown[]) => mockListSongs(...args),
  listTags: vi.fn().mockResolvedValue([]),
  getFacets: vi.fn().mockResolvedValue({ keys: [], genres: [] }),
  listLibraries: vi.fn().mockResolvedValue([]),
  listShares: vi.fn().mockResolvedValue([]),
}));

const song = {
  id: "s1",
  title: "Riff",
  artist: "Band",
  content_kind: "tab",
  favourite: false,
  tags: ["funk"],
  key: "Em",
  key_detected: false,
  cover_url: null,
  preferred_track_id: "t1",
  difficulty_tracks: [{ track_id: "t1", name: "Bass", level: 0.3, factors: [] }],
} as unknown as SongDetail;

function props(overrides: Record<string, unknown> = {}) {
  return { song, eyebrow: "Bass", onsetlist: vi.fn(), exportItems: [], ...overrides };
}

describe("SongHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ui.demoMode = false;
    ui.tagList = [];
    mockListSongs.mockResolvedValue({
      items: [],
      total: 0,
      next_cursor: null,
      counts: { all: 0, bass: 0, electric: 0, acoustic: 0, chords: 0, favourites: 0 },
    });
  });

  it("puts the instrument and artist above the title, then the facts and key", () => {
    render(SongHeader, props({ facts: [{ label: "240 BPM" }], factsAfter: [{ label: "4 bars" }] }));
    expect(screen.getByTestId("song-heading")).toHaveTextContent("Riff");
    expect(screen.getByText("Bass · Band")).toBeInTheDocument();
    const facts = screen.getByTestId("song-key").parentElement as HTMLElement;
    expect(facts.textContent).toMatch(/240 BPM.*E minor.*4 bars/);
    expect(screen.queryByTestId("song-level")).toBeNull();
  });

  it("stars and unstars the song", async () => {
    mockSetFavourite.mockResolvedValue(true);
    render(SongHeader, props());
    const star = screen.getByTestId("song-favourite");
    expect(star).toHaveAttribute("aria-pressed", "false");
    await fireEvent.click(star);
    await waitFor(() => expect(star).toHaveAttribute("aria-pressed", "true"));
    expect(mockSetFavourite).toHaveBeenCalledWith("s1", true);
  });

  it("adds a tag and shows what the server stored", async () => {
    mockSetSongTags.mockResolvedValue(["funk", "slap"]);
    render(SongHeader, props());
    await fireEvent.click(screen.getByTestId("song-tag-new"));
    await fireEvent.input(screen.getByTestId("song-tag-input"), { target: { value: "slap" } });
    await fireEvent.submit(screen.getByTestId("song-tag-input").closest("form") as HTMLFormElement);
    await waitFor(() => expect(mockSetSongTags).toHaveBeenCalledWith("s1", ["funk", "slap"]));
    await waitFor(() => expect(screen.getAllByTestId("song-tag")).toHaveLength(2));
  });

  it("explains a failed tag save", async () => {
    mockSetSongTags.mockRejectedValue(new Error("nope"));
    render(SongHeader, props());
    await fireEvent.click(screen.getByTestId("song-tag-remove"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("nope"));
  });

  it("keeps Transpose and Edit direct and Delete in the overflow menu", async () => {
    render(SongHeader, props({ onretune: vi.fn(), ontuner: vi.fn() }));
    expect(screen.getByTestId("song-retune")).toHaveTextContent("Transpose");
    expect(screen.getByTestId("song-edit-link")).toBeInTheDocument();
    expect(screen.queryByTestId("song-tuner")).toBeNull();

    await fireEvent.click(screen.getByTestId("song-more"));
    expect(screen.getByTestId("song-delete")).toBeInTheDocument();
    expect(screen.queryByTestId("export-open")).toBeNull();
    const items = screen.getAllByRole("menuitem");
    expect(items[items.length - 1]).toHaveAttribute("data-testid", "song-delete");
  });

  it("deletes the song after a confirmation", async () => {
    mockDeleteSong.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(SongHeader, props());
    await fireEvent.click(screen.getByTestId("song-more"));
    await fireEvent.click(screen.getByTestId("song-delete"));
    expect(mockDeleteSong).not.toHaveBeenCalled();

    confirmSpy.mockReturnValueOnce(true);
    await fireEvent.click(screen.getByTestId("song-more"));
    await fireEvent.click(screen.getByTestId("song-delete"));
    await waitFor(() => expect(mockDeleteSong).toHaveBeenCalledWith("s1"));
    confirmSpy.mockRestore();
  });

  it("hides every account action on an anonymous share link", () => {
    render(SongHeader, props({ readOnly: true, shared: true, onretune: vi.fn() }));
    expect(screen.queryByTestId("song-favourite")).toBeNull();
    expect(screen.getByTestId("song-retune")).toBeInTheDocument();
    expect(screen.queryByTestId("song-edit-link")).toBeNull();
    expect(screen.queryByTestId("song-delete")).toBeNull();
  });

  it("keeps transpose for a read-only viewer and hides editing actions", () => {
    render(SongHeader, props({ readOnly: true, onretune: vi.fn() }));
    // The star and tags are saved on the song, which the server only lets an editor change.
    expect(screen.queryByTestId("song-favourite")).toBeNull();
    expect(screen.queryByTestId("song-tag-new")).toBeNull();
    expect(screen.getByTestId("song-retune")).toBeTruthy();
    expect(screen.queryByTestId("song-edit-link")).toBeNull();
    expect(screen.queryByTestId("song-delete")).toBeNull();
  });
});
