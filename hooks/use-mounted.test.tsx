import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { useMounted } from "./use-mounted";

function Probe() {
  return <span>{String(useMounted())}</span>;
}

it.each([
  {
    name: "is true once rendered in the browser",
    run: () => renderHook(useMounted).result.current,
    expected: true,
  },
  {
    name: "is false in server rendering",
    run: () => renderToString(<Probe />),
    expected: "<span>false</span>",
  },
])("useMounted $name", ({ run, expected }) => {
  expect(run()).toBe(expected);
});
