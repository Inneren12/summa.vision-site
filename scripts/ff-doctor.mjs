import fs from "node:fs";
import path from "node:path";

import { astAvailable, scanTextForFlagsAST } from "./doctor/ast.js";
import { scanTextForFlags } from "./doctor/scan.js";

const ROOT = path.resolve(process.cwd());
const SRC_DIRS = ["app", "components", "lib"];
const NAMES_JSON = path.join(ROOT, "generated", "flags.names.json");
const TS_FLAGS = path.join(ROOT, "lib", "ff", "flags.ts");
const ALLOW_FILE = path.join(ROOT, "scripts", "ff-doctor.allow"); // optional

const DEFAULT_TELEMETRY_PATHS = [
  path.join(ROOT, "reports", "telemetry.ndjson"),
  path.join(ROOT, "reports", "ff-telemetry.ndjson"),
  path.join(ROOT, "reports", "telemetry"),
  path.join(ROOT, ".runtime", "telemetry.ndjson"),
];

function readFlagNames() {
  const diagnostics = [];
  // 1) JSON из codegen (предпочтительно)
  try {
    const j = JSON.parse(fs.readFileSync(NAMES_JSON, "utf8"));
    if (Array.isArray(j?.names) && j.names.length) return { names: j.names, diagnostics };
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
        diagnostics.push(
          "[ff-doctor] fallback: parsed names from lib/ff/flags.ts (run ff:codegen to speed up)",
        );
        return { names, diagnostics };
      }
    }
  } catch {
    // ignore and report below
  }
  throw new Error("[ff-doctor] No flag names available. Run: npm run ff:codegen");
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

function readFiles() {
  const acc = [];
  for (const dir of SRC_DIRS) {
    const root = path.join(ROOT, dir);
    if (!fs.existsSync(root)) continue;
    const walk = (d) =>
      fs.readdirSync(d, { withFileTypes: true }).forEach((ent) => {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) return walk(p);
        if (/\.(tsx?|jsx?|mjs|cjs)$/.test(ent.name)) acc.push(p);
      });
    walk(root);
  }
  return acc;
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
    if (arg === "--watch") {
      opts.watch = true;
      continue;
    }
    if (arg === "--hint") {
      opts.hint = true;
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

function listNdjsonFiles(dir) {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const child = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(child);
        else if (entry.isFile() && child.endsWith(".ndjson")) entries.push(child);
      }
    } else if (stat.isFile() && current.endsWith(".ndjson")) {
      entries.push(current);
    }
  }
  return entries;
}

function discoverTelemetryFiles(explicitPaths) {
  const found = new Set();
  const addFile = (file) => {
    if (!file) return;
    const resolved = path.resolve(ROOT, file);
    if (!fs.existsSync(resolved)) return;
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      for (const child of listNdjsonFiles(resolved)) {
        found.add(path.resolve(child));
      }
    } else if (stat.isFile() && resolved.endsWith(".ndjson")) {
      found.add(resolved);
    }
  };
  if (explicitPaths.length) {
    explicitPaths.forEach(addFile);
  } else {
    DEFAULT_TELEMETRY_PATHS.forEach(addFile);
  }
  return Array.from(found).sort();
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
const resolvedOutPath = resolveOutPath(options.out);

if (options.watch) {
  await runWatchMode({ options, hasAst: HAS_AST, outPath: resolvedOutPath });
} else {
  await runOnce({ options, hasAst: HAS_AST, outPath: resolvedOutPath });
}

function resolveOutPath(outOption) {
  if (!outOption) return null;
  return path.isAbsolute(outOption) ? outOption : path.join(ROOT, outOption);
}

