import { spawn } from "node:child_process";
const [command, ...extra] = process.argv.slice(2);
const render = process.env.RENDER || process.env.DEPLOY_TARGET === "render";
const args = render
  ? [command === "build" ? "scripts/build-render.mjs" : "scripts/start-render.mjs", ...extra]
  : command === "build" ? ["scripts/run-framework.mjs", "build", ...extra]
  : ["--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js", "dev", "--config", "dist/server/wrangler.json", "--local", "--persist-to", ".wrangler/state", "--ip", "127.0.0.1", "--inspector-port", "0", ...extra];
const child = spawn(process.execPath, args, { stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error); process.exitCode = 1; });
child.on("exit", code => process.exit(code ?? 1));
