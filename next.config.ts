import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  ...(process.env.DEPLOY_TARGET === "render" ? {
    output: "standalone" as const,
    distDir: ".next-render",
    outputFileTracingRoot: process.cwd(),
    webpack(config, { webpack }) {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(
        /^cloudflare:workers$/,
        path.resolve(process.cwd(), "lib/render-env.ts"),
      ));
      return config;
    },
  } satisfies NextConfig : {}),
};

export default nextConfig;
