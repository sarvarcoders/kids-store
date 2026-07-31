import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const budgetBytes = 200 * 1_024;
const appDirectory = resolve(import.meta.dirname, "..");
const htmlPath = resolve(appDirectory, ".next", "server", "app", "index.html");

if (!existsSync(htmlPath)) {
  throw new Error("Mini App production build topilmadi. Avval pnpm build:mini-app ishlating.");
}

const html = readFileSync(htmlPath, "utf8");
const assetMatches = html.matchAll(/(?:src|href)="\/?_next\/(static\/[^"?]+\.js)(?:\?[^\"]*)?"/g);
const assets = Array.from(
  new Set(Array.from(assetMatches, (match) => match[1]).filter(Boolean)),
);

if (assets.length === 0) {
  throw new Error("Initial route JavaScript assetlari aniqlanmadi.");
}

const measurements = assets.map((asset) => {
  const filePath = resolve(appDirectory, ".next", asset);
  const content = readFileSync(filePath);

  return {
    asset,
    gzipBytes: gzipSync(content).byteLength,
    rawBytes: content.byteLength,
  };
});
const gzipBytes = measurements.reduce((total, item) => total + item.gzipBytes, 0);
const rawBytes = measurements.reduce((total, item) => total + item.rawBytes, 0);
const result = {
  route: "/",
  assetCount: measurements.length,
  rawBytes,
  gzipBytes,
  budgetBytes,
  withinBudget: gzipBytes <= budgetBytes,
  largestAssets: measurements
    .toSorted((left, right) => right.gzipBytes - left.gzipBytes)
    .slice(0, 5),
};

process.stdout.write(`${JSON.stringify(result)}\n`);

if (!result.withinBudget) {
  process.exitCode = 1;
}
