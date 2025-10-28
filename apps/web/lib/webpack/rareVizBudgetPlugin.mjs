const RARE_PACKAGE_MATCHERS = [
  { test: /[\\/]node_modules[\\/]maplibre-gl[\\/]/, label: "maplibre-gl" },
  { test: /[\\/]node_modules[\\/]echarts[\\/]/, label: "echarts" },
  { test: /[\\/]node_modules[\\/]@deck\.gl[\\/]/, label: "@deck.gl" },
];

function getModuleResource(module) {
  if (!module) {
    return null;
  }
  if (typeof module.resource === "string") {
    return module.resource;
  }
  if (module.rootModule && typeof module.rootModule.resource === "string") {
    return module.rootModule.resource;
  }
  if (typeof module.identifier === "function") {
    const id = module.identifier();
    if (typeof id === "string") {
      return id;
    }
  }
  return null;
}

function matchRarePackage(resource) {
  for (const matcher of RARE_PACKAGE_MATCHERS) {
    if (matcher.test.test(resource)) {
      return matcher.label;
    }
  }
  return null;
}

function formatOffenders(offenders) {
  return Array.from(offenders.entries())
    .map(([chunkName, packages]) => ` - ${chunkName}: ${Array.from(packages).sort().join(", ")}`)
    .join("\n");
}

export class RareVizBudgetPlugin {
  apply(compiler) {
    const isClientCompiler = !compiler.options.name || compiler.options.name === "client";
    if (!isClientCompiler) {
      return;
    }

    compiler.hooks.done.tap("RareVizBudgetPlugin", (stats) => {
      if (compiler.options.mode !== "production") {
        return;
      }

      const compilation = stats?.compilation;
      const chunkGraph = compilation?.chunkGraph;
      if (!compilation || !chunkGraph) {
        return;
      }

      const offenders = new Map();

      for (const chunk of compilation.chunks) {
        const isInitial =
          typeof chunk.canBeInitial === "function" ? chunk.canBeInitial() : chunk.isOnlyInitial?.();
        if (!isInitial) {
          continue;
        }

        const modules = chunkGraph.getChunkModulesIterable(chunk);
        for (const module of modules) {
          const resource = getModuleResource(module);
          if (!resource) {
            continue;
          }
          const label = matchRarePackage(resource);
          if (!label) {
            continue;
          }

          const key = chunk.name || (chunk.id != null ? String(chunk.id) : "<unnamed>");
          const set = offenders.get(key) ?? new Set();
          set.add(label);
          offenders.set(key, set);
        }
      }

      if (offenders.size > 0) {
        const formatted = formatOffenders(offenders);
        throw new Error(
          "Rare visualization packages were bundled into initial chunks:\n" +
            formatted +
            "\nEnsure maplibre, ECharts, and deck.gl adapters are lazily loaded per story.",
        );
      }
    });
  }
}
