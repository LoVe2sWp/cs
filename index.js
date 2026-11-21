// DSH 性能基准插件入口
// 注册工具 dsh_benchmark：一键跑分，输出鲁大师式报告

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { runBenchmark, DEFAULT_BASE_URL, DEFAULT_MODEL } from "./src/bench.js";

export default definePluginEntry({
  id: "dsh-benchmark",
  name: "DSH 性能基准",
  description: "鲁大师式 AI 工具性能测试：准确性 / 计算速度 / 文件处理 / 资源效率，满分 10000",

  register(api) {
    api.registerTool({
      name: "dsh_benchmark",
      description:
        "对当前或指定的 AI 模型跑标准性能基准测试，返回综合得分（满分 10000）与逐题明细。" +
        "覆盖准确性、计算速度、文件处理、token 用量、首字延迟、任务总用时。" +
        "适用于对比不同模型/不同 DSH 软件的性能效率。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          model: {
            type: "string",
            description: `被测模型名，默认 ${DEFAULT_MODEL}`,
          },
          baseUrl: {
            type: "string",
            description: `OpenAI 兼容的 chat/completions 端点，默认 ${DEFAULT_BASE_URL}`,
          },
          apiKey: {
            type: "string",
            description: "被测模型的 API Key；留空则读取环境变量 DEEPSEEK_API_KEY",
          },
          repeat: {
            type: "number",
            description: "每题重复次数，默认 1；建议 3 以获得稳定结果",
          },
          concurrency: {
            type: "number",
            description: "并发请求数，默认 4；过高会触发限流",
          },
          only: {
            type: "array",
            items: { type: "string" },
            description: "只跑指定任务，如 [\"A5\",\"B1\"]；留空跑全部 16 题",
          },
        },
      },

      async execute(_id, params) {
        const { report, summary } = await runBenchmark({
          model: params.model,
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          repeat: params.repeat,
          concurrency: params.concurrency,
          only: params.only,
        });

        return {
          content: [{ type: "text", text: report }],
          details: {
            total: summary.total,
            verdict: summary.verdict,
            breakdown: summary.breakdown,
            extra: summary.extra,
          },
        };
      },
    });
  },
});
