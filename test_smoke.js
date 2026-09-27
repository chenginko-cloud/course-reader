const fs = require("fs");
const { JSDOM, VirtualConsole } = require("jsdom");

const file = "/Users/Zhuanz/WorkBuddy/2026-09-27-10-11-06/course-reader/index.html";
const html = fs.readFileSync(file, "utf8");
const errors = [];

const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push("jsdomError: " + e.message));
vc.on("error", m => errors.push("console.error: " + m));

const dom = new JSDOM(html, {
  url: "http://localhost/index.html",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  /* 手势只在窄屏（<900px）生效，jsdom 默认 1024 宽，这里模拟手机 */
  beforeParse(w) {
    Object.defineProperty(w, "innerWidth", { value: 390, configurable: true });
    Object.defineProperty(w, "innerHeight", { value: 844, configurable: true });
  }
});
const { window } = dom;
const doc = window.document;
const $ = id => doc.getElementById(id);
let failed = 0;
function ok(name, cond, extra) {
  console.log((cond ? "PASS  " : "FAIL  ") + name + (extra ? "   " + extra : ""));
  if (!cond) { failed++; process.exitCode = 1; }
}
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* jsdom 没有 PointerEvent，手工造一个带指针字段的事件 */
function pev(type, opts) {
  const e = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { pointerId: 1, pointerType: "touch", clientX: 0, clientY: 0, isPrimary: true }, opts || {});
  return e;
}
function swipeDown(target, x, y) { target.dispatchEvent(pev("pointerdown", { clientX: x, clientY: y })); }
function swipeMove(x, y) { doc.dispatchEvent(pev("pointermove", { clientX: x, clientY: y })); }
function swipeUp(x, y) { doc.dispatchEvent(pev("pointerup", { clientX: x, clientY: y })); }
function swipe(target, x0, y0, dx, dy, steps) {
  steps = steps || 6;
  swipeDown(target, x0, y0);
  for (let i = 1; i <= steps; i++) swipeMove(x0 + dx * i / steps, y0 + dy * i / steps);
  swipeUp(x0 + dx, y0 + dy);
}
const drawn = () => doc.body.classList.contains("drawn");
const reading = () => $("reader").classList.contains("open");
const confirmOpen = () => $("confirm").classList.contains("open");

(async () => {
  await sleep(350);

  /* ---------- 基础渲染 ---------- */
  ok("列表渲染 49 节课", doc.querySelectorAll("#list .lesson").length === 49);
  ok("侧栏 2 个一级目录", doc.querySelectorAll("#sBody .cRow").length === 2);
  ok("侧栏 49 个二级目录", doc.querySelectorAll("#sBody .lRow").length === 49);

  /* ---------- 1. 列表右滑打开目录 ---------- */
  ok("初始抽屉关闭", !drawn());
  swipe($("list"), 200, 400, 160, 6);
  ok("列表右滑 → 目录打开", drawn());
  ok("顶栏计数仍在", $("menuN").textContent === "49");
  ok("右滑后位移已复位", $("side").style.transform === "", JSON.stringify($("side").style.transform));

  /* ---------- 2. 目录左滑返回列表（无待选改动，直接关） ---------- */
  swipe($("sBody"), 300, 400, -160, 5);
  await sleep(30);
  ok("目录左滑 → 返回列表", !drawn());
  ok("无待选改动时不弹确认", !confirmOpen());

  /* ---------- 3. 有未应用筛选改动 → 左滑先提示确认 ---------- */
  click($("menuBtn"));
  ok("菜单按钮可打开目录", drawn());
  click(doc.querySelectorAll("#sBody .cRow")[1]);           // 取消勾选《自学方法》
  ok("待选计数变 26", $("applyN").textContent === "26", $("applyN").textContent);
  swipe($("sBody"), 300, 400, -160, 5);
  await sleep(30);
  ok("有未保存改动 → 弹出确认", confirmOpen());
  ok("确认弹层出现时目录仍打开", drawn());
  click($("cCancel"));
  await sleep(30);
  ok("选「继续编辑」→ 目录保持打开", drawn());
  ok("待选改动被保留", $("applyN").textContent === "26");
  swipe($("sBody"), 300, 400, -160, 5);
  await sleep(30);
  click($("cOk"));
  await sleep(30);
  ok("选「放弃并返回」→ 目录关闭", !drawn());
  ok("被放弃的改动未生效（列表仍 49 节）", doc.querySelectorAll("#list .lesson").length === 49);

  /* ---------- 4. 位移不够时回弹 ---------- */
  click($("menuBtn"));
  swipe($("sBody"), 300, 500, -30, 0);
  await sleep(30);
  ok("左滑位移不够 → 回弹不关", drawn());
  if (confirmOpen()) click($("cOk"));
  click($("applyD"));        // 恢复正常筛选并关闭
  await sleep(340);
  ok("「查看」按钮正常关闭目录", !drawn());

  /* ---------- 5. 阅读页左边缘右滑返回 ---------- */
  click(doc.querySelectorAll("#list .lesson")[0]);
  ok("阅读层已打开", reading());
  ok("阅读层带 transform 过渡", /transform/.test(window.getComputedStyle($("reader")).transition || ""),
    window.getComputedStyle($("reader")).transition);
  swipe($("reader"), 8, 400, 40, 4);
  await sleep(30);
  ok("右滑不足 110px → 阅读层不关", reading());
  ok("未过阈值时位移已复位", $("reader").style.transform === "", JSON.stringify($("reader").style.transform));
  swipe($("reader"), 6, 400, 150, 5);
  ok("拖动过程中跟手位移生效", /translateX\(/.test($("reader").style.transform), $("reader").style.transform);
  await sleep(280);
  ok("左边缘右滑 → 返回列表", !reading());
  ok("无未保存内容时不弹确认", !confirmOpen());
  ok("URL 锚点已清空", window.location.hash === "", window.location.hash);

  /* ---------- 6. 阅读页中部右滑不触发返回 ---------- */
  click(doc.querySelectorAll("#list .lesson")[3]);
  ok("重新打开阅读层", reading());
  swipe($("rBody"), 300, 400, 160, 5);
  await sleep(60);
  ok("中部右滑不返回（避免与正文选区冲突）", reading());
  click($("rClose"));
  ok("返回按钮仍可用", !reading());

  /* ---------- 7. 纵向滑动不误触发 ---------- */
  swipe($("list"), 200, 400, 12, 90);
  ok("纵向滑动不开目录", !drawn());

  /* ---------- 8. 旧功能未回归 ---------- */
  click(doc.querySelectorAll("#list .lesson")[1]);
  ok("开课正常", reading() && window.location.hash === "#c1-2");
  click($("rNext"));
  ok("下一节正常", window.location.hash === "#c1-3");
  click($("rToc"));
  ok("目录浮层正常", $("toc").classList.contains("open"));
  click($("tocClose"));
  click($("rFontUp"));
  ok("字号正常", doc.documentElement.style.getPropertyValue("--fs") === "18.5px");
  click($("rNight"));
  ok("夜间模式正常", doc.body.classList.contains("night"));
  click($("rNight"));
  click($("rClose"));
  ok("关闭后回到列表", !reading());

  const real = errors.filter(e => !/Could not parse CSS|Not implemented/.test(e));
  ok("无 JS 运行时错误", real.length === 0, real.slice(0, 3).join(" | "));

  console.log("\n" + (failed ? "✗ " + failed + " 项失败" : "✓ 全部通过"));
})();
