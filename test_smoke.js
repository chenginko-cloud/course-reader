const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const file = "/Users/Zhuanz/WorkBuddy/2026-09-27-10-11-06/course-reader/index.html";
const html = fs.readFileSync(file, "utf8");
const errors = [];

const dom = new JSDOM(html, {
  url: "http://localhost/index.html",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: new (require("jsdom").VirtualConsole)().on("jsdomError", e => errors.push("jsdomError: " + e.message))
});
const { window } = dom;
const doc = window.document;
const $ = id => doc.getElementById(id);

function assert(name, cond, extra) {
  console.log((cond ? "PASS  " : "FAIL  ") + name + (extra ? "   " + extra : ""));
  if (!cond) process.exitCode = 1;
}

setTimeout(() => {
  const listBtns = doc.querySelectorAll("#list .lesson");
  assert("列表渲染 49 节课", listBtns.length === 49, "实际 " + listBtns.length);

  const courseRows = doc.querySelectorAll("#sBody .cRow");
  const lessonRows = doc.querySelectorAll("#sBody .lRow");
  assert("侧栏 2 个一级目录（课程）", courseRows.length === 2, "实际 " + courseRows.length);
  assert("侧栏 49 个二级目录（课时）", lessonRows.length === 49, "实际 " + lessonRows.length);
  assert("课程名正确", courseRows[0].textContent.includes("如何唤醒孩子的自驱力")
    && courseRows[1].textContent.includes("自学方法"));
  assert("一级目录计数 26/26 与 23/23",
    courseRows[0].textContent.includes("26/26") && courseRows[1].textContent.includes("23/23"),
    courseRows[0].textContent.trim() + " | " + courseRows[1].textContent.trim());
  assert("查看按钮计数 49", $("applyN").textContent === "49", $("applyN").textContent);

  // 打开第一节课
  listBtns[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("阅读层已打开", $("reader").classList.contains("open"));
  assert("正文渲染出段落", doc.querySelectorAll("#rBody .art .txt p").length > 3,
    doc.querySelectorAll("#rBody .art .txt p").length + " 段");
  assert("阅读层标题存在", doc.querySelector("#rBody h1").textContent.length > 0,
    doc.querySelector("#rBody h1").textContent);
  assert("URL 带上课时 hash", window.location.hash === "#c1-1", window.location.hash);
  assert("底部位置指示", /筛选内 1 \/ 49/.test($("rPos").textContent), $("rPos").textContent);

  // 下一节
  $("rNext").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("下一节跳转成功", window.location.hash === "#c1-2", window.location.hash);
  $("fPrev").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("上一节跳转成功", window.location.hash === "#c1-1", window.location.hash);

  // 目录浮层
  $("rToc").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("目录浮层打开", $("toc").classList.contains("open"));
  assert("目录列出 49 节", doc.querySelectorAll("#tocBody .tocRow").length === 49);
  $("tocClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

  // 字号 / 夜间 / 字体
  $("rFontUp").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("字号可调", doc.documentElement.style.getPropertyValue("--fs") === "18.5px",
    doc.documentElement.style.getPropertyValue("--fs"));
  $("rNight").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("夜间模式生效", doc.body.classList.contains("night"));
  $("rNight").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  $("rSerif").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("宋体切换生效", doc.querySelector(".art").classList.contains("serif"));
  $("rSerif").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

  // 返回
  $("rClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("返回后阅读层关闭", !$("reader").classList.contains("open"));

  // 取消勾选课程一 -> 只剩 23 节
  const c2 = doc.querySelectorAll("#sBody .cRow")[0];
  c2.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("取消勾选后待选计数 23", $("applyN").textContent === "23", $("applyN").textContent);
  $("applyD").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert("应用后列表 23 节", doc.querySelectorAll("#list .lesson").length === 23,
    doc.querySelectorAll("#list .lesson").length + "");
  assert("顶栏计数同步 23", $("menuN").textContent === "23", $("menuN").textContent);

  // 搜索
  const kw = $("kw");
  kw.value = "错题";
  kw.dispatchEvent(new window.Event("input", { bubbles: true }));
  setTimeout(() => {
    const n = doc.querySelectorAll("#list .lesson").length;
    assert("搜索「错题」命中课时", n >= 1 && n < 23, "命中 " + n + " 节");

    // 重新全选
    kw.value = "";
    kw.dispatchEvent(new window.Event("input", { bubbles: true }));
    setTimeout(() => {
      $("resetAll").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      $("applyD").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      assert("清空后恢复 49 节", doc.querySelectorAll("#list .lesson").length === 49);

      // 本地存储
      assert("筛选已写入 localStorage", !!window.localStorage.getItem("cr_selL"));

      const realErrors = errors.filter(e => !/Could not parse CSS|Not implemented/.test(e));
      assert("无 JS 运行时错误", realErrors.length === 0, realErrors.join(" | "));
      console.log("\n完成。");
    }, 260);
  }, 260);
}, 400);
