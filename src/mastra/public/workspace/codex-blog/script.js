/* ============================================================
   codex-blog — 轻量交互：打字机效果 + 页脚年份
   纯原生 JS，无外部依赖
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 页脚年份 ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- 打字机效果 ---------- */
  var typedEl = document.getElementById("typed");
  if (!typedEl) return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var lines = [
    "npx create-dev-log --theme=codex --dark",
    "正在编译回忆…… 78 篇文章已索引",
    "欢迎来到我的数字花园，慢用 ☕"
  ];

  // 尊重无障碍偏好：直接显示完整内容，不做逐字动画
  if (reduceMotion) {
    typedEl.textContent = lines.join("  ·  ");
    return;
  }

  var lineIdx = 0;
  var charIdx = 0;
  var deleting = false;

  function tick() {
    var current = lines[lineIdx];
    var delay;

    if (!deleting) {
      // 逐字输入
      charIdx++;
      typedEl.textContent = current.slice(0, charIdx);
      delay = 46 + Math.random() * 54;

      if (charIdx === current.length) {
        // 整行输入完成，停顿后再删除
        deleting = true;
        delay = 1900;
      }
    } else {
      // 逐字删除
      charIdx--;
      typedEl.textContent = current.slice(0, charIdx);
      delay = 24;

      if (charIdx === 0) {
        deleting = false;
        lineIdx = (lineIdx + 1) % lines.length;
        delay = 420;
      }
    }

    window.setTimeout(tick, delay);
  }

  // 起始稍作停顿，避免页面一加载就抖动
  window.setTimeout(tick, 520);
})();
