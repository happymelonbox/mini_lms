import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Card, CardContent, CardDescription, CardHeader } from "./card";

it.each([
  { name: "Card", ui: <Card data-testid="x">hello</Card> },
  { name: "CardHeader", ui: <CardHeader data-testid="x">hello</CardHeader> },
  { name: "CardDescription", ui: <CardDescription data-testid="x">hello</CardDescription> },
  { name: "CardContent", ui: <CardContent data-testid="x">hello</CardContent> },
])("$name", ({ ui }) => {
  render(ui);
  expect(screen.getByTestId("x")).toHaveTextContent("hello");
});
