import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
it("preserves the last report and exits nonzero when the actual CLI receives an invalid catalog", () => {
  const cwd = mkdtempSync(join(tmpdir(), "bobtv-cli-"));
  try {
    writeFileSync(
      join(cwd, "canales.m3u"),
      "#EXTM3U\n#EXTINF:-1,Sin identificador\nhttps://a.test/live",
    );
    writeFileSync(join(cwd, "status.json"), "last-valid-report");
    execFileSync("git", ["init", "-q"], { cwd });
    execFileSync("git", ["add", "canales.m3u"], { cwd });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-qm",
        "test catalog",
      ],
      { cwd },
    );
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        resolve("node_modules/tsx/dist/loader.mjs"),
        resolve("monitor/cli.ts"),
        "status.json",
      ],
      { cwd, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Fallo general");
    expect(readFileSync(join(cwd, "status.json"), "utf8")).toBe(
      "last-valid-report",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
