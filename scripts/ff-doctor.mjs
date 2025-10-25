import fs from "node:fs";
import path from "node:path";

import { astAvailable, scanTextForFlagsAST } from "./doctor/ast.js";
import { scanTextForFlags } from "./doctor/scan.js";

const ROOT = path.resolve(process.cwd());
const SRC_DIRS = ["app", "components", "lib"];
const NAMES_JSON = path.join(ROOT, "generated", "flags.names.json");
const TS_FLAGS = path.join(ROOT, "lib", "ff", "flags.ts");
const ALLOW_FILE = path.join(ROOT, "scripts", "ff-doctor.allow"); // optional

function readFlagNames() {
  // 1) JSON из codegen (предпочтительно)
  try {
    const j = JSON.parse(fs.readFileSync(NAMES_JSON, "utf8"));
    if (Array.isArray(j?.names) && j.names.length) return j.names;
  } catch {
    // ignore and fallback to TypeScript source
  }
  // 2) Fallback: парсим union из lib/ff/flags.ts
  try {
    const src = fs.readFileSync(TS_FLAGS, "utf8");
    const m = src.match(/export\s+type\s+FlagName\s*=\s*([^;]+);/m);
    if (m) {
      const body = m[1];
      const names = Array.from(body.matchAll(/['"]([a-zA-Z0-9_-]+)['"]/g)).map((x) => x[1]);
      if (names.length) {
        console.warn(
          "[ff-doctor] fallback: parsed names from lib/ff/flags.ts (run ff:codegen to speed up)",
        );
        return names;
      }
    }
  } catch {
    // ignore and report below
  }
  console.error("[ff-doctor] No flag names available. Run: npm run ff:codegen");
  process.exit(2);
}

function readAllowList() {
  const allow = { use: new Set(), allowUnknown: new Set() };
  if (!fs.existsSync(ALLOW_FILE)) return allow;
  const lines = fs.readFileSync(ALLOW_FILE, "utf8").split(/\r?\n/);
  for (const ln of lines) {
    const s = ln.trim();
    if (!s || s.startsWith("#")) continue;
    const m = s.match(/^(use|allow-unknown)\s*:\s*([a-zA-Z0-9_-]+)$/);
    if (!m) continue;
    const [, kind, name] = m;
    if (kind === "use") allow.use.add(name);
    else allow.allowUnknown.add(name);
  }
  return allow;
}

function collectSourceEntries() {
  const files = [];
  const directories = new Set();
  for (const dir of SRC_DIRS) {
    const root = path.join(ROOT, dir);
    if (!fs.existsSync(root)) continue;
    directories.add(root);
    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of entries) {
        const p = path.join(current, ent.name);
        if (ent.isDirectory()) {
          directories.add(p);
          stack.push(p);
        } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(ent.name)) {
          files.push(p);
        }
      }
    }
  }
  return { files, directories };
}

