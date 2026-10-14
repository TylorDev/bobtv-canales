import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runMonitor } from "./run";
import { parseStatusDocument } from "../shared/status";

async function main() {
  const output = resolve(process.argv[2] ?? "public/data/status.json");
  const catalog = await readFile("canales.m3u", "utf8");
  const catalogCommit = execFileSync(
    "git",
    ["log", "-1", "--format=%H", "--", "canales.m3u"],
    { encoding: "utf8" },
  ).trim();
  const github = process.env.GITHUB_ACTIONS === "true";
  const runUrl =
    github && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null;
  const report = parseStatusDocument(
    await runMonitor({
      catalog,
      catalogCommit,
      origin: {
        name: github ? "GitHub Actions" : "Entorno local (no GitHub Actions)",
        runUrl,
      },
    }),
  );
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`);
  await rename(temporary, output);
  console.log(
    `Publicado informe local: ${report.channels.length} canales, ${report.channels.reduce((n, c) => n + c.sources.length, 0)} fuentes. Origen: ${report.origin.name}.`,
  );
}
main().catch((error) => {
  console.error("Fallo general: se conserva el último informe.", error);
  process.exitCode = 1;
});
