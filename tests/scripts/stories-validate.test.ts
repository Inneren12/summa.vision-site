import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validateStories } from "../../lib/content/stories/validator.mjs";

const FIXTURE_DIR = path.join(
  fileURLToPath(new URL("./", import.meta.url)),
  "__fixtures__",
  "stories-invalid",
);

describe("stories validator", () => {
  it("reports descriptive errors for invalid front matter", async () => {
    const result = await validateStories({ storiesDir: FIXTURE_DIR });

    expect(result.ok).toBe(false);
    expect(result.errors).not.toHaveLength(0);

    const messages = result.errors.map((error) => `${error.file}: ${error.message}`);
    expect(messages.some((message) => message.includes("frontMatter.cover.alt"))).toBe(true);
    expect(messages.some((message) => message.includes("frontMatter.steps.0.title"))).toBe(true);
  });
});