function parseArgs(argv) {
  const opts = {
    jsonMode: false,
    hint: false,
    out: null,
    days: 30,
    minExposures: 5,
    telemetry: [],
    watch: false,
  };
  const readValue = (arg, key, next) => {
    if (arg.startsWith(`${key}=`)) return { value: arg.slice(key.length + 1), consumed: 0 };
    if (arg === key) return { value: next, consumed: 1 };
    return null;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      opts.jsonMode = true;
      continue;
    }
    if (arg === "--hint") {
      opts.hint = true;
      continue;
    }
    if (arg === "--watch") {
      opts.watch = true;
      opts.jsonMode = false;
      continue;
    }
    let res = readValue(arg, "--out", argv[i + 1]);
    if (res) {
      opts.out = res.value ?? null;
      i += res.consumed;
      continue;
    }
    res = readValue(arg, "--days", argv[i + 1]);
    if (res) {
      const parsed = Number(res.value);
      if (Number.isFinite(parsed) && parsed >= 0) opts.days = parsed;
      i += res.consumed;
      continue;
    }
    res = readValue(arg, "--min-exposures", argv[i + 1]);
    if (res) {
      const parsed = Number(res.value);
      if (Number.isFinite(parsed) && parsed >= 0) opts.minExposures = parsed;
      i += res.consumed;
      continue;
    }
    res = readValue(arg, "--telemetry", argv[i + 1]);
    if (res) {
      if (res.value) opts.telemetry.push(res.value);
      i += res.consumed;
      continue;
    }
    if (arg.startsWith("--telemetry=")) {
      const value = arg.slice("--telemetry=".length);
      if (value) opts.telemetry.push(value);
      continue;
    }
    if (arg.startsWith("--days=")) {
      const parsed = Number(arg.slice("--days=".length));
      if (Number.isFinite(parsed) && parsed >= 0) opts.days = parsed;
      continue;
    }
    if (arg.startsWith("--min-exposures=")) {
      const parsed = Number(arg.slice("--min-exposures=".length));
      if (Number.isFinite(parsed) && parsed >= 0) opts.minExposures = parsed;
      continue;
    }
    if (arg.startsWith("--out=")) {
      opts.out = arg.slice("--out=".length) || null;
      continue;
    }
  }
  if (!Number.isFinite(opts.days) || opts.days < 0) opts.days = 30;
  if (!Number.isFinite(opts.minExposures) || opts.minExposures < 0) opts.minExposures = 0;
  opts.telemetry = opts.telemetry.filter(Boolean);
  return opts;
}

function listNdjsonEntries(dir) {
  const files = [];
  const directories = new Set();
  if (!fs.existsSync(dir)) return { files, directories };
  const stack = [dir];
  directories.add(dir);
  while (stack.length) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      let dirents;
      try {
        dirents = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of dirents) {
        const child = path.join(current, entry.name);
        if (entry.isDirectory()) {
          directories.add(child);
          stack.push(child);
        } else if (entry.isFile() && child.endsWith(".ndjson")) {
          files.push(child);
        }
      }
    } else if (stat.isFile() && current.endsWith(".ndjson")) {
      files.push(current);
    }
  }
  return { files, directories };
}

function discoverTelemetrySources(explicitPaths) {
  const foundFiles = new Set();
  const foundDirectories = new Set();
  const visitDirectory = (dir) => {
    const { files, directories } = listNdjsonEntries(dir);
    files.forEach((file) => foundFiles.add(path.resolve(file)));
    directories.forEach((d) => foundDirectories.add(path.resolve(d)));
  };
  const visitPath = (file) => {
    if (!file) return;
    const resolved = path.resolve(ROOT, file);
    const parent = path.dirname(resolved);
    foundDirectories.add(parent);
    if (!fs.existsSync(resolved)) return;
    let stat;
    try {
      stat = fs.statSync(resolved);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      foundDirectories.add(resolved);
      visitDirectory(resolved);
    } else if (stat.isFile() && resolved.endsWith(".ndjson")) {
      foundFiles.add(resolved);
      foundDirectories.add(path.dirname(resolved));
    }
  };
  if (explicitPaths.length) {
    explicitPaths.forEach(visitPath);
  } else {
    const defaults = [
      path.join(ROOT, "reports", "telemetry.ndjson"),
      path.join(ROOT, "reports", "ff-telemetry.ndjson"),
      path.join(ROOT, "reports", "telemetry"),
      path.join(ROOT, ".runtime", "telemetry.ndjson"),
    ];
    defaults.forEach(visitPath);
  }
  return {
    files: Array.from(foundFiles).sort(),
    directories: Array.from(foundDirectories).sort(),
  };
}

