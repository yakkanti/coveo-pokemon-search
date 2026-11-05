import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tall Grass · Pokémon search on Coveo",
  description: "Pokémon search built on the Coveo Platform with Headless and Next.js",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <footer className="site-footer">
          Unofficial fan project for a Coveo technical challenge. Data from{" "}
          <a href="https://pokemondb.net">pokemondb.net</a>. Not affiliated with Nintendo or The Pokémon Company.
        </footer>
      </body>
    </html>
  );
}
