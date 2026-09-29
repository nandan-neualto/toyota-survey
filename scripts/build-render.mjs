import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build", "--webpack"], {
  env: { ...process.env, DEPLOY_TARGET: "render", NEXT_TELEMETRY_DISABLED: "1" }, stdio: "inherit", windowsHide: true,
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
mkdirSync(".next-render/standalone/.next-render", { recursive: true });
cpSync("public", ".next-render/standalone/public", { recursive: true });
cpSync(".next-render/static", ".next-render/standalone/.next-render/static", { recursive: true });
