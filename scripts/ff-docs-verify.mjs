import fs from "node:fs";

const files = [
  "docs/FLAGS_PLAYBOOK.md",
  "docs/FLAGS_SECURITY_PRIVACY.md",
  "docs/FLAGS_TROUBLESHOOTING.md",
  "docs/FLAGS_GOVERNANCE.md",
  "docs/FLAGS_API_REFERENCE.md",
  "docs/flags.generated.md", // из S4E
];

const requiredSections = {
  "docs/FLAGS_PLAYBOOK.md": [
    "# Flags Playbook",
    "Rollout Playbook",
    "Exposure",
    "Troubleshooting",
    "Governance",
    "Security",
    "API Reference",
  ],
  "docs/FLAGS_SECURITY_PRIVACY.md": ["# Security", "Threat model", "Политика логирования"],
  "docs/FLAGS_TROUBLESHOOTING.md": ["# Troubleshooting", "Hydration", "Doctor"],
  "docs/FLAGS_GOVERNANCE.md": ["# Governance", "Ownership", "Lifecycle", "Проверки"],
  "docs/FLAGS_API_REFERENCE.md": [
    "# Flags API Reference",
    "/api/ff-override",
    "/api/ff-exposure",
    "/api/admin/ff-emergency-disable",
  ],
};

let errors = 0;
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.error(`[ff-docs-verify] missing file: ${f}`);
    errors++;
    continue;
  }

  const sections = requiredSections[f];
  if (sections) {
    const txt = fs.readFileSync(f, "utf8");
    for (const s of sections) {
      if (!txt.includes(s)) {
        console.error(`[ff-docs-verify] missing section "${s}" in ${f}`);
        errors++;
      }
    }
  }
}

if (errors) {
  console.error(`[ff-docs-verify] FAILED: ${errors} issue(s)`);
  process.exit(1);
}

console.log("[ff-docs-verify] OK");
