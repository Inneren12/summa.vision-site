import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, it, expect } from "vitest";

import Root, { metadata } from "./layout";

const Layout = Root as unknown as React.ComponentType<{ children: React.ReactNode }>;

describe("layout", () => {
  it("defines metadata", () => {
    expect(metadata?.title).toBeDefined();
  });

  it("renders skip-link and main landmark", () => {
    const html = ReactDOMServer.renderToString(
      <Layout>
        <div>child</div>
      </Layout>,
    );
    expect(html).toContain("Skip to content");
    expect(html).toContain('id="main"');
  });
});
