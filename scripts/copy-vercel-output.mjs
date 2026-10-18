import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const webVercelOutput = path.join(rootDir, "apps", "web", ".vercel", "output");
const rootVercelOutput = path.join(rootDir, ".vercel", "output");
const rootDist = path.join(rootDir, "dist");

console.log("[build-sync] Synchronizing build outputs for Vercel deployment...");

// 1. Sync .vercel/output to root if present (for Vercel Build Output API v3)
if (fs.existsSync(webVercelOutput)) {
  fs.mkdirSync(rootVercelOutput, { recursive: true });
  fs.cpSync(webVercelOutput, rootVercelOutput, { recursive: true, force: true });
  console.log(`[build-sync] Copied ${webVercelOutput} -> ${rootVercelOutput}`);
}

// 2. Sync static assets to dist/ to satisfy static directory validation in Vercel
const staticCandidates = [
  path.join(webVercelOutput, "static"),
  path.join(rootDir, "apps", "web", ".output", "public"),
  path.join(rootDir, "apps", "web", ".output"),
];

let syncedStatic = false;
for (const candidate of staticCandidates) {
  if (fs.existsSync(candidate)) {
    fs.mkdirSync(rootDist, { recursive: true });
    fs.cpSync(candidate, rootDist, { recursive: true, force: true });
    console.log(`[build-sync] Copied static output ${candidate} -> ${rootDist}`);
    syncedStatic = true;
    break;
  }
}

if (!syncedStatic) {
  fs.mkdirSync(rootDist, { recursive: true });
  fs.writeFileSync(
    path.join(rootDist, "index.html"),
    "<!DOCTYPE html><html><head><meta http-equiv=\"refresh\" content=\"0;url=/\"></head><body>KromPay HRMS</body></html>",
    "utf8"
  );
  console.log(`[build-sync] Created fallback index.html in ${rootDist}`);
}

console.log("[build-sync] Deployment output synchronization complete.");
