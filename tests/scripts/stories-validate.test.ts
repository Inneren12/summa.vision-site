import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const tempDirectories: string[] = [];

async function createStory(content: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "stories-validate-"));
  tempDirectories.push(directory);
  const filePath = path.join(directory, "story.mdx");
  await fs.writeFile(filePath, content, "utf8");
  return directory;
}

function runValidator(directory: string) {
  return spawnSync(process.execPath, ["scripts/stories-validate.mjs", directory], {
    encoding: "utf8",
  });
}

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe("stories-validate script", () => {
  it("passes when story front matter and steps are consistent", async () => {
    const storyDir = await createStory(`---
slug: "valid-story"
title: "Valid story"
description: "Sample"
cover:
  src: "/cover.jpg"
  alt: "Cover"
steps:
  - id: intro
    title: "Intro"
---

<Step id="intro" title="Intro">
  <p>Valid content.</p>
</Step>
`);
    const result = runValidator(storyDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Validated 1 story successfully/);
  });

  it("reports missing step titles for authors", async () => {
    const storyDir = await createStory(`---
slug: "broken-story"
title: "Broken story"
description: "Sample"
cover:
  src: "/cover.jpg"
  alt: "Cover"
steps:
  - id: intro
    title: "Intro"
---

<Step id="intro">
  <p>Oops.</p>
</Step>
`);
    const result = runValidator(storyDir);
    expect(result.status).not.toBe(0);
    const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    expect(combinedOutput).toMatch(/missing the required title attribute/);
  });
});
