const noDynamicFfKey = require("./rules/no-dynamic-ff-key.cjs");
const noFfServerInClient = require("./rules/no-ff-server-in-client.cjs");
const noTelemetryInServer = require("./rules/no-telemetry-in-server.cjs");

module.exports = {
  rules: {
    "no-ff-server-in-client": noFfServerInClient,
    "no-dynamic-ff-key": noDynamicFfKey,
    "no-telemetry-in-server": noTelemetryInServer,
  },
  configs: {
    recommended: {
      plugins: ["ff-safe"],
      rules: {
        "ff-safe/no-ff-server-in-client": "error",
        "ff-safe/no-dynamic-ff-key": "error",
        "ff-safe/no-telemetry-in-server": "error",
      },
    },
  },
};