function readTelemetry(files, { days }) {
  const exposures = new Map();
  let events = 0;
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  const minTs = Number.isFinite(days) && days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      let data;
      try {
        data = JSON.parse(line);
      } catch {
        continue;
      }
      const type =
        typeof data.type === "string"
          ? data.type.toLowerCase()
          : typeof data.event === "string"
            ? data.event.toLowerCase()
            : "";
      if (type !== "exposure") continue;
      const flag =
        typeof data.flag === "string"
          ? data.flag
          : typeof data.name === "string"
            ? data.name
            : null;
      if (!flag) continue;
      let tsRaw = data.ts ?? data.timestamp ?? data.time ?? null;
      if (typeof tsRaw === "string") {
        const parsed = Date.parse(tsRaw);
        tsRaw = Number.isFinite(parsed) ? parsed : null;
      }
      if (typeof tsRaw !== "number" || !Number.isFinite(tsRaw)) tsRaw = null;
      if (minTs !== null && tsRaw !== null && tsRaw < minTs) continue;
      if (tsRaw !== null) {
        earliest = Math.min(earliest, tsRaw);
        latest = Math.max(latest, tsRaw);
      }
      events += 1;
      exposures.set(flag, (exposures.get(flag) || 0) + 1);
    }
  }
  const available = events > 0;
  const range =
    available && Number.isFinite(earliest) && Number.isFinite(latest)
      ? { from: new Date(earliest).toISOString(), to: new Date(latest).toISOString() }
      : null;
  return { exposures, events, available, files: files.length, range };
}

const HAS_AST = await astAvailable();
const options = parseArgs(process.argv.slice(2));
const HINT = options.hint;
const WATCH_MODE = options.watch;
const JSON_MODE = options.jsonMode && !WATCH_MODE;

function classifyUnusedConfidence({ telemetryAvailable, fuzzyRefsCount }) {
  if (!telemetryAvailable) return "low";
  return fuzzyRefsCount > 0 ? "medium" : "high";
}

function classifyStaleConfidence({ exposures, telemetryAvailable }) {
  if (!telemetryAvailable) return "low";
  if (exposures === 0) return "medium";
  return "low";
}

