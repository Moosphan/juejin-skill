#!/usr/bin/env node

import { runCli } from "../src/commands/cli.js";

runCli(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
