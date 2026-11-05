import type { CSSProperties } from "react";
import Link from "next/link";

// Site hero, shown on the home and detail pages: night sky, type-colored orbs drifting above a tall-grass silhouette.
// Kept to the right half so they never sit behind the headline.
const orbs = [
  { left: 54, top: 18, size: 8, type: "electric" },
  { left: 60, top: 56, size: 13, type: "water" },
  { left: 68, top: 26, size: 20, type: "fire" },
  { left: 78, top: 52, size: 25, type: "grass" },
  { left: 84, top: 14, size: 11, type: "psychic" },
  { left: 91, top: 36, size: 8, type: "ice" },
  { left: 95, top: 62, size: 14, type: "dragon" },
];

// Curved blades: each one rises from the bottom edge to a tip that leans left or right.
function blades(count: number, minHeight: number, maxHeight: number, seed: number): string {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const width = 100 / count;
  let d = "";
  for (let i = 0; i < count; i++) {
    const x0 = i * width - width * 0.3;
    const x1 = x0 + width * 1.6;
    const tipX = x0 + width * (0.4 + rand() * 0.8) + (rand() - 0.5) * width;
    const tipY = 100 - (minHeight + rand() * (maxHeight - minHeight));
    d += `M${x0.toFixed(2)} 100 Q${(x0 + width * 0.3).toFixed(2)} ${(tipY + 25).toFixed(2)} ${tipX.toFixed(2)} ${tipY.toFixed(2)} `;
    d += `Q${(x1 - width * 0.4).toFixed(2)} ${(tipY + 30).toFixed(2)} ${x1.toFixed(2)} 100 Z `;
  }
  return d;
}

const backGrass = blades(46, 45, 85, 7);
const frontGrass = blades(60, 25, 60, 42);

// On the home page the title is the page's h1. Elsewhere the page has its own h1 (the Pokémon's name),
// so the title becomes a link back to search instead.
export function Banner({ home = true }: { home?: boolean }) {
  return (
    <section className="banner" aria-labelledby="banner-title">
      {orbs.map((o) => (
        <span
          key={o.type}
          className={o.top > 40 ? "orb low" : "orb"}
          aria-hidden
          style={
            {
              left: `${o.left}%`,
              top: `${o.top}%`,
              width: o.size,
              height: o.size,
              "--orb": `var(--type-${o.type})`,
            } as CSSProperties
          }
        />
      ))}
      <svg className="banner-grass" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path className="back" d={backGrass} />
        <path className="front" d={frontGrass} />
      </svg>
      <div className="banner-copy">
        <p className="eyebrow">A wild search appeared!</p>
        {home ? (
          <h1 id="banner-title" className="banner-title">Tall Grass</h1>
        ) : (
          <p id="banner-title" className="banner-title">
            <Link href="/">Tall Grass</Link>
          </p>
        )}
        <p className="tagline">Find any Pokémon by name, type, generation, or just a question.</p>
        <ul className="stats">
          <li><strong>1,025</strong> Pokémon</li>
          <li><strong>18</strong> types</li>
          <li><strong>9</strong> generations</li>
          <li className="powered">
            Powered by <strong>Coveo</strong>
          </li>
        </ul>
      </div>
    </section>
  );
}