function writeOutputFile(payload, outPath) {
  if (!outPath) return;
  const outDir = path.dirname(outPath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function serializeError(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function computeWatchTargets(options) {
  const targets = new Set();
  for (const dir of SRC_DIRS) {
    targets.add(path.join(ROOT, dir));
  }
  targets.add(path.join(ROOT, "generated"));
  targets.add(path.join(ROOT, "lib", "ff"));
  targets.add(ALLOW_FILE);
  targets.add(NAMES_JSON);
  targets.add(TS_FLAGS);
  const telemetrySources = options.telemetry.length ? options.telemetry : DEFAULT_TELEMETRY_PATHS;
  for (const source of telemetrySources) {
    targets.add(path.resolve(ROOT, source));
  }
  return Array.from(targets);
}

async function performScan({ options, hasAst }) {
  const { names: flagNames, diagnostics: flagDiagnostics } = readFlagNames();
  const allow = readAllowList();
  const files = readFiles();
  const telemetryFiles = discoverTelemetryFiles(options.telemetry);
  const telemetryReport = readTelemetry(telemetryFiles, options);
  const diagnostics = [...flagDiagnostics];

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
    const canAST = hasAst && /\.(c|m)?(t|j)sx?$/.test(ext);
    let usedAST = false;
    if (canAST) {
      try {
        const astResult = await scanTextForFlagsAST(text, file, flagNames);
        if (astResult?.occurrences?.length) {
          r = astResult;
          usedAST = true;
        }
      } catch {
        // ignore, fallback ниже
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

  const classifyUnusedConfidence = ({ fuzzyRefsCount, telemetryAvailable: telemetry }) => {
    if (telemetry) {
      return fuzzyRefsCount > 0 ? "medium" : "high";
    }
    return fuzzyRefsCount > 0 ? "low" : "medium";
  };

  const classifyStaleConfidence = ({ exposures, telemetryAvailable: telemetry }) => {
    if (!telemetry) return "low";
    if (exposures === 0) return "medium";
    return "low";
  };

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
        confidence: classifyUnusedConfidence({ fuzzyRefsCount: fuzzyCount, telemetryAvailable }),
      };
      unused.push(detail);
      warnings.push(`${name}: unused (confidence=${detail.confidence})`);
    }
    if (telemetryAvailable && direct > 0 && exposures < options.minExposures) {
      const detail = {
        name,
        references: direct,
        exposures,
        threshold: options.minExposures,
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
    options: { days: options.days, minExposures: options.minExposures },
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
  if (diagnostics.length) {
    payload.diagnostics = diagnostics;
  }

  return { payload, files, telemetryFiles };
}

async function runOnce({ options, hasAst, outPath }) {
  let result;
  try {
    result = await performScan({ options, hasAst });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(2);
    return;
  }
  const { payload, telemetryFiles } = result;
  if (outPath) {
    writeOutputFile(payload, outPath);
    if (!options.jsonMode) {
      console.log(`[ff-doctor] report saved to ${path.relative(ROOT, outPath)}`);
    }
  }

  if (options.jsonMode) {
    console.log(JSON.stringify(payload, null, 2));
    process.exit(payload.errors.length ? 1 : payload.warnings.length ? 2 : 0);
    return;
  }

  const diagnostics = payload.diagnostics ?? [];
  diagnostics.forEach((msg) => console.warn(msg));

  console.log(`[ff-doctor] files scanned: ${payload.files}`);
  if (payload.telemetry?.available) {
    const range = payload.telemetry.range
      ? `${payload.telemetry.range.from} .. ${payload.telemetry.range.to}`
      : "range: n/a";
    console.log(
      `[ff-doctor] telemetry: ${payload.telemetry.events} exposures from ${payload.telemetry.files} file(s) (last ${options.days}d, min ${options.minExposures}) ${range ? `| ${range}` : ""}`,
    );
  } else {
    const telemetryFilesCount = payload.telemetry?.files ?? telemetryFiles.length;
    console.log(
      telemetryFilesCount
        ? `[ff-doctor] telemetry: no exposure events in last ${options.days}d`
        : "[ff-doctor] telemetry: no data (pass --telemetry <path> to include)",
    );
  }
  console.log(`[ff-doctor] unused flags: ${payload.unused.length}`);
  payload.unused.forEach((detail) => {
    const telemetryTag = detail.telemetryAvailable ? "telemetry" : "no-telemetry";
    const fuzzyTag = detail.fuzzyReferences > 0 ? `, fuzzy=${detail.fuzzyReferences}` : "";
    console.log(
      `  - ${detail.name} (confidence=${detail.confidence}, refs=${detail.references}, exposures=${detail.exposures}, ${telemetryTag}${fuzzyTag})`,
    );
  });
  console.log(`[ff-doctor] stale flags: ${payload.stale.length}`);
  payload.stale.forEach((detail) => {
    console.log(
      `  - ${detail.name} (confidence=${detail.confidence}, refs=${detail.references}, exposures=${detail.exposures}, threshold=${detail.threshold})`,
    );
  });
  console.log(`[ff-doctor] fuzzy-only references: ${payload.fuzzyOnly.length}`);
  payload.fuzzyOnly.forEach((entry) => {
    const sample = entry.samples[0];
    const location = sample ? `${sample.file}:${sample.line}:${sample.col}` : "n/a";
    console.log(
      `  - ${entry.name} (fuzzy=${entry.fuzzyRefs}, exposures=${entry.exposures}, sample=${location})`,
    );
  });
  console.log(`[ff-doctor] errors: ${payload.errors.length}`);
  payload.errors.forEach((e) => console.log(`  - ${e}`));

  if (options.hint && payload.unknown.length) {
    console.log("\n[ff-doctor] hints for allow-list:");
    const printed = new Set();
    for (const entry of payload.unknown) {
      if (printed.has(entry.name)) continue;
      printed.add(entry.name);
      console.log(`  allow-unknown: ${entry.name}`);
    }
  }

  process.exit(payload.errors.length ? 1 : payload.warnings.length ? 2 : 0);
}

async function runWatchMode({ options, hasAst, outPath }) {
  const { watch } = await import("chokidar");
  const watchTargets = computeWatchTargets(options);
  const watcher = watch(watchTargets, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
  });

  const emit = (event) => {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  };

  const normalizedOutPath = outPath ? path.resolve(outPath) : null;
  let sequence = 0;

  const runAnalysis = async (reason) => {
    const startedAt = Date.now();
    try {
      const result = await performScan({ options, hasAst });
      if (outPath) {
        writeOutputFile(result.payload, outPath);
      }
      sequence += 1;
      emit({
        type: "run",
        sequence,
        startedAt: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        reason,
        warnings: result.payload.warnings,
        errors: result.payload.errors,
        diagnostics: result.payload.diagnostics ?? [],
        result: result.payload,
      });
    } catch (error) {
      sequence += 1;
      emit({
        type: "run-error",
        sequence,
        startedAt: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        reason,
        error: serializeError(error),
      });
    }
  };

  let running = false;
  let pending = false;
  let pendingReason = null;

  const scheduleRun = (reason) => {
    if (running) {
      pending = true;
      pendingReason = reason;
      return;
    }
    running = true;
    pendingReason = null;
    runAnalysis(reason).finally(() => {
      running = false;
      if (pending) {
        pending = false;
        const nextReason = pendingReason ?? { type: "fs-event" };
        pendingReason = null;
        scheduleRun(nextReason);
      }
    });
  };

  watcher.on("all", (event, changedPath) => {
    if (normalizedOutPath && changedPath && path.resolve(changedPath) === normalizedOutPath) {
      return;
    }
    scheduleRun({ type: "fs-event", event, path: path.relative(ROOT, changedPath ?? "") });
  });

  watcher.on("error", (error) => {
    emit({
      type: "watch-error",
      timestamp: new Date().toISOString(),
      error: serializeError(error),
    });
  });

  let readyEmitted = false;
  watcher.on("ready", () => {
    if (readyEmitted) return;
    readyEmitted = true;
    emit({
      type: "watch-ready",
      timestamp: new Date().toISOString(),
      targets: watchTargets.map((target) => path.relative(ROOT, target)),
    });
  });

  const shutdown = (signal) => {
    emit({ type: "watch-stop", signal, timestamp: new Date().toISOString() });
    watcher.close().finally(() => {
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  emit({
    type: "watch-start",
    timestamp: new Date().toISOString(),
    options: { days: options.days, minExposures: options.minExposures },
    targets: watchTargets.map((target) => path.relative(ROOT, target)),
  });

  scheduleRun({ type: "initial" });
}
