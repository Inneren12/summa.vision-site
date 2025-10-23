#!/usr/bin/env node
const path = require("node:path");
const { pathToFileURL } = require("node:url");

process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.PORT = process.env.PORT || "3000";

const serverPath = path.join(process.cwd(), "apps", "web", ".next", "standalone", "server.js");

import(pathToFileURL(serverPath).href).catch((error) => {
  console.error("Failed to start web server", error);
  process.exitCode = 1;
});
