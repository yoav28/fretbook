import { pitchClassName } from "../fretboard";

type StaffLine = { y: number; x: number; width: number };

function tuningStaff(lines: StaffLine[], count: number, notation: boolean): StaffLine[] {
  const matches: StaffLine[][] = [];
  for (let start = 0; start <= lines.length - count; start += 1) {
    const candidate = lines.slice(start, start + count);
    const gaps = candidate.slice(1).map((line, index) => line.y - candidate[index].y);
    const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (average < 4 || average > 40) continue;
    if (Math.max(...gaps) - Math.min(...gaps) > Math.max(2, average * 0.16)) continue;
    const previous = start > 0 ? candidate[0].y - lines[start - 1].y : Infinity;
    const next =
      start + count < lines.length ? lines[start + count].y - candidate[count - 1].y : Infinity;
    if (Math.abs(previous - average) <= average * 0.16) continue;
    if (Math.abs(next - average) <= average * 0.16) continue;
    matches.push(candidate);
  }
  return matches[notation ? 1 : 0] ?? [];
}

export function renderTuningLabels(host: HTMLElement, tuning: number[], notation: boolean): void {
  if (tuning.length < 2) return;
  const svg = host.querySelector<SVGSVGElement>("svg.at-surface-svg");
  if (!svg) return;
  svg.querySelector("[data-tuning-labels]")?.remove();

  const width = Number.parseFloat(svg.getAttribute("width") ?? "0");
  if (!width) return;
  const rows = new Map<number, StaffLine>();
  for (const rect of svg.querySelectorAll("rect")) {
    const bounds = rect.getBBox();
    if (bounds.height > 4 || bounds.width < 24) continue;
    const y = Math.round((bounds.y + bounds.height / 2) * 2) / 2;
    const line = rows.get(y) ?? { y, x: bounds.x, width: 0 };
    line.x = Math.min(line.x, bounds.x);
    line.width += bounds.width;
    rows.set(y, line);
  }

  const lines = [...rows.values()]
    .filter((line) => line.width >= width * 0.3)
    .sort((left, right) => left.y - right.y);
  const staff = tuningStaff(lines, tuning.length, notation);
  if (!staff.length) return;

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("data-tuning-labels", "true");
  group.setAttribute("aria-hidden", "true");
  const fontSize = Math.min(20, (staff[1]?.y ?? staff[0].y + 20) - staff[0].y);
  for (let index = 0; index < staff.length; index += 1) {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(staff[index].x - 8));
    label.setAttribute("y", String(staff[index].y));
    label.setAttribute("fill", "#8e8e93");
    label.setAttribute("font-family", "Inter, sans-serif");
    label.setAttribute("font-size", String(fontSize));
    label.setAttribute("text-anchor", "end");
    label.setAttribute("dominant-baseline", "middle");
    label.textContent = pitchClassName(tuning[index]);
    group.append(label);
  }
  svg.append(group);
}
