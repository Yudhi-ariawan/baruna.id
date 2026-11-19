// CMS text is written by content managers, not programmers: every new line they type
// should stay a new line. Plain markdown joins lines (a line typed right after a list
// becomes part of the last item; two lines without a blank line become one paragraph).
// This turns the typed lines into the markdown that shows them as typed:
// - a line that follows a list item but is not one itself starts a new paragraph;
// - a list that follows a paragraph line starts its own list;
// - consecutive plain lines keep their line break.
// Indented lines (continuation of a list item) are left as they are.
const LIST = /^\s*([-*+]|\d{1,3}[.)])\s+/;

export function cmsMarkdownLines(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = out.length ? out[out.length - 1] : "";
    const blank = line.trim() === "";
    const prevBlank = prev.trim() === "";
    if (!blank && !prevBlank) {
      const isList = LIST.test(line);
      const prevList = LIST.test(prev);
      const indented = /^\s/.test(line);
      if (prevList && !isList && !indented) out.push("");
      else if (!prevList && isList) out.push("");
      else if (!prevList && !isList) out[out.length - 1] = prev.replace(/\s*$/, "") + "  ";
    }
    out.push(line);
  }
  return out.join("\n");
}
