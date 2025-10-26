export class VizBundleBudgetPlugin {
  constructor(options = {}) {
    this.options = options;
  }

  apply(compiler) {
    const pluginName = "VizBundleBudgetPlugin";
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      const stage = compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT;
      compilation.hooks.processAssets.tap({ name: pluginName, stage }, () => {
        this.checkInitialModuleRules(compilation);
        this.checkEntryBudgets(compilation);
      });
    });
  }

  checkInitialModuleRules(compilation) {
    const rules = this.options.disallowInitial ?? [];
    if (!rules.length) {
      return;
    }

    const issues = [];
    for (const chunk of compilation.chunks) {
      if (!chunk.canBeInitial()) {
        continue;
      }
      const modules = compilation.chunkGraph.getChunkModules(chunk);
      if (!modules) {
        continue;
      }
      for (const module of modules) {
        const identifier = this.getModuleIdentifier(module);
        if (!identifier) {
          continue;
        }
        for (const rule of rules) {
          if (!rule?.test?.test(identifier)) {
            continue;
          }
          const label = rule.label ?? rule.test.toString();
          issues.push({
            severity: rule.severity ?? "warning",
            message: `Module "${label}" is included in initial chunk "${chunk.name ?? "<unknown>"}"`,
          });
        }
      }
    }

    for (const issue of issues) {
      this.pushIssue(compilation, issue);
    }
  }

  checkEntryBudgets(compilation) {
    const budgets = this.options.entryBudgets ?? [];
    if (!budgets.length) {
      return;
    }

    for (const [name, entrypoint] of compilation.entrypoints) {
      for (const budget of budgets) {
        if (!budget?.test?.test(name)) {
          continue;
        }
        if (budget.maxInitialBytes) {
          const initialChunks = entrypoint.chunks.filter((chunk) => chunk.canBeInitial());
          const total = this.calculateChunksSize(compilation, initialChunks);
          if (total > budget.maxInitialBytes) {
            const formatted = `${this.formatBytes(total)} (limit ${this.formatBytes(budget.maxInitialBytes)})`;
            this.pushIssue(compilation, {
              severity: budget.severity ?? "warning",
              message: `Initial chunks for entry "${name}" exceed budget: ${formatted}`,
            });
          }
        }
      }
    }
  }

  calculateChunksSize(compilation, chunks) {
    let total = 0;
    for (const chunk of chunks) {
      for (const file of chunk.files) {
        const asset = compilation.getAsset(file);
        if (!asset) {
          continue;
        }
        total += asset.source.size();
      }
    }
    return total;
  }

  pushIssue(compilation, issue) {
    const target = issue.severity === "error" ? compilation.errors : compilation.warnings;
    target.push(new Error(`[viz-bundle] ${issue.message}`));
  }

  getModuleIdentifier(module) {
    if (!module) {
      return "";
    }
    if (typeof module.resource === "string") {
      return module.resource;
    }
    if (module.rootModule && typeof module.rootModule.resource === "string") {
      return module.rootModule.resource;
    }
    if (typeof module.identifier === "function") {
      try {
        return module.identifier();
      } catch {
        return "";
      }
    }
    return "";
  }

  formatBytes(value) {
    const kb = value / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} kB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }
}
