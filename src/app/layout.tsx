import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

/**
 * Type pairing.
 *
 * Instrument Serif carries the headlines — an editorial serif reads as the
 * document world the product is about, and is the fastest way to not look like
 * every other dark AI tool. Geist handles the interface, and Geist Mono every
 * number, label and extracted document, so anything that came out of a file or
 * a calculation is visually distinct from anything the interface is asserting.
 */
const instrument = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Signal — explainable resume-to-role matching",
  description:
    "Score a resume against a job description and see the reasoning: which skills matched, which are missing, and exactly what each gap costs.",
  authors: [{ name: "Mithin Sagar S" }],
  openGraph: {
    title: "Signal — explainable resume-to-role matching",
    description:
      "A deterministic match score with the reasoning attached. Upload a resume, paste a posting, see what actually lines up.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${instrument.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
