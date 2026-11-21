// 执行引擎：调用被测模型、并发跑题、聚合评分、生成报告

import { MODULES } from "./tasks.js";
import { grade } from "./graders.js";

export const DEFAULT_BASE_URL = "https://api.deepseek.com/chat/completions";
export const DEFAULT_MODEL = "deepseek-chat";

const median = (xs) => {
  const a = xs.filter((x) => typeof x === "number" && !Number.isNaN(x)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/** 调用一次模型（流式 SSE），返回正文、首字延迟、耗时、token */
export async function callModel({ prompt, baseUrl, model, apiKey, temperature = 0, timeout = 180 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout * 1000);
  const t0 = Date.now();

  const headers = { "Content-Type": "application/json", Accept: "text/event-stream" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: true,
        stream_options: { include_usage: true },
        temperature,
      }),
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`HTTP ${res.status} ${detail}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let content = "";
    let reasoning = "";
    let usage = {};
    let firstContent = null;
    let done = false;

    while (!done) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buf += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") { done = true; break; }
        let obj;
        try { obj = JSON.parse(data); } catch { continue; }
        if (obj.usage) usage = obj.usage;
        for (const ch of obj.choices || []) {
          const d = ch.delta || {};
          if (d.reasoning_content) reasoning += d.reasoning_content;
          if (d.content) {
            if (firstContent === null) firstContent = (Date.now() - t0) / 1000;
            content += d.content;
          }
        }
      }
    }

    const total = (Date.now() - t0) / 1000;
    return {
      answer: content,
      reasoning,
      ttft: firstContent === null ? total : firstContent,
      total,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      reasoningTokens: usage.completion_tokens_details?.reasoning_tokens || 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 限流并发 */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** 跑全部任务 */
export async function runAll(opts) {
  const { baseUrl, model, apiKey, repeat = 1, concurrency = 4, temperature = 0, timeout = 180, only = [] } = opts;

  const jobs = [];
  for (const m of MODULES) {
    for (const t of m.tasks) {
      if (only.length && !only.includes(t.id)) continue;
      for (let r = 0; r < repeat; r++) jobs.push({ module: m, task: t, run: r + 1 });
    }
  }

  return mapLimit(jobs, concurrency, async (job) => {
    const { task } = job;
    try {
      const out = await callModel({ prompt: task.prompt, baseUrl, model, apiKey, temperature, timeout });
      const g = grade(task, out.answer);
      return {
        ...job, ok: true, ...out,
        score: g.score, full: task.full, notes: g.notes,
        human: Boolean(task.human) || g.human,
      };
    } catch (err) {
      return {
        ...job, ok: false, error: String(err.message || err),
        answer: "", ttft: 0, total: 0, promptTokens: 0, completionTokens: 0, reasoningTokens: 0,
        score: 0, full: task.full, notes: [`执行失败: ${err.name || "Error"}`], human: false,
      };
    }
  });
}

/** 聚合评分：返回 { modules, breakdown, total, extra } */
export function scoreModules(results) {
  const byModule = new Map();
  for (const r of results) {
    const mid = r.module.id;
    if (!byModule.has(mid)) {
      byModule.set(mid, { id: mid, name: r.module.name, baseline: r.module.baseline, runs: [] });
    }
    byModule.get(mid).runs.push(r);
  }

  const modules = [];
  for (const m of byModule.values()) {
    const taskIds = [...new Set(m.runs.map((r) => r.task.id))];
    const tasks = taskIds.map((id) => {
      const rs = m.runs.filter((r) => r.task.id === id);
      const ok = rs.filter((r) => r.ok);
      const use = ok.length ? ok : rs;
      return {
        id,
        score: median(use.map((r) => r.score)),
        full: use[0].full,
        time: median(use.map((r) => r.total)),
        notes: use[0].notes || [],
        human: use[0].human,
        failed: rs.length - ok.length,
      };
    });
    modules.push({
      id: m.id, name: m.name, baseline: m.baseline, tasks,
      score: tasks.reduce((s, t) => s + t.score, 0),
      full: tasks.reduce((s, t) => s + t.full, 0),
      time: tasks.reduce((s, t) => s + t.time, 0),
      tokens: tasks.reduce((s, t) => s + median(m.runs.filter((r) => r.task.id === t.id).map((r) => r.completionTokens)), 0),
      reasoning: tasks.reduce((s, t) => s + median(m.runs.filter((r) => r.task.id === t.id).map((r) => r.reasoningTokens)), 0),
      failures: tasks.reduce((s, t) => s + t.failed, 0),
    });
  }

  const get = (id) => modules.find((m) => m.id === id);
  const acc = get("accuracy");
  const comp = get("compute");
  const fp = get("file_processing");

  const accPts = acc && acc.full ? (acc.score / acc.full) * 4000 : 0;

  let compPts = 0;
  if (comp && comp.full) {
    const correct = comp.score / comp.full;
    const speed = comp.time > 0 ? Math.min(1, comp.baseline / comp.time) : 1;
    compPts = correct * 1500 + speed * 500;
  }

  let fpPts = 0;
  if (fp && fp.full) {
    const rate = fp.score / fp.full;
    const speed = fp.time > 0 ? Math.min(1, fp.baseline / fp.time) : 1;
    fpPts = rate * 1500 + speed * 500;
  }

  const allRuns = results.filter((r) => r.ok);
  const avgTtft = allRuns.length
    ? allRuns.reduce((s, r) => s + r.ttft, 0) / allRuns.length : 0;
  const totalTokens = modules.reduce((s, m) => s + m.tokens, 0);
  const tokenPts = totalTokens > 0 ? Math.min(1, 2500 / totalTokens) * 1000 : 0;
  const ttftPts = avgTtft > 0 ? Math.min(1, 2 / avgTtft) * 1000 : 0;

  const breakdown = [
    { id: "accuracy", name: "准确性", pts: accPts, max: 4000 },
    { id: "compute", name: "计算速度", pts: compPts, max: 2000 },
    { id: "file_processing", name: "文件处理", pts: fpPts, max: 2000 },
    { id: "efficiency", name: "资源效率", pts: tokenPts + ttftPts, max: 2000 },
  ];

  return {
    modules,
    breakdown,
    total: breakdown.reduce((s, b) => s + b.pts, 0),
    extra: {
      avgTtft,
      totalTokens,
      totalReasoning: modules.reduce((s, m) => s + m.reasoning, 0),
      totalTime: modules.reduce((s, m) => s + m.time, 0),
      failures: modules.reduce((s, m) => s + m.failures, 0),
      taskCount: new Set(results.map((r) => r.task.id)).size,
      runCount: results.length,
    },
  };
}

export function verdict(total) {
  if (total >= 9000) return "旗舰级";
  if (total >= 7500) return "高性能";
  if (total >= 6000) return "主流水准";
  if (total >= 4500) return "入门级";
  return "需优化";
}

/** 生成 Markdown 报告 */
export function buildReport({ model, baseUrl, repeat, summary }) {
  const { modules, breakdown, total, extra } = summary;
  const L = [];
  L.push(`# DSH 性能基准报告`);
  L.push("");
  L.push(`- 被测模型：\`${model}\``);
  L.push(`- 端点：\`${baseUrl}\``);
  L.push(`- 重复次数：${repeat}　任务数：${extra.taskCount}　请求数：${extra.runCount}`);
  L.push("");
  L.push(`## 综合得分：**${total.toFixed(0)}** / 10000（${verdict(total)}）`);
  L.push("");
  L.push("| 模块 | 得分 | 满分 |");
  L.push("|---|---|---|");
  for (const b of breakdown) L.push(`| ${b.name} | ${b.pts.toFixed(0)} | ${b.max} |`);
  L.push("");
  L.push("## 关键指标");
  L.push("");
  L.push(`- 任务总用时：${extra.totalTime.toFixed(1)}s`);
  L.push(`- 平均首字延迟：${extra.avgTtft.toFixed(2)}s`);
  L.push(`- 输出 token 合计：${extra.totalTokens.toLocaleString()}` +
    (extra.totalReasoning ? `（含思考 ${extra.totalReasoning.toLocaleString()}）` : ""));
  L.push(`- 失败请求数：${extra.failures}`);
  L.push("");

  for (const m of modules) {
    L.push(`## ${m.name}（${m.score}/${m.full}，${m.time.toFixed(1)}s）`);
    L.push("");
    L.push("| 任务 | 得分 | 耗时(s) | 备注 |");
    L.push("|---|---|---|---|");
    for (const t of m.tasks) {
      let note = t.notes.length ? t.notes.join("；") : "—";
      if (note.length > 50) note = note.slice(0, 47) + "...";
      L.push(`| ${t.id} | ${t.score}/${t.full} | ${t.time.toFixed(1)} | ${note} |`);
    }
    L.push("");
  }

  const human = modules.flatMap((m) => m.tasks.filter((t) => t.human).map((t) => t.id));
  if (human.length) {
    L.push("## 需人工复核");
    L.push("");
    L.push(`以下任务含语义判断，自动分仅供参考：${human.join("、")}`);
    L.push("");
  }

  L.push("---");
  L.push("自动分仅作初筛；横向对比请确保同批次、同网络环境运行。");
  return L.join("\n");
}

/** 一键跑分入口 */
export async function runBenchmark(opts = {}) {
  const baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
  const model = opts.model || DEFAULT_MODEL;
  const apiKey = opts.apiKey || process.env.DEEPSEEK_API_KEY || "";
  const repeat = Math.max(1, Number(opts.repeat) || 1);
  const concurrency = Math.max(1, Number(opts.concurrency) || 4);
  const only = Array.isArray(opts.only) ? opts.only : [];

  if (!apiKey) {
    throw new Error("缺少 API Key：请在插件配置中填写 apiKey，或设置环境变量 DEEPSEEK_API_KEY");
  }

  const results = await runAll({ baseUrl, model, apiKey, repeat, concurrency, only });
  const summary = scoreModules(results);
  const report = buildReport({ model, baseUrl, repeat, summary });

  return {
    report,
    summary: {
      total: Math.round(summary.total),
      verdict: verdict(summary.total),
      breakdown: summary.breakdown,
      extra: summary.extra,
    },
    results,
  };
}
