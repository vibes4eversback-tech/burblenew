import { spawnSync } from "node:child_process";

// The original starter still contains legacy Prisma routes that Next discovers
// during compilation. Burble itself uses Supabase, so generation only exists to
// keep those untouched legacy modules from breaking a production build.
const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://placeholder:placeholder@localhost:5432/placeholder",
};

function run(command, args) {
  const result = spawnSync(process.execPath, [command, ...args], {
    stdio: "inherit",
    env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("node_modules/prisma/build/index.js", ["generate"]);
run("node_modules/next/dist/bin/next", ["build", "--webpack"]);
