#!/usr/bin/env node
/**
 * 同步 README「关联脚本」中列出的第三方脚本到本地只读镜像。
 *
 *   node third-party/sync.mjs            # 下载并更新 userscripts/ 与 manifest.json
 *   node third-party/sync.mjs --check    # 只比对，不写盘；有差异时退出码为 1
 *   node third-party/sync.mjs --only=betterx --only=douyin-dl
 *
 * 依赖：Node 18+ 内置 fetch，无第三方依赖。
 *
 * 设计取舍：
 *  - 落地文件名用稳定的 ASCII 名（manifest.file），上游文件名（manifest.upstreamFile）
 *    只记录不用 —— 上游若把版本号写进资产名（如 BetterX-v4.0.0.js），用它当本地名会
 *    导致每次升级都多一个文件。
 *  - 不修改内容：脚本原样落盘，`@version` 只读不改。镜像不是分支，不做本地补丁。
 *  - 先试 manifest.url，再试 alternates（Release 资产常被墙，走镜像；大小与 sha256 兜底校验）。
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(ROOT, "manifest.json");
const OUT_DIR = join(ROOT, "userscripts");
const UA = "GMScript-sync/1.0 (+https://github.com/lytree/GMScript)";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const only = args.filter((a) => a.startsWith("--only=")).map((a) => a.slice(7));

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

function readVersion(text) {
  const match = text.match(/^\/\/\s*@version\s+(\S+)\s*$/m);
  return match ? match[1] : null;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!text.includes("==UserScript==")) throw new Error("响应不是油猴脚本（缺少 ==UserScript== 头）");
  return text;
}

async function download(entry) {
  const candidates = [entry.url, ...(entry.alternates || [])];
  const failures = [];
  for (const url of candidates) {
    try {
      const text = await fetchText(url);
      return { text, source: url };
    } catch (error) {
      failures.push(`${new URL(url).hostname}: ${error.message}`);
    }
  }
  throw new Error(failures.join(" / "));
}

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const targets = manifest.scripts.filter((s) => !only.length || only.includes(s.id));
if (!targets.length) {
  console.error(red(`没有匹配的脚本：${only.join(", ")}`));
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

let dirty = false;
let failed = 0;
const rows = [];

for (const entry of targets) {
  const target = join(OUT_DIR, entry.file);
  let local = null;
  try {
    local = await readFile(target, "utf8");
  } catch {
    /* 首次同步，文件还不存在 */
  }

  let text;
  let source;
  try {
    ({ text, source } = await download(entry));
  } catch (error) {
    failed += 1;
    rows.push([entry.id, red("下载失败"), error.message.slice(0, 60)]);
    continue;
  }

  const hash = sha256(Buffer.from(text, "utf8"));
  const version = readVersion(text);
  const same = local !== null && sha256(Buffer.from(local, "utf8")) === hash;
  const versionNote = entry.version && version && entry.version !== version
    ? `${entry.version} → ${yellow(version)}`
    : version || "?";

  if (same) {
    rows.push([entry.id, green("未变"), `${versionNote}  ${kb(Buffer.byteLength(text))}`]);
    continue;
  }

  dirty = true;
  if (checkOnly) {
    rows.push([entry.id, yellow(local ? "有更新" : "缺文件"), `${versionNote}  ${kb(Buffer.byteLength(text))}`]);
    continue;
  }

  await writeFile(target, text, "utf8");
  entry.version = version || entry.version;
  entry.size = Buffer.byteLength(text);
  entry.sha256 = hash;
  rows.push([entry.id, local ? yellow("已更新") : green("已新增"), `${versionNote}  ${kb(entry.size)}  来自 ${new URL(source).hostname}`]);
}

const width = Math.max(...rows.map((r) => r[0].length), 4);
for (const [id, state, detail] of rows) {
  console.log(`${id.padEnd(width)}  ${state}  ${detail}`);
}

if (!checkOnly && dirty) {
  manifest.syncedAt = new Date().toISOString().slice(0, 10);
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`\nmanifest.json 已更新（syncedAt=${manifest.syncedAt}）`);
} else if (checkOnly && dirty) {
  console.log("\n存在未同步的变更；去掉 --check 重新执行以写入。");
}

if (failed) {
  console.error(red(`\n${failed} 个脚本下载失败。`));
  process.exit(1);
}
if (checkOnly && dirty) process.exit(1);
