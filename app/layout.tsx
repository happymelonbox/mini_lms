// Root layout: fonts, theme provider, and the CSP nonce handed down from proxy.ts.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const description = "Book a consultation, move it when plans change, and see what’s coming up.";

// Each page sets its own title, so every tab names its page.
export const metadata: Metadata = {
  title: { default: "Mini-LMS", template: "%s | Mini-LMS" },
  description,
  openGraph: { title: { default: "Mini-LMS", template: "%s | Mini-LMS" }, description },
};

// Self-hosted at build time by next/font, so the CSP keeps font-src 'self'.
const sans = Source_Sans_3({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-sans",
});
const heading = Newsreader({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-heading",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading headers() makes every page dynamic, which is what a per-request nonce requires.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${heading.variable} antialiased`}>
        <ThemeProvider
          nonce={nonce}
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
