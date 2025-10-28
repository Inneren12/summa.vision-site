// RareVizBudgetPlugin — валидатор, что тяжёлые визуализационные либы не попадают в initial chunks.
// Экспортируем и default, и именованный — чтобы next.config.mjs мог импортировать как угодно.

const RARE_PACKAGES = new Set([
  "maplibre-gl",
  "echarts",
  "@deck.gl/core",
  "@deck.gl/layers",
  "@deck.gl/aggregation-layers",
]);

const CSS_EXTS = new Set([".css", ".scss", ".sass", ".less"]);

function extOf(resource) {
  if (!resource) return "";
  const i = resource.lastIndexOf(".");
  return i >= 0 ? resource.slice(i).toLowerCase() : "";
}

function isCssModule(mod) {
  const res = mod?.resource || "";
  const type = mod?.type ? String(mod.type) : "";
  return CSS_EXTS.has(extOf(res)) || type.includes("css");
}

function shortName(str = "") {
  return str.replace(process.cwd(), "").replace(/\\\\/g, "/");
}

function idOf(mod) {
  return mod?.identifier ? mod.identifier() : mod?.resource || mod?.rawRequest || String(mod);
}

function hitRarePackage(mod) {
  const req = mod?.rawRequest || "";
  const res = mod?.resource || "";
  for (const name of RARE_PACKAGES) {
    if (req === name) return name;
    if (res && res.includes(`/node_modules/${name}/`)) return name;
  }
  return null;
}

function traceImportChains(compilation, mod, maxChains = 3, maxDepth = 8) {
  const { moduleGraph } = compilation;
  const chains = [];
  const seen = new Set();
  function walk(m, path) {
    if (!m) return;
    const key = idOf(m);
    if (seen.has(key)) return;
    seen.add(key);
    const conns = moduleGraph.getIncomingConnections(m) || [];
    if (conns.length === 0 || path.length >= maxDepth) {
      chains.push(path);
      return;
    }
    for (const c of conns) {
      const importer = c.originModule;
      walk(importer, [shortName(idOf(importer)), ...path]);
      if (chains.length >= maxChains) break;
    }
  }
  walk(mod, [shortName(idOf(mod))]);
  return chains;
}

class RareVizBudgetPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap("RareVizBudgetPlugin", (compilation) => {
      compilation.hooks.processAssets.tapAsync(
        {
          name: "RareVizBudgetPlugin",
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        (assets, done) => {
          // Аварийный тумблер (на случай CI-разборов)
          if (process.env.NEXT_DISABLE_VIZ_BUDGETS === "1") {
            console.warn("[viz-bundle] Rare viz budget disabled via NEXT_DISABLE_VIZ_BUDGETS=1");
            return done();
          }

          const offenders = [];
          const { chunkGraph } = compilation;

          for (const chunk of compilation.chunks) {
            if (!chunk.canBeInitial()) continue; // проверяем только initial
            for (const mod of chunkGraph.getChunkModulesIterable(chunk)) {
              if (!mod) continue;
              if (isCssModule(mod)) continue; // CSS не считаем нарушением
              const hit = hitRarePackage(mod);
              if (hit) offenders.push({ mod, hit });
            }
          }

          if (offenders.length) {
            const lines = offenders.map(({ mod, hit }) => {
              const chains = traceImportChains(compilation, mod, 3, 10);
              const chainText =
                chains.length > 0
                  ? chains.map((c) => `     • ${c.join("  ←  ")}`).join("\n")
                  : "     • <no-chain>";
              return ` - ${hit}\n   module: ${shortName(idOf(mod))}\n   chains:\n${chainText}`;
            });
            const msg =
              "Rare visualization packages were bundled into initial chunks:\n" +
              lines.join("\n") +
              "\nEnsure maplibre, ECharts, and deck.gl adapters are lazily loaded per story.";
            throw new Error(msg);
          }
          done();
        },
      );
    });
  }
}

export { RareVizBudgetPlugin };
export default RareVizBudgetPlugin;