async function buildReport(runOptions) {
  const flagNames = readFlagNames();
  const allow = readAllowList();
  const { files, directories } = collectSourceEntries();
  const telemetrySources = discoverTelemetrySources(runOptions.telemetry);
  const telemetryReport = readTelemetry(telemetrySources.files, runOptions);

  const refs = new Map(flagNames.map((n) => [n, 0]));
  const fuzzyRefs = new Map(flagNames.map((n) => [n, 0]));
  const unknown = new Map();
  const unknownDetails = [];
  const fuzzyDetails = [];
  const knownSet = new Set(flagNames);

  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const ext = path.extname(file).toLowerCase();
    const regexResult = scanTextForFlags(text, flagNames);
    let r = regexResult;
    const canAST = HAS_AST && /\.(c|m)?(t|j)sx?$/.test(ext);
    let usedAST = false;
    if (canAST) {
      try {
        const astResult = await scanTextForFlagsAST(text, file, flagNames);
        if (astResult?.occurrences?.length) {
          r = astResult;
          usedAST = true;
        }
      } catch {
        // no-op, fallback ниже
      }
    }
    for (const [k, v] of r.refs ?? []) refs.set(k, (refs.get(k) || 0) + v);
    for (const [k, v] of r.fuzzyRefs ?? []) fuzzyRefs.set(k, (fuzzyRefs.get(k) || 0) + v);
    for (const [k, v] of r.unknown ?? []) unknown.set(k, (unknown.get(k) || 0) + v);
    for (const occ of r.occurrences ?? []) {
      if (knownSet.has(occ.name)) {
        if (occ.fuzzy) {
          fuzzyDetails.push({ name: occ.name, file, line: occ.line, col: occ.col, kind: occ.kind });
        }
      } else {
        unknownDetails.push({
          name: occ.name,
          file,
          line: occ.line,
          col: occ.col,
          kind: occ.kind,
          fuzzy: !!occ.fuzzy,
        });
      }
    }
    if (usedAST) {
      for (const occ of regexResult.occurrences ?? []) {
        if (!occ.fuzzy) continue;
        if (knownSet.has(occ.name)) {
          fuzzyRefs.set(occ.name, (fuzzyRefs.get(occ.name) || 0) + 1);
          fuzzyDetails.push({ name: occ.name, file, line: occ.line, col: occ.col, kind: occ.kind });
        } else {
          unknown.set(occ.name, (unknown.get(occ.name) || 0) + 1);
          unknownDetails.push({
            name: occ.name,
            file,
            line: occ.line,
            col: occ.col,
            kind: occ.kind,
            fuzzy: true,
          });
        }
      }
    }
  }

  for (const name of allow.use) {
    if (refs.has(name)) refs.set(name, Math.max(1, refs.get(name) || 0));
  }
  for (const name of allow.allowUnknown) {
    if (unknown.has(name)) unknown.delete(name);
  }

  const exposuresKnown = new Map(flagNames.map((n) => [n, telemetryReport.exposures.get(n) || 0]));
  const telemetryUnknown = [];
  for (const [flag, count] of telemetryReport.exposures.entries()) {
    if (!knownSet.has(flag)) telemetryUnknown.push({ name: flag, count });
  }

  const fuzzyByName = new Map();
  for (const detail of fuzzyDetails) {
    if (!fuzzyByName.has(detail.name)) fuzzyByName.set(detail.name, []);
    fuzzyByName.get(detail.name).push(detail);
  }

  const errors = [];
  const warnings = [];
  const unused = [];
  const stale = [];
  const fuzzyOnly = [];

  for (const [name, count] of unknown.entries()) {
    const coords = unknownDetails
      .filter((x) => x.name === name)
      .slice(0, 5)
      .map((x) => `${x.file}:${x.line}:${x.col}`)
      .join(", ");
    errors.push(`unknown flag usage "${name}" (${count} refs) at ${coords}`);
  }

  for (const item of telemetryUnknown) {
    errors.push(`telemetry exposure for unknown flag "${item.name}" (${item.count})`);
  }

  const telemetryAvailable = telemetryReport.available;

  for (const name of flagNames) {
    const direct = refs.get(name) || 0;
    const exposures = exposuresKnown.get(name) || 0;
    const fuzzyCount = fuzzyRefs.get(name) || 0;
    if (direct === 0 && exposures === 0) {
      const detail = {
        name,
        references: direct,
        fuzzyReferences: fuzzyCount,
        exposures,
        telemetryAvailable,
        confidence: classifyUnusedConfidence({ telemetryAvailable, fuzzyRefsCount: fuzzyCount }),
      };
      unused.push(detail);
      warnings.push(`${name}: unused (confidence=${detail.confidence})`);
    }
    if (telemetryAvailable && direct > 0 && exposures < runOptions.minExposures) {
      const detail = {
        name,
        references: direct,
        exposures,
        threshold: runOptions.minExposures,
        confidence: classifyStaleConfidence({ exposures, telemetryAvailable }),
      };
      stale.push(detail);
      warnings.push(`${name}: stale (exposures=${exposures}, confidence=${detail.confidence})`);
    }
  }

  for (const [name, details] of fuzzyByName.entries()) {
    const direct = refs.get(name) || 0;
    if (direct > 0) continue;
    const exposures = exposuresKnown.get(name) || 0;
    fuzzyOnly.push({
      name,
      fuzzyRefs: fuzzyRefs.get(name) || details.length,
      exposures,
      samples: details.slice(0, 5),
    });
  }

  unused.sort((a, b) => a.name.localeCompare(b.name));
  stale.sort((a, b) => a.name.localeCompare(b.name));
  fuzzyOnly.sort((a, b) => a.name.localeCompare(b.name));
  unknownDetails.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      (a.col ?? 0) - (b.col ?? 0),
  );
  telemetryUnknown.sort((a, b) => a.name.localeCompare(b.name));

  const exposuresObject = Object.fromEntries(exposuresKnown);
  const payload = {
    generatedAt: new Date().toISOString(),
    options: { days: runOptions.days, minExposures: runOptions.minExposures },
    files: files.length,
    telemetry: {
      available: telemetryReport.available,
      files: telemetryReport.files,
      events: telemetryReport.events,
      range: telemetryReport.range,
      unknown: telemetryUnknown,
    },
    refs: Object.fromEntries(refs),
    fuzzyRefs: Object.fromEntries(fuzzyRefs),
    exposures: exposuresObject,
    unused,
    stale,
    fuzzyOnly,
    unknown: unknownDetails,
    warnings,
    errors,
  };

  const watchDirectories = new Set();
  const addWatchDirectory = (dir) => {
    if (!dir) return;
    watchDirectories.add(path.resolve(dir));
  };
  directories.forEach((dir) => addWatchDirectory(dir));
  telemetrySources.directories.forEach((dir) => addWatchDirectory(dir));
  addWatchDirectory(path.dirname(NAMES_JSON));
  addWatchDirectory(path.dirname(ALLOW_FILE));
  addWatchDirectory(path.dirname(TS_FLAGS));

  return {
    payload,
    warnings,
    errors,
    context: {
      files,
      telemetrySources,
      directories: Array.from(watchDirectories),
    },
  };
}

