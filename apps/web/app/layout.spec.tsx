import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, it, expect } from "vitest";

import Root, { metadata } from "./layout";

describe("layout", () => {
  it("defines metadata", () => {
    expect(metadata?.title).toBeDefined();
  });

  it("renders skip-link and main landmark", () => {
    const html = ReactDOMServer.renderToString(
      // @ts-expect-error server component is fine for SSR render in tests
      <Root>
        <div>child</div>
      </Root>,
    );
    expect(html).toContain("Skip to content");
    expect(html).toContain('id="main"');
  });
});
