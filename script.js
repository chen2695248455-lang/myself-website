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

  const hasFinePointer = window.matchMedia ? window.matchMedia("(pointer: fine)").matches : true;
  const mouse = { x: 0, y: 0, active: false };

  // Footer 年份
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ============ 全局鼠标光晕（桌面端） ============
  const cursorLight = $(".cursor-light");
  if (hasFinePointer && cursorLight) {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let cursorVisible = false;

    window.addEventListener(
      "pointermove",
      (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
        targetX = e.clientX;
        targetY = e.clientY;
        if (!cursorVisible) {
          cursorVisible = true;
          cursorLight.style.opacity = "1";
        }
      },
      { passive: true }
    );

    const renderCursor = () => {
      // 轻微跟随滞后，显得更柔和
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;
      cursorLight.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
      window.requestAnimationFrame(renderCursor);
    };
    renderCursor();
  }

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

  // ============ 技能进度条动画（进入视口时填充） ============
  const meters = $$(".meter__bar");
  if ("IntersectionObserver" in window && meters.length) {
    const meterIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const level = el.getAttribute("data-level");
          if (level) {
            el.style.setProperty("--w", `${level}%`);
          }
          el.classList.add("is-fill");
          meterIO.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    meters.forEach((m) => meterIO.observe(m));
  } else {
    meters.forEach((m) => m.classList.add("is-fill"));
  }

  // ============ AI 粒子背景（轻量级） ============
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("ai-particles"));
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      const particles = [];
      const COUNT = 52;

      let width = 0;
      let height = 0;

      function resize() {
        width = window.innerWidth || document.documentElement.clientWidth || 0;
        height = window.innerHeight || document.documentElement.clientHeight || 0;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function createParticles() {
        particles.length = 0;
        for (let i = 0; i < COUNT; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r: 1.2 + Math.random() * 2.2,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
          });
        }
      }

      function step() {
        ctx.clearRect(0, 0, width, height);

        // 连线
        for (let i = 0; i < particles.length; i++) {
          const p1 = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
              let alpha = 1 - dist / 120;
              // 鼠标附近连线稍微更亮一点
              if (mouse.active) {
                const mx = (p1.x + p2.x) / 2 - mouse.x;
                const my = (p1.y + p2.y) / 2 - mouse.y;
                const md = Math.sqrt(mx * mx + my * my);
                if (md < 200) alpha *= 1.6;
              }
              ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.18})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }

        // 粒子
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          if (p.y > height + 20) p.y = -20;

          let radius = p.r * 2.2;
          if (mouse.active) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 180) {
              const boost = 1.6 - dist / 180;
              radius *= 1 + boost * 0.8;
            }
          }

          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          g.addColorStop(0, "rgba(244, 244, 245, 0.9)");
          g.addColorStop(1, "rgba(59, 130, 246, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        window.requestAnimationFrame(step);
      }

      resize();
      createParticles();
      step();

      let resizeTimer = 0;
      window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          resize();
          createParticles();
        }, 160);
      });
    }
  }
})();