function writeReportToFile(payload, destination) {
  if (!destination) return null;
  const outPath = path.isAbsolute(destination) ? destination : path.join(ROOT, destination);
  const outDir = path.dirname(outPath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return outPath;
}

function formatReportSummary(payload, context) {
  const telemetrySources = context?.telemetrySources ?? { files: [] };
  const lines = [];
  lines.push(`[ff-doctor] files scanned: ${context?.files?.length ?? payload.files}`);
  if (payload.telemetry?.available) {
    const range = payload.telemetry.range
      ? `${payload.telemetry.range.from} .. ${payload.telemetry.range.to}`
      : "range: n/a";
    lines.push(
      `[ff-doctor] telemetry: ${payload.telemetry.events} exposures from ${telemetrySources.files.length} file(s) (last ${payload.options.days}d, min ${payload.options.minExposures}) ${range ? `| ${range}` : ""}`,
    );
  } else {
    lines.push(
      telemetrySources.files.length
        ? `[ff-doctor] telemetry: no exposure events in last ${payload.options.days}d`
        : "[ff-doctor] telemetry: no data (pass --telemetry <path> to include)",
    );
  }
  lines.push(`[ff-doctor] unused flags: ${payload.unused.length}`);
  payload.unused.forEach((detail) => {
    const telemetryTag = detail.telemetryAvailable ? "telemetry" : "no-telemetry";
    const fuzzyTag = detail.fuzzyReferences > 0 ? `, fuzzy=${detail.fuzzyReferences}` : "";
    lines.push(
      `  - ${detail.name} (confidence=${detail.confidence}, refs=${detail.references}, exposures=${detail.exposures}, ${telemetryTag}${fuzzyTag})`,
    );
  });
  lines.push(`[ff-doctor] stale flags: ${payload.stale.length}`);
  payload.stale.forEach((detail) => {
    lines.push(
      `  - ${detail.name} (confidence=${detail.confidence}, refs=${detail.references}, exposures=${detail.exposures}, threshold=${detail.threshold})`,
    );
  });
  lines.push(`[ff-doctor] fuzzy-only references: ${payload.fuzzyOnly.length}`);
  payload.fuzzyOnly.forEach((entry) => {
    const sample = entry.samples[0];
    const location = sample ? `${sample.file}:${sample.line}:${sample.col}` : "n/a";
    lines.push(
      `  - ${entry.name} (fuzzy=${entry.fuzzyRefs}, exposures=${entry.exposures}, sample=${location})`,
    );
  });
  lines.push(`[ff-doctor] errors: ${payload.errors.length}`);
  payload.errors.forEach((e) => lines.push(`  - ${e}`));
  return lines;
}

function emitNdjson(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function createWatchManager(onChange) {
  const watchers = new Map();
  const ensureDirWatcher = (dir) => {
    if (!dir || watchers.has(dir)) return;
    try {
      const watcher = fs.watch(dir, { persistent: true }, () => onChange());
      watcher.on("error", () => {
        watcher.close();
        watchers.delete(dir);
      });
      watchers.set(dir, watcher);
    } catch {
      // ignore directories that cannot be watched
    }
  };
  const sync = (dirs) => {
    const desired = new Set();
    dirs.forEach((dir) => {
      const resolved = path.resolve(dir);
      desired.add(resolved);
      if (fs.existsSync(resolved)) ensureDirWatcher(resolved);
    });
    for (const [dir, watcher] of watchers.entries()) {
      if (!desired.has(dir)) {
        watcher.close();
        watchers.delete(dir);
      }
    }
  };
  const closeAll = () => {
    for (const watcher of watchers.values()) watcher.close();
    watchers.clear();
  };
  return { sync, closeAll };
}

if (WATCH_MODE) {
  let runner;
  const manager = createWatchManager(() => {
    if (runner) runner.trigger();
  });

  runner = (() => {
    let running = false;
    let pending = false;
    const trigger = () => {
      pending = true;
      if (!running) run();
    };
    const run = async () => {
      running = true;
      while (pending) {
        pending = false;
        const startedAt = Date.now();
        try {
          const result = await buildReport(options);
          const outPath = writeReportToFile(result.payload, options.out);
          manager.sync(result.context.directories);
          emitNdjson({
            type: "report",
            at: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
            payload: result.payload,
            warnings: result.warnings,
            errors: result.errors,
            outFile: outPath ? path.relative(ROOT, outPath) : null,
          });
          if (HINT && result.payload.unknown?.length) {
            emitNdjson({
              type: "hint",
              at: new Date().toISOString(),
              allowUnknown: Array.from(
                new Set(result.payload.unknown.map((entry) => entry.name)),
              ).sort(),
            });
          }
        } catch (error) {
          emitNdjson({
            type: "error",
            at: new Date().toISOString(),
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      }
      running = false;
    };
    return { trigger };
  })();

  emitNdjson({ type: "watch-start", at: new Date().toISOString(), options });
  runner.trigger();
  process.on("SIGINT", () => {
    emitNdjson({ type: "watch-stop", at: new Date().toISOString() });
    manager.closeAll();
    process.exit(0);
  });
  process.stdin.resume();
} else {
  const result = await buildReport(options);
  const outPath = writeReportToFile(result.payload, options.out);
  if (outPath && !JSON_MODE) {
    console.log(`[ff-doctor] report saved to ${path.relative(ROOT, outPath)}`);
  }

  if (JSON_MODE) {
    console.log(JSON.stringify(result.payload, null, 2));
    process.exit(result.payload.errors.length ? 1 : result.payload.warnings.length ? 2 : 0);
  } else {
    const lines = formatReportSummary(result.payload, {
      files: result.context.files,
      telemetrySources: result.context.telemetrySources,
    });
    lines.forEach((line) => console.log(line));
    if (HINT && result.payload.unknown?.length) {
      console.log("\n[ff-doctor] hints for allow-list:");
      const uniqueUnknown = Array.from(
        new Set(result.payload.unknown.map((entry) => entry.name)),
      ).sort();
      uniqueUnknown.forEach((name) => console.log(`  allow-unknown: ${name}`));
    }
    process.exit(result.payload.errors.length ? 1 : result.payload.warnings.length ? 2 : 0);
  }
}
