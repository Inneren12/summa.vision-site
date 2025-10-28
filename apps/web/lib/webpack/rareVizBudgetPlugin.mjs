const RARE_PACKAGES = new Set([
  "maplibre-gl",
  "echarts",
  "@deck.gl/core",
  "@deck.gl/layers",
  "@deck.gl/aggregation-layers",
]);
const CSS_EXTS = new Set([".css", ".scss", ".sass", ".less"]);

function normalizePath(str) {
  return typeof str === "string" ? str.replace(/\\/g, "/") : str;
}

const CWD = normalizePath(process.cwd());

function extOf(resource) {
  if (!resource) return "";
  const i = resource.lastIndexOf(".");
  return i >= 0 ? resource.slice(i).toLowerCase() : "";
}

function isCssModule(mod) {
  const res = mod?.resource || "";
  if (CSS_EXTS.has(extOf(res))) return true;
  if (mod?.type && String(mod.type).includes("css")) return true;
  if (mod?.rootModule) return isCssModule(mod.rootModule);
  return false;
}

function shortName(str = "") {
  const normalized = normalizePath(str || "");
  return normalized.startsWith(CWD) ? normalized.slice(CWD.length) : normalized;
}

function formatMod(mod) {
  if (!mod) return "<unknown>";
  if (typeof mod.resource === "string") return shortName(mod.resource);
  if (typeof mod.identifier === "function") return shortName(mod.identifier());
  return shortName(String(mod));
}

function* moduleResources(mod) {
  if (!mod) return;
  if (typeof mod.resource === "string") yield normalizePath(mod.resource);
  if (typeof mod.rawRequest === "string") yield normalizePath(mod.rawRequest);
  if (mod.rootModule && mod.rootModule !== mod) yield* moduleResources(mod.rootModule);
  if (Array.isArray(mod.modules)) {
    for (const child of mod.modules) {
      if (child && child !== mod) yield* moduleResources(child);
    }
  }
}

function matchesRarePackage(str, pkg) {
  if (!str) return false;
  if (str === pkg) return true;
  return str.includes(`/node_modules/${pkg}/`);
}

function traceImportChains(compilation, mod, maxChains = 3, maxDepth = 8) {
  const { moduleGraph } = compilation;
  const chains = [];
  const seen = new Set();

  function walk(current, path) {
    if (!current) return;
    const key =
      typeof current.identifier === "function"
        ? current.identifier()
        : current.resource || String(current);
    if (seen.has(key)) return;
    seen.add(key);

    const conns = moduleGraph.getIncomingConnections(current) || [];
    if (conns.length === 0 || path.length >= maxDepth) {
      chains.push(path);
      return;
    }

    for (const conn of conns) {
      const importer = conn.originModule;
      const nextPath = [formatMod(importer), ...path];
      walk(importer, nextPath);
      if (chains.length >= maxChains) break;
    }
  }

  walk(mod, [formatMod(mod)]);
  return chains;
}

function findMatchingPackage(mod) {
  for (const candidate of moduleResources(mod)) {
    for (const pkg of RARE_PACKAGES) {
      if (matchesRarePackage(candidate, pkg)) {
        return pkg;
      }
    }
  }
  return null;
}

function getModuleId(mod) {
  if (!mod) return "";
  if (typeof mod.identifier === "function") return mod.identifier();
  return mod.resource || mod.rawRequest || "";
}

export default class RareVizBudgetPlugin {
  apply(compiler) {
    const isClientCompiler = !compiler.options.name || compiler.options.name === "client";
    if (!isClientCompiler) {
      return;
    }

    compiler.hooks.thisCompilation.tap("RareVizBudgetPlugin", (compilation) => {
      compilation.hooks.processAssets.tapAsync(
        {
          name: "RareVizBudgetPlugin",
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        (_assets, done) => {
          if (process.env.NEXT_DISABLE_VIZ_BUDGETS === "1") {
            console.warn("[viz-bundle] Rare viz budget disabled via NEXT_DISABLE_VIZ_BUDGETS=1");
            return done();
          }

          if (compiler.options.mode !== "production") {
            return done();
          }

          const { chunkGraph } = compilation;
          if (!chunkGraph) {
            return done();
          }

          const offenders = new Map();

          for (const chunk of compilation.chunks) {
            const isInitial =
              typeof chunk.canBeInitial === "function"
                ? chunk.canBeInitial()
                : chunk.isOnlyInitial?.();
            if (!isInitial) continue;

            for (const mod of chunkGraph.getChunkModulesIterable(chunk)) {
              if (isCssModule(mod)) continue;
              const match = findMatchingPackage(mod);
              if (!match) continue;
              const id = getModuleId(mod);
              const bucket = offenders.get(id) ?? {
                pkgs: new Set(),
                chunks: new Set(),
              };
              bucket.pkgs.add(match);
              const chunkName =
                chunk.name || (chunk.id != null ? String(chunk.id) : "<unnamed chunk>");
              bucket.chunks.add(chunkName);
              offenders.set(id, bucket);
            }
          }

          if (offenders.size) {
            const moduleIndex = new Map();
            for (const mod of compilation.modules) {
              moduleIndex.set(getModuleId(mod), mod);
            }

            const lines = [];
            for (const [id, info] of offenders.entries()) {
              const mod = moduleIndex.get(id);
              const chains = traceImportChains(compilation, mod);
              const chainText = chains.length
                ? chains.map((chain) => `     • ${chain.join("  ←  ")}`).join("\n")
                : "     • <no import chain found>";
              const chunks = [...info.chunks].sort().join(", ") || "<unknown chunk>";
              lines.push(
                ` - ${[...info.pkgs].sort().join(", ")}\n   module: ${shortName(id)}\n   chunks: ${chunks}\n   chains:\n${chainText}`,
              );
            }

            const message =
              "Rare visualization packages were bundled into initial chunks:\n" +
              lines.join("\n") +
              "\nEnsure maplibre, ECharts, and deck.gl adapters are lazily loaded per story.";
            done(new Error(message));
            return;
          }

          done();
        },
      );
    });
  }
}
