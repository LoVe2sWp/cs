// 离线冒烟测试：mock 掉 fetch，验证「任务→判分→评分→报告」全链路
// 运行：node test/smoke.mjs

import { runBenchmark, scoreModules, verdict } from "../src/bench.js";

const ANSWERS = [
  ["恰好 30", "「客户资料归口数据中台并按权限分级对外报表须脱敏复核后方可发出」"],
  ["只输出 JSON", '{"owner":"李工","deadline":"本周五","deliverable":"接口联调"}'],
  ["总产出", "B=12*0.75=9，C=9+5=14，日合计12+9+14=35，两周35*5*2=350 件。"],
  ["只有一人说真话", "乙说真话。假设甲真，则乙假、丙真，出现两个真话者，矛盾；假设乙真，则甲假、丙假，成立。"],
  ["三个渠道", "合计33.6万元。问题：线上渠道重复记录、单位不统一（万元与元）、代理数据缺失。"],
  ["任务清单表格", "| 任务 | 负责人 | 验收标准 |\n|---|---|---|\n| 登录页改版 | 待定 | 通过评审 |\n| 验证码改滑块 | 待定 | 可用 |\n| 老用户回归 | 待定 | 无报错 |"],
  ["17 × 23", "391"],
  ["345 ÷ 15", "23"],
  ["12.5%", "1100"],
  ["(87 + 43)", "780"],
  ["2 的 10 次方", "1024"],
  ["7.5 小时", "450"],
  ["3/4 + 5/8", "1.375"],
  ["95 × 0.85", "80.75"],
  ["订单数据", "总计6121.9元 最大1200元 客户5个"],
  ["摘要", "公司发布智能办公助手，支持多文档协同与合同比对，内置发票识别，明年一季度上线离线模式。"],
];

function pick(prompt) {
  for (const [k, v] of ANSWERS) if (prompt.includes(k)) return v;
  throw new Error("未匹配到题目: " + prompt.slice(0, 30));
}

globalThis.fetch = async (_url, opts) => {
  const body = JSON.parse(opts.body);
  const ans = pick(body.messages[0].content);
  const sse = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: ans.slice(0, 8) } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: ans.slice(8) } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, completion_tokens_details: { reasoning_tokens: 0 } } })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");
  return new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } });
};

const { report, summary, results } = await runBenchmark({ apiKey: "test-key", repeat: 1, concurrency: 4 });

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error("失败任务:", failed.map((r) => `${r.task.id}: ${r.error}`).join("\n"));
  process.exit(1);
}
if (results.length !== 16) {
  console.error(`应有 16 条记录，实际 ${results.length}`);
  process.exit(1);
}
if (summary.total < 9900) {
  console.error(`标准答案应得 9900+，实际 ${summary.total}`);
  console.error(report);
  process.exit(1);
}
if (!report.includes("10000") || !report.includes("需人工复核")) {
  console.error("报告内容异常");
  process.exit(1);
}

console.log("=".repeat(50));
console.log("冒烟测试通过");
console.log(`  任务数        ${summary.extra.taskCount}`);
console.log(`  请求数        ${summary.extra.runCount}`);
console.log(`  综合得分      ${summary.total} / 10000  [${summary.verdict}]`);
for (const b of summary.breakdown) {
  console.log(`  ${b.name.padEnd(8, "　")}${String(b.pts.toFixed(0)).padStart(8)} / ${b.max}`);
}
console.log(`  报告长度      ${report.length} 字符`);
console.log("=".repeat(50));

// 负面用例：第 5 题把重复行算两遍
import { grade } from "../src/graders.js";
const bad5 = grade({ id: "A5", grader: "g5", full: 15 }, "合计37.5万元。");
const bad6 = grade({ id: "A6", grader: "g6", full: 15 }, "负责人：张三");
if (bad5.score !== 0) { console.error("负面用例失败：A5 错误合计应得 0 分"); process.exit(1); }
if (!bad6.notes.some((n) => n.includes("编造"))) { console.error("负面用例失败：A6 未识别编造"); process.exit(1); }
console.log("负面用例通过：A5 错误合计 0 分，A6 识别编造");
