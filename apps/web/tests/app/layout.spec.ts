vi.mock("server-only",()=>({}),{virtual:true});
vi.mock("next/headers",()=>({headers:()=>new Map(),cookies:()=>({get:()=>undefined})}),{virtual:true});
import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, it, expect } from "vitest";

import Root, { metadata } from "../../app/layout";

const RootLayout = Root as unknown as (props: { children: React.ReactNode }) => React.ReactElement;

describe("layout", () => {
  it("defines metadata", () => {
    expect(metadata?.title).toBeDefined();
  });

  it("renders skip-link and main landmark", () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(RootLayout, undefined, React.createElement("div", undefined, "child")),
    );
    expect(html).toContain("Skip to content");
    expect(html).toContain('id="main"');
  });
});
