// DSH Benchmark 判分器（JavaScript 版）
// 签名: grader(answer, task) -> { score, notes: string[], human: boolean }

const HAN = /[\u4e00-\u9fff]/g;

const nums = (s) => (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

function quoted(text) {
  const cands = [];
  for (const re of [/「([\s\S]+?)」/, /“([\s\S]+?)”/, /『([\s\S]+?)』/]) {
    const m = text.match(re);
    if (m) cands.push(m[1]);
  }
  return cands.length ? cands.sort((a, b) => b.length - a.length)[0] : text.trim();
}

function g1(answer) {
  const cand = quoted(answer);
  const n = (cand.match(HAN) || []).length;
  const hasDe = cand.includes("的");
  let score = 0;
  if (n === 30 && !hasDe) score = 15;
  else if (n === 30 || !hasDe) score = 7;
  const notes = [`汉字数 ${n}（要求 30）`];
  if (hasDe) notes.push("出现「的」字");
  return { score, notes, human: true };
}

function g2(answer) {
  const text = answer.trim();
  let obj = null;
  let pure = true;
  try {
    obj = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { obj = JSON.parse(m[0]); } catch { obj = null; }
      pure = false;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { score: 0, notes: ["无法解析为 JSON 对象"], human: true };
  }
  let score = pure ? 10 : 5;
  const notes = pure ? [] : ["非纯 JSON，夹带多余文字"];
  const missing = ["owner", "deadline", "deliverable"].filter((k) => !(k in obj));
  score -= 3 * missing.length;
  if (missing.length) notes.push("缺字段：" + missing.join("、"));

  const blob = JSON.stringify(obj);
  if (/李工|王敏/.test(blob)) score += 4;
  else notes.push("owner 未体现纪要中的人名");
  if (/周五|待定|下周/.test(blob)) score += 3;
  else notes.push("deadline 与纪要不符");
  if (/联调|扫描|测试报告/.test(blob)) score += 3;
  else notes.push("deliverable 与纪要不符");

  return { score: Math.max(0, Math.min(20, score)), notes, human: true };
}

function g3(answer) {
  let score = 0;
  const notes = [];
  if (answer.includes("350")) score += 10;
  else notes.push("结果不是 350");
  const distinct = new Set(answer.match(/\d+(?:\.\d+)?/g) || []);
  if (distinct.size >= 3) score += 5;
  else notes.push("缺少计算过程");
  return { score: Math.min(15, score), notes, human: false };
}

function g4(answer) {
  let score = 0;
  const notes = [];
  if (answer.includes("乙") && /乙[^。]{0,12}(说|是)?真/.test(answer)) score += 12;
  else if (answer.includes("乙")) { score += 6; notes.push("指向乙但结论表述不清"); }
  else notes.push("结论未指向乙");
  if (answer.length >= 40 || /假设|矛盾|排除|反证|若/.test(answer)) score += 8;
  else notes.push("推理步骤过短或缺失");
  return { score: Math.min(20, score), notes, human: true };
}

function g5(answer) {
  let score = 0;
  const notes = [];
  if (/33\.6|336000|336,000|33万6/.test(answer)) score += 8;
  else notes.push("合计不是 33.6 万元（可能把重复行算了两遍）");

  const hits = [];
  if (answer.includes("重复")) hits.push("重复行");
  if (answer.includes("单位")) hits.push("单位不统一");
  if (/缺失|为空|没有数据|未填|空白|—/.test(answer)) hits.push("数据缺失");
  score += Math.min(7, hits.length * 3);
  if (!hits.length) notes.push("未指出任何数据问题");

  return { score: Math.min(15, score), notes: [...notes, `识别到：${hits.join("、") || "无"}`], human: true };
}

function g6(answer) {
  let score = 0;
  const notes = [];
  if (answer.includes("|") || answer.includes("｜")) score += 6;
  else notes.push("未使用表格");

  let covered = 0;
  if (/登录页|页面|界面|UI|样式|美化|视觉/.test(answer)) covered++;
  if (/滑块|验证码/.test(answer)) covered++;
  if (/回归|老用户|测试/.test(answer)) covered++;
  score += covered * 3;
  if (covered < 3) notes.push(`仅覆盖 ${covered}/3 项任务`);

  if (/(张|李|王|赵|刘|陈|杨|黄)[工三伟芳娜敏静]?/.test(answer) && !answer.includes("待定")) {
    notes.push("疑似编造具体负责人");
  }
  if (!answer.includes("待定")) notes.push("未按要求使用「待定」");

  return { score: Math.min(15, score), notes, human: true };
}

function numeric(answer, task) {
  const expected = Number(task.answer);
  const ok = nums(answer).some((n) => Math.abs(n - expected) < 1e-6);
  return { score: ok ? 1 : 0, notes: ok ? [] : [`应为 ${expected}`], human: false };
}

function orders(answer, task) {
  const exp = task.expected;
  const ns = nums(answer);
  let score = 0;
  const notes = [];
  for (const [key, label] of [["total", "总金额"], ["max", "最大单笔"], ["customers", "客户数"]]) {
    if (ns.some((n) => Math.abs(n - exp[key]) < 0.01)) score++;
    else notes.push(`${label}应为 ${exp[key]}`);
  }
  return { score, notes, human: false };
}

function summary(answer) {
  const n = (answer.match(HAN) || []).length;
  if (n <= 50) return { score: 2, notes: [], human: true };
  return { score: 1, notes: [`摘要 ${n} 字，超过 50 字上限`], human: true };
}

const GRADERS = { g1, g2, g3, g4, g5, g6, numeric, orders, summary };

export function grade(task, answer) {
  const fn = GRADERS[task.grader];
  if (!fn) throw new Error(`未知判分器: ${task.grader}`);
  return fn(answer, task);
}
