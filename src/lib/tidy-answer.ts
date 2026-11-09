// RGA wraps its answer in headings ("## Gyarados Weaknesses"), extra sections ("**Evolution chart:**" plus a
// list), quoted evidence and filler about its sources ("Based on the provided documentation, …"). The answer box
// shows only the main answer, the first section:
//   1. Drop the opening heading, if any.
//   2. Stop at the next heading or stand-alone bold label: everything after it is a separate section.
//   3. Drop quoted evidence lines and sentences about the documentation; the citations already show the sources.
const HEADING = /^\s{0,3}#{1,6}\s/;
const BOLD_LABEL = /^\s*\*\*[^*]+\*\*:?\s*$/; // a line that is only "**Evolution chart:**"
// A line that is only a quotation, optionally labeled: `"…"`, `> "…"`, `- Documentation: "…"`.
const QUOTE = /^\s*(?:>|[-*]\s+)?(?:(?:documentation|source|quote|evidence|excerpt)\s*:\s*)?["“].*["”]\s*$/i;
const FILLER =
  /\b(?:provided|the|these|this|those) (?:documentation|documents?|sources?|context|information|excerpts?|passages?|snippets?)\b/i;
const LIST_LINE = /^\s*(?:[-*+]|\d+[.)])\s+|^\s{2,}\S/;
const LEAD_IN =
  /^(\s*(?:[-*]\s+)?)(?:based on|according to) (?:the )?(?:provided )?(?:documentation|documents|sources|information|context)[^,:]*[,:]\s*(.)/i;

export function tidyAnswer(markdown: string): string {
  const lines = markdown.split("\n");

  // 1–2. Keep the first section only.
  const start = lines.findIndex((line) => line.trim() !== "");
  const body = start !== -1 && HEADING.test(lines[start]) ? lines.slice(start + 1) : lines.slice(Math.max(start, 0));
  const firstContent = body.findIndex((line) => line.trim() !== "");
  const nextSection = body.findIndex((line, i) => i > firstContent && (HEADING.test(line) || BOLD_LABEL.test(line)));
  const section = nextSection === -1 ? body : body.slice(0, nextSection);

  // 3. Remove evidence and filler.
  const cleaned = section
    .filter((line) => !QUOTE.test(line))
    // Nested list details ("  - Type: Fire") repeat what the cited Pokémon's description shows; keep top-level items.
    .filter((line) => !/^\s{2,}\S/.test(line))
    .map((line) => line.replace(LEAD_IN, (_, lead: string, first: string) => lead + first.toUpperCase()))
    .map((line) =>
      line
        .split(/(?<=[.!?:])\s+/)
        .filter((sentence) => !FILLER.test(sentence))
        .join(" "),
    );

  // 4. The answer itself is the first paragraph, plus the list that directly follows it ("…are:" + items).
  //    Later paragraphs are commentary or text copied from the page ("The ranges shown on the right…").
  const blocks = cleaned
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+$/, ""))
    .filter((block) => block.trim() !== "");
  const isList = (block: string) => block.split("\n").every((line) => LIST_LINE.test(line));
  const kept = blocks.slice(0, 1);
  for (const block of blocks.slice(1)) {
    if (!isList(block)) break;
    kept.push(block);
  }
  return kept.join("\n\n").trim();
}
