// DSH 标准任务集：3 个模块，16 个任务
// 改题请同时改 src/graders.js 里对应的判分器

export const MODULES = [
  {
    id: "accuracy",
    name: "准确性",
    baseline: null,
    tasks: [
      {
        id: "A1", grader: "g1", full: 15, human: true,
        prompt: "请阅读下面这段话，并用恰好 30 个汉字概括其核心内容，不得出现「的」字，不得使用标点以外的符号。\n\n本季度公司把原本分散在三个部门的客户资料统一归口到数据中台管理，同时上线了权限分级机制，要求所有对外提供的报表必须先经过脱敏处理，再由业务负责人复核签字后才能发出，违规操作将被记录并纳入考核。"
      },
      {
        id: "A2", grader: "g2", full: 20, human: true,
        prompt: "从下面这段会议纪要中提取信息，只输出 JSON，字段为 owner、deadline、deliverable，缺失的字段填 null。\n\n周三例会上确认：接口联调由李工负责，本周五之前完成；测试报告暂时没人认领，下周再定；上线前的安全扫描由王敏跟进，时间待定。"
      },
      {
        id: "A3", grader: "g3", full: 15, human: false,
        prompt: "某小组 3 人：A 每天产出 12 件；B 的日产出是 A 的 0.75 倍；C 每天比 B 多产出 5 件。每周按 5 个工作日计算。\n\n请计算：两周（10 个工作日）该小组的总产出是多少件？需写出计算过程。"
      },
      {
        id: "A4", grader: "g4", full: 20, human: true,
        prompt: "三人中只有一人说真话：\n甲说：「乙在说谎。」\n乙说：「丙在说谎。」\n丙说：「甲和乙都在说谎。」\n\n请判断谁说真话，并说明推理步骤。"
      },
      {
        id: "A5", grader: "g5", full: 15, human: true,
        prompt: "下表是三个渠道的销售额，请计算合计，并指出表中存在的数据问题（至少两点）。\n\n渠道 | 销售额\n线上 | 12.5 万元\n线下 | 86000 元\n线上 | 12.5 万元\n代理 | —"
      },
      {
        id: "A6", grader: "g6", full: 15, human: true,
        prompt: "把下面这句口语化需求，改写成一个任务清单表格，列为：任务、负责人、验收标准。信息不足的负责人填「待定」。\n\n那个登录页太丑了，顺便把验证码换成滑块，另外记得让测试那边回归一下老用户能不能正常登录。"
      }
    ]
  },
  {
    id: "compute",
    name: "计算速度",
    baseline: 30,
    tasks: [
      { id: "B1", grader: "numeric", full: 1, answer: "391", prompt: "只输出最终答案，不要解释、不要单位。计算：17 × 23 = ?" },
      { id: "B2", grader: "numeric", full: 1, answer: "23", prompt: "只输出最终答案，不要解释、不要单位。计算：345 ÷ 15 = ?" },
      { id: "B3", grader: "numeric", full: 1, answer: "1100", prompt: "只输出最终答案，不要解释、不要单位。计算：8800 的 12.5% 是多少？" },
      { id: "B4", grader: "numeric", full: 1, answer: "780", prompt: "只输出最终答案，不要解释、不要单位。计算：(87 + 43) × 6 = ?" },
      { id: "B5", grader: "numeric", full: 1, answer: "1024", prompt: "只输出最终答案，不要解释、不要单位。计算：2 的 10 次方 = ?" },
      { id: "B6", grader: "numeric", full: 1, answer: "450", prompt: "只输出最终答案，不要解释、不要单位。换算：7.5 小时等于多少分钟？" },
      { id: "B7", grader: "numeric", full: 1, answer: "1.375", prompt: "只输出最终答案，不要解释、不要单位。计算：3/4 + 5/8 = ?（小数表示）" },
      { id: "B8", grader: "numeric", full: 1, answer: "80.75", prompt: "只输出最终答案，不要解释、不要单位。计算：95 × 0.85 = ?" }
    ]
  },
  {
    id: "file_processing",
    name: "文件处理",
    baseline: 40,
    tasks: [
      {
        id: "C1", grader: "orders", full: 3, human: false,
        expected: { total: 6121.9, max: 1200, customers: 5 },
        prompt: "以下是订单数据（JSON 数组）：\n\n[{\"id\":1,\"customer\":\"甲\",\"amount\":230.5},{\"id\":2,\"customer\":\"乙\",\"amount\":890.0},{\"id\":3,\"customer\":\"甲\",\"amount\":156.25},{\"id\":4,\"customer\":\"丙\",\"amount\":1200.0},{\"id\":5,\"customer\":\"乙\",\"amount\":45.8},{\"id\":6,\"customer\":\"丁\",\"amount\":678.4},{\"id\":7,\"customer\":\"甲\",\"amount\":99.9},{\"id\":8,\"customer\":\"丙\",\"amount\":322.0},{\"id\":9,\"customer\":\"乙\",\"amount\":1105.6},{\"id\":10,\"customer\":\"丁\",\"amount\":87.3},{\"id\":11,\"customer\":\"戊\",\"amount\":540.0},{\"id\":12,\"customer\":\"甲\",\"amount\":766.15}]\n\n请计算：总金额、最大单笔金额、不同客户数。只输出一行，格式：总计X元 最大Y元 客户Z个"
      },
      {
        id: "C2", grader: "summary", full: 2, human: true,
        prompt: "阅读下面这段文字，用不超过 50 个汉字写一句话摘要，只输出摘要本身。\n\n公司今天发布了新一代智能办公助手，主打多文档协同处理能力。该产品支持同时打开上百个文件进行跨文档检索，能在三秒内完成对整份合同的条款比对，并自动标出与往期版本的差异。针对财务场景，它内置了发票识别与报销单自动填写功能，识别准确率官方宣称达到百分之九十八。价格方面，个人版每月三十九元，团队版按席位收费，每个席位每月二十九元，企业版需要单独询价。产品目前提供三十天免费试用，不需要绑定信用卡。官方同时公布了路线图，明年一季度将上线离线模式，支持在完全断网的环境下运行核心功能，这对金融和政务客户尤为重要。"
      }
    ]
  }
];

export const ALL_TASKS = MODULES.flatMap((m) => m.tasks.map((t) => ({ ...t, module: m.id })));
