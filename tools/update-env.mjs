#!/usr/bin/env node
/**
 * 同步 chavyleung/scripts 的 Env,并把最新 Env.min.js 嵌入各消费脚本。
 *
 * 来源配置见 tools/env-sources.json;定时任务见 .github/workflows/update-env.yml。
 * 用法: node tools/update-env.mjs
 *
 * 嵌入逻辑: 每个消费脚本末尾都有且仅有一行 `function Env(...){...}`(单行压缩版),
 * 整行替换为最新 Env.min.js 内容即可,调用处 `new Env("xxx.js")` 签名不变、不受影响。
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../..');
const manifest = JSON.parse(await readFile(join(repoRoot, 'tools/env-sources.json'), 'utf8'));

// 1. 拉取上游 Env 文件(写入前校验内容,防止上游返回 HTML 错误页污染仓库)
function assertEnvContent(body, label) {
  if (body.trimStart().startsWith('<') || /<!doctype|<html[\s>]/i.test(body)) {
    throw new Error(`${label}: 下载内容疑似 HTML 错误页,已中止`);
  }
  if (!body.includes('function Env(')) {
    throw new Error(`${label}: 下载内容不含 "function Env(",已中止`);
  }
  if (body.length < 5000) {
    throw new Error(`${label}: 下载内容仅 ${body.length} 字节,疑似异常,已中止`);
  }
}

for (const { url, dest } of manifest.downloads) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`下载失败 ${url}: HTTP ${res.status}`);
  const body = await res.text();
  assertEnvContent(body, dest);
  await writeFile(join(repoRoot, dest), body);
  console.log(`✓ 已更新 ${dest} (${body.length} 字节)`);
}

// 2. 取最新 Env.min.js 单行内容
const { source, scanDir, exclude } = manifest.embed;
const envMin = (await readFile(join(repoRoot, source), 'utf8')).trim();
if (envMin.includes('\n')) {
  throw new Error(`${source} 含换行,不是单行压缩格式,无法安全嵌入,已中止`);
}

// 3. 递归收集消费脚本(*.js,排除 Env 自身)
const excludeSet = new Set(exclude.map((p) => resolve(repoRoot, p)));
async function collectJs(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectJs(full)));
    else if (entry.name.endsWith('.js') && !excludeSet.has(resolve(full))) out.push(full);
  }
  return out;
}
const targets = await collectJs(join(repoRoot, scanDir));

// 4. 替换每个文件里的 `function Env(...)` 行
let changed = 0;
let skipped = 0;
for (const file of targets) {
  const rel = relative(repoRoot, file);
  const lines = (await readFile(file, 'utf8')).split('\n');
  // 仅匹配压缩版 Env 定义行:以 function Env( 开头且足够长(压缩版必 >1KB),
  // 避免误命中注释/字符串里的 "function Env(" 字面量
  const matches = [];
  lines.forEach((l, i) => {
    if (l.trimStart().startsWith('function Env(') && l.length > 1000) matches.push(i);
  });

  if (matches.length === 0) {
    console.warn(`⚠ 跳过 ${rel}: 未找到 function Env( 行`);
    skipped++;
    continue;
  }
  if (matches.length > 1) {
    throw new Error(`${rel}: 找到 ${matches.length} 处 function Env(,无法安全替换`);
  }

  const lineNo = matches[0];
  if (lines[lineNo] === envMin) {
    console.log(`= ${rel}: Env 已是最新`);
    continue;
  }
  lines[lineNo] = envMin;
  await writeFile(file, lines.join('\n'));
  console.log(`✓ ${rel}: 已替换 Env (第 ${lineNo + 1} 行)`);
  changed++;
}

console.log(`\n完成: ${changed} 个文件已更新,${skipped} 个跳过,共扫描 ${targets.length} 个消费脚本。`);
