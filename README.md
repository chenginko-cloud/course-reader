# 课程逐字稿库 course-reader

🔗 **在线地址：https://chenginko-cloud.github.io/course-reader/**

仓库：https://github.com/chenginko-cloud/course-reader （GitHub Pages，main / root）

两门课的逐字稿浏览应用，左侧（手机端为顶部按钮）按 **课程 → 课时** 两级筛选，点任意一节进入阅读。
单文件、零外部依赖，`index.html` 可直接双击离线打开，也可直接放 GitHub Pages。

## 内容

| 一级目录（课程） | 来源 | 课时数 | 说明 |
|---|---|---|---|
| 《如何唤醒孩子的自驱力》 | `家卫老师-如何唤醒孩子的自驱力.docx` | 26 | 前言 + 压力系统 / 动力系统 / 惯性系统 / 唤醒系统 + 总结 |
| 《自学方法》 | `01_*.txt` ~ `23_*.txt` | 23 | 语音转写逐字稿，已做断句与分段 |

合计 49 节、约 15.3 万字。

## 文件

- `index.html` — **交付物**，数据已内联，可直接打开/托管
- `template.html` — 页面模板（`__DATA__` 为数据占位符）
- `data.json` — 结构化课程数据
- `build_data.py` — 从 `/Users/Zhuanz/Downloads/案例课程/` 抽取 docx 与 txt
- `build_html.py` — 把 data.json 内联进模板，产出 index.html
- `test_smoke.js` — jsdom 冒烟测试（26 项断言）
- `mobile.html` / `desktop.html` — 兼容旧链接习惯的跳转壳

## 重新生成

```bash
cd /Users/Zhuanz/WorkBuddy/2026-09-27-10-11-06/course-reader
/Users/Zhuanz/.workbuddy/binaries/python/versions/3.13.12/bin/python3 build_data.py
/Users/Zhuanz/.workbuddy/binaries/python/versions/3.13.12/bin/python3 build_html.py
NODE_PATH=/Users/Zhuanz/.workbuddy/binaries/node/workspace/node_modules \
  /Users/Zhuanz/.workbuddy/binaries/node/versions/22.22.2-2/bin/node test_smoke.js
```

## 转写稿断句规则（build_data.py）

原始 txt 无任何标点，仅以空格分隔语段。规则：

1. 语段开头的强连接词（那么 / 所以 / 但是 / 首先 / 第一个 …）→ 上一句收句
2. 语段开头的弱连接词（就是 / 反而 / 并且 / 而且 / 也 …）→ 仍属上一句
3. 单句累计 ≥ 34 字且下一语段非弱连接词 → 收句
4. 段落累计 ≥ 190 字自动分段；半角标点统一转全角

## 功能

- 两级筛选（课程名 → 课时标题），支持多选、清空、全选
- 全文搜索：命中标题或正文，列表内显示命中片段
- 阅读层：上一节 / 下一节（按当前筛选顺序）、目录浮层、字号 14–26px、宋体/黑体切换、夜间模式、一键复制全文
- 进度记忆：每节课阅读百分比 + 未读完标记，存 localStorage
- URL 锚点 `#c1-2` 可直达某一节

## 滑动手势（移动端，<900px 生效）

| 手势 | 行为 |
|---|---|
| 文稿列表 **右滑** | 打开目录抽屉（跟手位移，松手超过 58px 才打开，否则回弹） |
| 目录 **左滑** | 返回列表（跟手位移；**有未应用的筛选勾选时先弹确认**，选「继续编辑」则留在目录且改动保留） |
| 阅读页 **从屏幕左边缘右滑** | 返回列表（跟手位移，超过 110px 才触发，带滑出动画；中部右滑不响应，避免和正文选区冲突） |

- 纵向滑动优先：方向判定为纵向时手势直接取消，不干扰列表滚动
- 位移未过阈值时回弹，不误触发
- 确认弹层打开、目录浮层打开时不响应滑动手势
- 桌面端（≥900px）侧栏常驻，滑动手势自动关闭
- 未保存确认在代码里是通用钩子：`closeReader()` 走 `hasUnsavedWork()`，将来加二创编辑页时让它返回 `true` 即可自动生效

> iOS Safari 里页面自带的左边缘返回手势会和应用内手势竞争；把页面「添加到主屏幕」后以独立窗口打开就只剩应用内手势。
