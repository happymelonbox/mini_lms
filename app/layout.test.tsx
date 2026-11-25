import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/font/google", () => {
  const font = (variable: string) => () => ({ variable });
  return { Source_Sans_3: font("sans-var"), Newsreader: font("heading-var") };
});
// jsdom has no matchMedia, which next-themes reads for the system theme.
vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {} }));

import RootLayout from "./layout";

describe("RootLayout", () => {
  it.each([
    { name: "sets the page language", expected: 'lang="en"' },
    { name: "renders its children", expected: "page body" },
    { name: "applies the sans font variable to the body", expected: "sans-var" },
    { name: "applies the heading font variable to the body", expected: "heading-var" },
  ])("$name", async ({ expected }) => {
    const html = renderToStaticMarkup(await RootLayout({ children: <p>page body</p> }));
    expect(html).toContain(expected);
  });
});
