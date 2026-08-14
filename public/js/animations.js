(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w, h, dpr, points, scrollY = 0, raf = null, running = false;

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function init() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const density = Math.min(110, Math.floor((w * h) / 15000));
    points = [];
    for (let i = 0; i < density; i++) {
      points.push({
        x: rand(0, w), y: rand(0, h),
        vx: rand(-0.16, 0.16), vy: rand(-0.16, 0.16),
        r: rand(0.6, 1.8), depth: rand(0.3, 1.2)
      });
    }
  }

  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    const offset = scrollY * 0.06;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const py = p.y - offset * p.depth;
      for (let j = i + 1; j < points.length; j++) {
        const q = points[j];
        const qy = q.y - offset * q.depth;
        const dx = p.x - q.x, dy = py - qy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 128) {
          const alpha = (1 - dist / 128) * 0.3;
          ctx.strokeStyle = `rgba(80, 150, 255, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, py);
          ctx.lineTo(q.x, qy);
          ctx.stroke();
        }
      }
    }

    for (const p of points) {
      const py = p.y - offset * p.depth;
      const wrapped = ((py % (h + 80)) + (h + 80)) % (h + 80);
      ctx.beginPath();
      ctx.arc(p.x, wrapped, p.r, 0, Math.PI * 2);
      const glow = 0.5 + p.depth * 0.4;
      ctx.fillStyle = `rgba(150, 200, 255, ${glow})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(60, 130, 255, 0.7)';
      ctx.fill();
      ctx.shadowBlur = 0;

      if (!reduceMotion) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      }
    }
    raf = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true;
    canvas.style.display = 'block';
    init();
    draw();
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    ctx && ctx.clearRect(0, 0, w || 0, h || 0);
    canvas.style.display = 'none';
  }

  function onScroll() { scrollY = window.scrollY; }
  let resizeTimer;
  function onResize() {
    if (!running) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 200);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (running) { draw(); }
  });

  window.SpaceBG = {
    enable() { start(); },
    disable() { stop(); }
  };

})();
