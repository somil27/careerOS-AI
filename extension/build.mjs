#!/usr/bin/env bun
// Build the Chrome extension into extension/dist/ and package it as a zip
// served from public/ so the app can offer a download link.
import { rmSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "dist");
const publicDir = resolve(here, "public");
const zipOut = resolve(here, "..", "public", "careeros-extension.zip");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Copy static assets: manifest, popup.html, popup.css, icon.png
cpSync(resolve(here, "manifest.json"), resolve(dist, "manifest.json"));
if (existsSync(publicDir)) cpSync(publicDir, dist, { recursive: true });

const entrypoints = [
  resolve(here, "src/popup.tsx"),
  resolve(here, "src/background.ts"),
  resolve(here, "src/content-jobs.ts"),
  resolve(here, "src/content-auth.ts"),
];

const result = await Bun.build({
  entrypoints,
  outdir: dist,
  target: "browser",
  format: "esm",
  minify: true,
  splitting: false,
  naming: "[name].js",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// Package as zip using nix-provided zip binary.
mkdirSync(dirname(zipOut), { recursive: true });
rmSync(zipOut, { force: true });
await $`nix run nixpkgs#zip -- -r ${zipOut} .`.cwd(dist);

console.log(`✅ Built extension at ${dist}`);
console.log(`✅ Packaged zip at ${zipOut}`);
