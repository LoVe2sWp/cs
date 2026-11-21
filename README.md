# dsh-benchmark-plugin

DSH 性能基准测试插件（npm 包）。装进 DSH 软件后，一句话就能跑分。

## 装什么、怎么装

DSH 的「安装第三方插件」支持三种来源，任选其一：

### 方式一：本地目录（最简单）

1. 解压 `dsh-benchmark-plugin.zip`
2. 在 DSH 的「安装第三方插件」里选 **本地目录**
3. 指向解压出来的 `dsh-benchmark-plugin/` 文件夹
4. 重启或刷新插件列表

### 方式二：npm 包文件

```bash
npm install ./dsh-benchmark-plugin-1.0.0.tgz
```

### 方式三：发布到私有源后按包名安装

```bash
npm publish   # 发布到你们的内网 registry
# 然后在 DSH 里填包名 dsh-benchmark-plugin
```

## 装完怎么用

直接对它说：

> 用 deepseek-chat 跑一下性能基准，重复 3 次

它会调用 `dsh_benchmark` 工具，返回一份报告：

```
综合得分：8,640 / 10000（高性能）

| 模块 | 得分 | 满分 |
|---|---|---|
| 准确性 | 3600 | 4000 |
| 计算速度 | 1850 | 2000 |
| 文件处理 | 1700 | 2000 |
| 资源效率 | 1490 | 2000 |

任务总用时：42.3s
平均首字延迟：0.86s
输出 token 合计：1,842
```

## 工具参数

| 参数 | 说明 |
|---|---|
| `model` | 被测模型，默认 `deepseek-chat` |
| `baseUrl` | OpenAI 兼容端点，默认 DeepSeek 官方 |
| `apiKey` | 被测模型 Key，留空读 `DEEPSEEK_API_KEY` |
| `repeat` | 每题重复次数，默认 1，建议 3 |
| `concurrency` | 并发数，默认 4 |
| `only` | 只跑指定题，如 `["A5","B1"]` |

## 测什么（16 题 / 4 模块）

**准确性（4000 分）**——6 题：指令遵循、信息提取、多步计算、逻辑推理、抗干扰、结构化输出。其中第 5 题埋了重复行 + 单位混用 + 缺失值三个坑，是最能区分水平的一题。

**计算速度（2000 分）**——8 道标准算术题，看正确率和吞吐。

**文件处理（2000 分）**——12 笔订单的 JSON 提取汇总 + 250 字长文摘要。

**资源效率（2000 分）**——token 用量 + 首字延迟。

## 等级

| 分数 | 等级 |
|---|---|
| ≥9000 | 旗舰级 |
| ≥7500 | 高性能 |
| ≥6000 | 主流水准 |
| ≥4500 | 入门级 |
| <4500 | 需优化 |

## 自测

```bash
node test/smoke.mjs
# 预期：16 题，综合得分 10000/10000
```

## 注意

1. **自动分仅作初筛**——A1/A2/A4/A5/A6/C2 含语义判断，报告里单列了「需人工复核」。
2. **横向对比要同批次跑**——不同时段网络差异能让耗时差一倍。
3. **API Key 只从配置或环境变量读**，不写日志。
4. 需要 Node 22+（DSH 自带运行时满足）。

## 目录

```
dsh-benchmark-plugin/
├── package.json            npm 包元数据 + openclaw.extensions
├── openclaw.plugin.json    插件清单（工具声明 + 配置 schema）
├── index.js                入口，注册 dsh_benchmark 工具
├── src/
│   ├── tasks.js            16 道标准任务
│   ├── graders.js          判分器
│   └── bench.js            执行引擎 + 评分 + 报告
├── test/smoke.mjs          离线自测
└── README.md
```
