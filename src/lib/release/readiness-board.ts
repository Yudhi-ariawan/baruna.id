// Turns dokumen/KESIAPAN_RILIS.md into the board shown on /kesiapanrilis, so the
// page follows the document without a second copy. Rules (also written at the top
// of the document):
//   "## A. ..." items -> "Yang sudah dikerjakan", or "Test manual sudah bisa" when
//                        the item says it was "diuji manual oleh ..."
//   "## B. ..." items -> "Yang belum dikerjakan" (struck-through "~~x~~ SELESAI" -> done)
//   "## E. ..." items -> "Bug"
//   "## Kesimpulan"   -> summary above the board; other sections -> details below.
// An item is a top-level "- " line plus its indented lines; "**Title (meta):**" at the
// start becomes the card title and its tag.

export type BoardCard = { id: string; title: string; meta: string | null; body: string };
export type BoardColumnKey = "todo" | "done" | "manual" | "bug";
export type BoardColumn = { key: BoardColumnKey; label: string; hint: string; cards: BoardCard[] };
export type ReadinessBoard = {
  title: string;
  summary: string;
  columns: BoardColumn[];
  details: Array<{ heading: string; markdown: string }>;
};

const MANUAL = /diuji manual oleh|sudah diuji manual/i;

type Section = { heading: string; lines: string[] };

function splitSections(md: string): { title: string; preamble: string[]; sections: Section[] } {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  const preamble: string[] = [];
  const sections: Section[] = [];
  for (const line of lines) {
    if (!title && /^# /.test(line)) { title = line.slice(2).trim(); continue; }
    const h = /^## (.+)$/.exec(line);
    if (h) { sections.push({ heading: h[1].trim(), lines: [] }); continue; }
    (sections.length ? sections[sections.length - 1].lines : preamble).push(line);
  }
  return { title, preamble, sections };
}

function items(lines: string[]): string[] {
  const out: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (/^- /.test(line)) { current = [line.slice(2)]; out.push(current); }
    else if (current && /^\s+\S/.test(line)) current.push(line.replace(/^ {2}/, ""));
    else if (line.trim() !== "") current = null; // a paragraph ends the list
  }
  return out.map((x) => x.join("\n").trim());
}

function toCard(text: string, id: string): { card: BoardCard; struckDone: boolean } {
  let title: string;
  let rest: string;
  let struckDone = false;
  const struck = /^~~(.+?)~~\s*\*\*(.+?)\*\*\s*/.exec(text);
  const bold = /^\*\*(.+?)\*\*\s*/.exec(text);
  if (struck) {
    title = `${struck[1].trim()} (${struck[2].replace(/:$/, "").trim()})`;
    rest = text.slice(struck[0].length);
    struckDone = true;
  } else if (bold) {
    title = bold[1].replace(/:$/, "").trim();
    rest = text.slice(bold[0].length);
  } else {
    const first = text.split("\n")[0];
    title = first.length > 90 ? `${first.slice(0, 87).trimEnd()}…` : first;
    rest = first.length > 90 ? text : text.split("\n").slice(1).join("\n");
  }
  rest = rest.replace(/^:\s*/, "").trim();
  let meta: string | null = null;
  const m = /^(.*?)\s*\((.+)\)$/.exec(title);
  if (m && m[1]) { title = m[1].trim(); meta = m[2].trim(); }
  return { card: { id, title, meta, body: rest }, struckDone };
}

export function parseReadiness(md: string): ReadinessBoard {
  const { title, preamble, sections } = splitSections(md);
  const columns: Record<BoardColumnKey, BoardColumn> = {
    todo: { key: "todo", label: "Yang belum dikerjakan", hint: "Bagian B: belum diperbaiki atau menunggu keputusan", cards: [] },
    done: { key: "done", label: "Yang sudah dikerjakan", hint: "Bagian A: sudah diperbaiki dan diuji otomatis", cards: [] },
    manual: { key: "manual", label: "Test manual sudah bisa", hint: "Bagian A yang sudah diuji manual di browser", cards: [] },
    bug: { key: "bug", label: "Bug", hint: "Bagian E: bug dan celah yang diketahui", cards: [] },
  };
  const summary: string[] = [preamble.join("\n").trim()];
  const details: ReadinessBoard["details"] = [];

  sections.forEach((s) => {
    const letter = /^([A-Z])\.\s/.exec(s.heading)?.[1];
    const list = items(s.lines);
    if (letter === "A") {
      list.forEach((t, i) => columns[MANUAL.test(t) ? "manual" : "done"].cards.push(toCard(t, `a${i}`).card));
    } else if (letter === "B") {
      list.forEach((t, i) => {
        const { card, struckDone } = toCard(t, `b${i}`);
        columns[struckDone ? "done" : "todo"].cards.push(card);
      });
    } else if (letter === "E") {
      list.forEach((t, i) => columns.bug.cards.push(toCard(t, `e${i}`).card));
    } else if (/^kesimpulan/i.test(s.heading)) {
      summary.push(s.lines.join("\n").trim());
    } else if (s.lines.join("").trim()) {
      details.push({ heading: s.heading, markdown: s.lines.join("\n").trim() });
    }
  });

  return {
    title,
    summary: summary.filter(Boolean).join("\n\n"),
    columns: [columns.todo, columns.done, columns.manual, columns.bug],
    details,
  };
}
