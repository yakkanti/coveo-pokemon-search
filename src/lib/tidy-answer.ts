// RGA wraps its answer in headings ("## Gyarados Weaknesses"), extra sections ("**Evolution chart:**" plus a
// list), quoted evidence and filler about its sources ("Based on the provided documentation, …"). The answer box
// shows only the main answer; the cited Pokémon's descriptions follow it.
//   1. Drop the opening heading, if any.
//   2. If the answer is a series of sub-headings ("### Charmander", "### Litten"…), turn them into a list of
//      names. Otherwise stop at the next heading or stand-alone bold label.
//   3. Remove filler phrases about the documentation and quoted evidence lines; the citations show the sources.
//   4. Keep the first paragraph plus the list that directly follows it.
//   5. Never return an empty answer: fall back to the text without headings.
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const BOLD_LABEL = /^\s*\*\*[^*]+\*\*:?\s*$/; // a line that is only "**Evolution chart:**"
// A line that is only a quotation, optionally labeled: `"…"`, `> "…"`, `- Documentation: "…"`.
const QUOTE = /^\s*(?:>|[-*]\s+)?(?:(?:documentation|source|quote|evidence|excerpt)\s*:\s*)?["“].*["”]\s*$/i;
const SOURCES = String.raw`(?:documentation|documents?|sources?|context|information|excerpts?|passages?|snippets?)`;
// "Based on the provided documentation, X…" → "X…"
const LEAD_IN = new RegExp(String.raw`^(\s*(?:[-*]\s+)?)(?:based on|according to|as per) (?:the )?(?:provided )?${SOURCES}[^,:]*[,:]\s*(.)`, "i");
// "…, as per the provided documentation, are:" → "… are:"
const MID_CLAUSE = new RegExp(String.raw`,?\s*(?:as per|according to|based on|in|from) (?:the )?(?:provided )?${SOURCES}\s*(?=[,.:;!?]|$),?`, "gi");
// A whole sentence that is only about the sources: "These Pokémon are identified … in the provided documentation."
const SOURCE_SENTENCE = new RegExp(
  String.raw`^(?:this|these|that|those|the (?:${SOURCES}|above))\b.*\b(?:provided|the|these|this|those) ${SOURCES}\b`,
  "i",
);
const LIST_LINE = /^\s*(?:[-*+]|\d+[.)])\s+|^\s{2,}\S/;

function clean(lines: string[]): string[] {
  return lines
    .filter((line) => !QUOTE.test(line))
    .filter((line) => !/^\s{2,}\S/.test(line)) // nested details repeat the cited Pokémon's description
    .map((line) => line.replace(LEAD_IN, (_, lead: string, first: string) => lead + first.toUpperCase()))
    .map((line) =>
      line
        .split(/(?<=[.!?:])\s+/)
        .filter((sentence) => !SOURCE_SENTENCE.test(sentence.trim()))
        .map((sentence) => sentence.replace(MID_CLAUSE, ""))
        .join(" "),
    );
}

function firstBlock(lines: string[]): string {
  const blocks = lines
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

export function tidyAnswer(markdown: string): string {
  const lines = markdown.split("\n");

  // 1. Drop the opening heading.
  const start = lines.findIndex((line) => line.trim() !== "");
  const body = start !== -1 && HEADING.test(lines[start]) ? lines.slice(start + 1) : lines.slice(Math.max(start, 0));

  // 2. Sections. Several sub-headings after the intro mean the answer is a list of items written as sections.
  const firstContent = body.findIndex((line) => line.trim() !== "");
  // Include a heading on the first content line: RGA sometimes skips the intro and starts with "### Articuno".
  const headingIdx = body.map((line, i) => (HEADING.test(line) ? i : -1)).filter((i) => i >= firstContent && i !== -1);
  let section: string[];
  if (headingIdx.length >= 2) {
    const intro = body.slice(0, headingIdx[0]).filter((line) => !BOLD_LABEL.test(line));
    // A section is either one item with key-value details ("### Charmander" + "- **Type:** Fire") or a group of
    // items ("### Generation 1" + "- **Charmander**"). Show the item, or the group with its item names.
    const items = headingIdx.map((h, k) => {
      const title = body[h].match(HEADING)![1].replace(/\*\*/g, "").trim();
      const end = headingIdx[k + 1] ?? body.length;
      const names = body
        .slice(h + 1, end)
        .filter((line) => /^\s{0,1}[-*+]\s+/.test(line))
        .map((line) => line.replace(/^\s*[-*+]\s+/, "").replace(/\*\*/g, "").trim())
        .filter((text) => !text.includes(":") && text.split(/\s+/).length <= 4);
      return names.length ? `- ${title}: ${names.join(", ")}` : `- ${title}`;
    });
    section = [...intro, "", ...items];
  } else {
    const next = body.findIndex((line, i) => i > firstContent && (HEADING.test(line) || BOLD_LABEL.test(line)));
    section = next === -1 ? body : body.slice(0, next);
  }

  // 3–4. Clean, then keep the answer itself.
  const answer = firstBlock(clean(section));
  if (answer) return answer;

  // 5. Safety net: never show an empty answer.
  return lines
    .filter((line) => !HEADING.test(line))
    .join("\n")
    .trim();
}
