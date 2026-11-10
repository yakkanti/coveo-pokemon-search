// RGA citations carry the whole chunk the answer drew on (about 1,500 characters: tables, headings and prose run
// together), with no character offsets. To show the cited portion, pick the sentences in the chunk that best
// match the generated answer.

const STOP = new Set(
  "the a an and or of to in on at for with from by is are was were be been it its this that these those as into than then also has have had which who what does do pokemon pokémon".split(
    " ",
  ),
);

const words = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

// Split a chunk into sentence-like pieces. Chunks mix prose with flattened tables, so also break on long runs of
// numbers, which are table rows rather than sentences.
function sentences(chunk: string): string[] {
  return chunk
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z#"“])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 400)
    .filter((s) => (s.match(/\d/g)?.length ?? 0) / s.length < 0.15); // skip stat tables
}

/** The one or two sentences of `chunk` most related to `answer`, or "" when nothing matches. */
export function citedSnippet(chunk: string, answer: string): string {
  const target = new Set(words(answer));
  if (target.size === 0) return "";
  const scored = sentences(chunk)
    .map((s, i) => {
      const w = words(s);
      const hits = w.filter((x) => target.has(x)).length;
      return { s, i, score: hits / Math.sqrt(Math.max(w.length, 1)), hits };
    })
    .filter((x) => x.hits >= 2);
  if (scored.length === 0) return "";
  const best = scored.sort((a, b) => b.score - a.score)[0];
  // Add the next sentence when it also matches, so the quote reads as a complete thought.
  const next = scored.find((x) => x.i === best.i + 1);
  return focus(next ? `${best.s} ${next.s}` : best.s, target);
}

// Flattened chunks glue table text onto prose ("…Moves learned Sprites Locations Pikachu is an Electric type…"),
// so a "sentence" can start with clutter. Keep the window of words with the most matches, starting at the
// first matching word, and mark trimmed ends with "…".
const WINDOW = 32;
// Chunks start with the page heading glued to the first sentence ("Litten Litten is a Fire type…").
const dedupeHeading = (text: string) => text.replace(/^(\S+)\s+\1\b/, "$1");
function focus(text: string, target: Set<string>): string {
  const tokens = text.split(" ");
  if (tokens.length <= WINDOW && words(tokens[0]).some((w) => target.has(w))) return dedupeHeading(text);
  const hitWords = tokens.map((t) => words(t).filter((w) => target.has(w)));
  // Most distinct matching words wins; on a tie, the tighter window (less clutter between matches) wins.
  let bestStart = 0;
  let bestDistinct = -1;
  let bestSpan = Infinity;
  for (let i = 0; i < tokens.length; i++) {
    if (hitWords[i].length === 0) continue;
    const window = hitWords.slice(i, i + WINDOW);
    const distinct = new Set(window.flat()).size;
    const span = window.reduce((last, w, j) => (w.length ? j : last), 0);
    if (distinct > bestDistinct || (distinct === bestDistinct && span < bestSpan)) {
      [bestStart, bestDistinct, bestSpan] = [i, distinct, span];
    }
  }
  // End a few words after the last match, or at the sentence end if it's close.
  let end = Math.min(bestStart + bestSpan + 1 + 6, tokens.length);
  const sentenceEnd = tokens.findIndex((t, i) => i >= end - 1 && /[.!?]$/.test(t));
  if (sentenceEnd !== -1 && sentenceEnd - end < 8) end = sentenceEnd + 1;
  const quote = dedupeHeading(tokens.slice(bestStart, end).join(" "));
  return `${bestStart > 0 ? "…" : ""}${quote}${end < tokens.length && !/[.!?]$/.test(quote) ? "…" : ""}`;
}

/** Best snippet across several chunks from the same page. */
export function bestCitedSnippet(chunks: string[], answer: string): string {
  return chunks
    .map((c) => citedSnippet(c, answer))
    .filter(Boolean)
    .sort((a, b) => words(b).filter((w) => words(answer).includes(w)).length - words(a).filter((w) => words(answer).includes(w)).length)[0] ?? "";
}
