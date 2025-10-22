import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, it, expect } from "vitest";

import Root, { metadata } from "./layout";

const RootLayout = Root as unknown as (props: { children: React.ReactNode }) => JSX.Element;

describe("layout", () => {
  it("defines metadata", () => {
    expect(metadata?.title).toBeDefined();
  });

  it("renders skip-link and main landmark", () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(RootLayout, undefined, <div>child</div>),
    );
    expect(html).toContain("Skip to content");
    expect(html).toContain('id="main"');
  });
});
