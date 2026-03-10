/*
  只做“必要且轻量”的交互：
  - 平滑滚动到锚点
  - 移动端汉堡菜单开合
  - 滚动出现动画（IntersectionObserver）
  - 导航当前区域高亮
  - 点击复制联系方式 + Toast 提示
  - 顶部滚动进度条
*/

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Footer 年份
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ============ 移动端菜单 ============
  const toggle = $(".nav-toggle");
  const panel = $("[data-nav-panel]");

  function setMenu(open) {
    if (!toggle || !panel) return;
    panel.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.documentElement.classList.toggle("menu-open", open);
  }

  if (toggle && panel) {
    toggle.addEventListener("click", () => {
      const isOpen = panel.classList.contains("is-open");
      setMenu(!isOpen);
    });

    // 点击面板外关闭
    document.addEventListener("click", (e) => {
      const isOpen = panel.classList.contains("is-open");
      if (!isOpen) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (panel.contains(target) || toggle.contains(target)) return;
      setMenu(false);
    });

    // 按 ESC 关闭
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setMenu(false);
    });
  }

  // ============ 平滑滚动（含关闭菜单） ============
  $$('a[data-scroll][href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const target = $(href);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setMenu(false);
      history.pushState(null, "", href);
    });
  });

  // ============ 滚动出现动画 ============
  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    // 老浏览器兜底：直接显示
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  // ============ 导航当前区域高亮 ============
  const sections = $$("main section[id]");
  const linkById = new Map();
  $$(".nav-link[href^='#']").forEach((link) => {
    const id = link.getAttribute("href")?.slice(1);
    if (id) linkById.set(id, link);
  });

  function setActive(id) {
    $$(".nav-link.is-active").forEach((el) => el.classList.remove("is-active"));
    const link = linkById.get(id);
    if (link) link.classList.add("is-active");
  }

  if ("IntersectionObserver" in window && sections.length) {
    const navIO = new IntersectionObserver(
      (entries) => {
        // 取“可见比例最大”的那个 section 当作当前区域
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;
        visible.sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0));
        const id = visible[0].target.id;
        setActive(id);
      },
      {
        root: null,
        threshold: [0.18, 0.28, 0.38, 0.5, 0.62],
      }
    );
    sections.forEach((sec) => navIO.observe(sec));
  }

  // ============ 点击复制（联系方式） ============
  const toast = $(".toast");
  let toastTimer = 0;

  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 1400);
  }

  async function copyText(text) {
    // 优先使用现代 API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // 兜底：临时 textarea
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      document.body.removeChild(ta);
      return false;
    }
  }

  $$("[data-copy]").forEach((el) => {
    el.addEventListener("click", async () => {
      const text = el.getAttribute("data-copy") || "";
      if (!text) return;
      const ok = await copyText(text);
      showToast(ok ? "已复制到剪贴板" : "复制失败，请手动复制");
    });
  });

  // ============ 顶部滚动进度条 ============
  const progress = $(".scroll-progress");
  let ticking = false;

  function updateProgress() {
    ticking = false;
    if (!progress) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const value = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    progress.style.width = `${Math.max(0, Math.min(100, value))}%`;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateProgress);
    },
    { passive: true }
  );
  updateProgress();
})();

