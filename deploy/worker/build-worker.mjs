import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir("dist", { recursive: true });

const result = await build({
  absWorkingDir: resolve("."),
  entryPoints: ["worker/dm-worker.ts"],
  outfile: "dist/worker.mjs",

  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",

  sourcemap: true,
  metafile: true,
  minifySyntax: true,

  // BullMQ and ioredis contain CommonJS code that may use require().
  banner: {
    js: `
import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);
`,
  },

  // Resolve the project's @/* imports without requiring tsx at runtime.
  plugins: [
    {
      name: "openinstadm-root-alias",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^@\// }, (args) =>
          buildContext.resolve(`./${args.path.slice(2)}`, {
            kind: args.kind,
            resolveDir: resolve("."),
          })
        );
      },
    },
  ],

  // Prisma dynamically imports provider-specific runtime and WASM files.
  // Leave these packages intact in runtime node_modules.
  external: [
    "@prisma/client",
    "@prisma/client/*",
    "@prisma/adapter-pg",
    "pg",
  ],

  logLevel: "info",
});

await writeFile(
  "dist/esbuild-meta.json",
  JSON.stringify(result.metafile, null, 2)
);
