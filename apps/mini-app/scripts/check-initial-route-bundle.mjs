import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const budgetBytes = 200 * 1_024;
const routeBudgetBytes = 180 * 1_024;
const appDirectory = resolve(import.meta.dirname, "..");
const htmlPath = resolve(appDirectory, ".next", "server", "app", "index.html");
const routeStatsPath = resolve(
  appDirectory,
  ".next",
  "diagnostics",
  "route-bundle-stats.json",
);

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
const routeStats = JSON.parse(readFileSync(routeStatsPath, "utf8"));

if (!Array.isArray(routeStats)) {
  throw new Error("Next.js route bundle statistikasi noto‘g‘ri formatda.");
}

const routeMeasurements = routeStats.map((routeStat) => {
  if (
    typeof routeStat !== "object" ||
    routeStat === null ||
    typeof routeStat.route !== "string" ||
    !Array.isArray(routeStat.firstLoadChunkPaths)
  ) {
    throw new Error("Next.js route bundle yozuvi noto‘g‘ri formatda.");
  }

  const chunkPaths = routeStat.firstLoadChunkPaths.filter(
    (chunkPath) => typeof chunkPath === "string",
  );
  const firstLoadGzipBytes = chunkPaths.reduce(
    (total, chunkPath) =>
      total + gzipSync(readFileSync(resolve(appDirectory, chunkPath))).byteLength,
    0,
  );

  return {
    route: routeStat.route,
    firstLoadGzipBytes,
    withinBudget: firstLoadGzipBytes <= routeBudgetBytes,
    chunkPaths,
  };
});
const clientChunkPaths = Array.from(
  new Set(routeMeasurements.flatMap((route) => route.chunkPaths)),
);
const zodRuntimeAssets = clientChunkPaths.filter((chunkPath) =>
  readFileSync(resolve(appDirectory, chunkPath), "utf8").includes(
    "__zod_globalConfig",
  ),
);
const result = {
  route: "/",
  assetCount: measurements.length,
  rawBytes,
  gzipBytes,
  budgetBytes,
  withinBudget: gzipBytes <= budgetBytes,
  routeBudgetBytes,
  routesWithinBudget: routeMeasurements.every((route) => route.withinBudget),
  routeMeasurements: routeMeasurements.map((route) => ({
    route: route.route,
    firstLoadGzipBytes: route.firstLoadGzipBytes,
    withinBudget: route.withinBudget,
  })),
  zodRuntimeAssets,
  largestAssets: measurements
    .toSorted((left, right) => right.gzipBytes - left.gzipBytes)
    .slice(0, 5),
};

process.stdout.write(`${JSON.stringify(result)}\n`);

if (
  !result.withinBudget ||
  !result.routesWithinBudget ||
  result.zodRuntimeAssets.length > 0
) {
  process.exitCode = 1;
}
