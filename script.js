(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const hud = document.getElementById("hud");
  const scoreValueEl = document.getElementById("scoreValue");
  const toastEl = document.getElementById("toast");

  const startScreen = document.getElementById("startScreen");
  const startBtn = document.getElementById("startBtn");

  const gameOverScreen = document.getElementById("gameOverScreen");
  const finalScoreEl = document.getElementById("finalScore");
  const bestScoreEl = document.getElementById("bestScore");
  const retryBtn = document.getElementById("retryBtn");

  const HIGH_SCORE_KEY = "mahsaStarFlappyHighScore";

  // ---------- sizing ----------

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = window.innerWidth;
  let height = window.innerHeight;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBackgroundStars();
  }

  // ---------- background stars (static, decorative) ----------

  let bgStars = [];

  function buildBackgroundStars() {
    const count = Math.round((width * height) / 9000);
    bgStars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.6 + 0.4,
      op: Math.random() * 0.5 + 0.2,
    }));
  }

  function drawBackgroundStars() {
    bgStars.forEach((s) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(238, 240, 255, ${s.op})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ---------- game constants ----------

  const GRAVITY = 1150;       // px/s^2 — gentle enough to feel forgiving on a phone
  const FLAP_VELOCITY = -360; // px/s
  const MAX_FALL_SPEED = 620; // px/s — terminal velocity, so it never plunges too fast
  const START_LIFT = FLAP_VELOCITY * 0.55; // a small automatic lift the instant you start
  const GRACE_MS = 700; // brief invincible window right after start/retry

  const BIRD_RADIUS = 15;
  const BIRD_X_FRACTION = 0.28;
  const PILLAR_WIDTH = 64;

  const BASE_SPACING = 300;   // px between pillar spawns at score 0
  const MIN_SPACING = 195;    // pillars never get closer than this — stays fair
  const BASE_SPEED = 175;     // px/s
  const MAX_SPEED_BONUS = 110;
  const BASE_GAP = 250;
  const MIN_GAP = 195;

  // Shown one at a time as she scores — a steady stream of compliments,
  // shuffled so the same line doesn't repeat back-to-back.
  const COMPLIMENTS = [
    "تو نازترین دختری 💗",
    "باهوش‌ترین آدمی که می‌شناسم 🧠✨",
    "خوشگل‌ترینی 🌸",
    "زیباترینی 💫",
    "تو قشنگ‌ترین خلقتی 🩷",
    "مهربون‌ترین قلب دنیا مال توئه 💛",
    "همه‌چیزت بی‌نظیره 🤍",
    "چشمات از هزارتا ستاره قشنگ‌تره ✨",
    "خنده‌ت دنیامو روشن می‌کنه 🌟",
    "لبخندت از هر چیزی گرم‌تره 🔥💗",
    "تو بهترین اتفاق زندگیمی 🎀",
    "دلم برات یه دنیا تنگ می‌شه 🥹💗",
    "هیچکس مثل تو نیست 🌷",
    "تو دقیقاً همونی که همیشه آرزوش رو داشتم 💫",
    "قلبم فقط برای تو می‌تپه 💓",
    "تو معجزه‌ی زندگیمی 🌙",
    "با تو همه‌چی قشنگ‌تره 🎈",
    "عزیزترین آدم دنیامی 💕",
    "تو کامل‌ترینی 🤍",
    "صدات آرومم می‌کنه 🎶💗",
    "هر روز بیشتر عاشقتم 💘",
    "تو رویای منی که واقعی شده 🌌",
    "قربونت برم مهسا جان 🫶",
    "تو نورترین چیز زندگیمی ✨🩶",
  ];

  let complimentQueue = [];

  function nextCompliment() {
    if (complimentQueue.length === 0) {
      complimentQueue = [...COMPLIMENTS];
      for (let i = complimentQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [complimentQueue[i], complimentQueue[j]] = [complimentQueue[j], complimentQueue[i]];
      }
    }
    return complimentQueue.pop();
  }

  // ---------- state ----------

  let state = "start"; // 'start' | 'playing' | 'gameover'
  let bird, pillars, hearts, score, trail, distanceSinceSpawn;
  let lastTime = 0;
  let gameStartTime = 0;
  let toastTimer = null;

  function resetGame() {
    bird = {
      x: width * BIRD_X_FRACTION,
      y: height / 2,
      vy: START_LIFT,
      rotation: 0,
    };
    pillars = [];
    hearts = [];
    trail = [];
    score = 0;
    distanceSinceSpawn = 0;
    scoreValueEl.textContent = "0";
  }

  function currentSpeed() {
    return BASE_SPEED + Math.min(score * 3, MAX_SPEED_BONUS);
  }

  function currentSpacing() {
    return Math.max(MIN_SPACING, BASE_SPACING - score * 4);
  }

  function spawnPillar() {
    const margin = 74;
    const gapHeight = Math.max(MIN_GAP, BASE_GAP - score * 2);
    const gapY = margin + Math.random() * (height - margin * 2 - gapHeight);
    pillars.push({ x: width + PILLAR_WIDTH, gapY, gapHeight, passed: false });
  }

  function flap() {
    if (state !== "playing") return;
    bird.vy = FLAP_VELOCITY;
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("visible"), 1700);
  }

  // ---------- heart-burst particles ----------

  const HEART_COLORS = ["#ffd98a", "#ff9fc0", "#ff6f91", "#ffffff", "#f6c9e0"];

  function spawnHeartBurst(x, y) {
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 90;
      hearts.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: 8 + Math.random() * 8,
        life: 0,
        maxLife: 0.9 + Math.random() * 0.5,
        color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      });
    }
  }

  function updateHearts(dt) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.life += dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.vy += 90 * dt;
      if (h.life >= h.maxLife) hearts.splice(i, 1);
    }
  }

  function drawHeartShape(c, cx, cy, size) {
    c.beginPath();
    const top = size * 0.3;
    c.moveTo(cx, cy + top);
    c.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + top);
    c.bezierCurveTo(cx - size / 2, cy + (size + top) / 2, cx, cy + (size + top) / 2, cx, cy + size);
    c.bezierCurveTo(cx, cy + (size + top) / 2, cx + size / 2, cy + (size + top) / 2, cx + size / 2, cy + top);
    c.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + top);
    c.closePath();
  }

  function drawHearts() {
    hearts.forEach((h) => {
      const t = h.life / h.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.fillStyle = h.color;
      drawHeartShape(ctx, h.x, h.y, h.size * (1 - t * 0.3));
      ctx.fill();
      ctx.restore();
    });
  }

  function celebratePoint() {
    spawnHeartBurst(bird.x, bird.y);
    showToast(nextCompliment());
  }

  function circleRectOverlap(cx, cy, r, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < r * r;
  }

  function endGame() {
    state = "gameover";
    hud.hidden = true;
    toastEl.classList.remove("visible");

    const best = Math.max(score, parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0", 10));
    localStorage.setItem(HIGH_SCORE_KEY, String(best));

    finalScoreEl.textContent = String(score);
    bestScoreEl.textContent = String(best);
    gameOverScreen.hidden = false;
  }

  function startGame() {
    resetGame();
    state = "playing";
    gameStartTime = performance.now();
    startScreen.hidden = true;
    gameOverScreen.hidden = true;
    hud.hidden = false;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // ---------- update & draw ----------

  function update(dt, now) {
    const inGrace = now - gameStartTime < GRACE_MS;

    bird.vy += GRAVITY * dt;
    if (bird.vy > MAX_FALL_SPEED) bird.vy = MAX_FALL_SPEED;
    bird.y += bird.vy * dt;
    bird.rotation = Math.max(-0.5, Math.min(1.1, bird.vy / 600));

    // during the grace window, keep the star safely on screen instead of
    // letting an unlucky resize or a slow first tap end the run instantly
    if (inGrace) {
      bird.y = Math.max(BIRD_RADIUS + 4, Math.min(height - BIRD_RADIUS - 4, bird.y));
    }

    trail.push({ x: bird.x, y: bird.y });
    if (trail.length > 10) trail.shift();

    updateHearts(dt);

    const speed = currentSpeed();
    distanceSinceSpawn += speed * dt;
    if (distanceSinceSpawn >= currentSpacing()) {
      distanceSinceSpawn = 0;
      spawnPillar();
    }

    for (let i = pillars.length - 1; i >= 0; i--) {
      const p = pillars[i];
      p.x -= speed * dt;

      if (!p.passed && p.x + PILLAR_WIDTH < bird.x) {
        p.passed = true;
        score += 1;
        scoreValueEl.textContent = String(score);
        celebratePoint();
      }

      if (p.x + PILLAR_WIDTH < -10) {
        pillars.splice(i, 1);
        continue;
      }

      if (!inGrace) {
        const hitTop = circleRectOverlap(bird.x, bird.y, BIRD_RADIUS, p.x, 0, PILLAR_WIDTH, p.gapY);
        const hitBottom = circleRectOverlap(
          bird.x, bird.y, BIRD_RADIUS,
          p.x, p.gapY + p.gapHeight, PILLAR_WIDTH, height - (p.gapY + p.gapHeight)
        );
        if (hitTop || hitBottom) {
          endGame();
          return;
        }
      }
    }

    // only the ground ends the run — bumping the top just stops you there,
    // which feels much fairer on a small screen
    if (bird.y + BIRD_RADIUS > height) {
      if (!inGrace) {
        endGame();
        return;
      }
      bird.y = height - BIRD_RADIUS - 4;
    }
    if (bird.y - BIRD_RADIUS < 0) {
      bird.y = BIRD_RADIUS;
      bird.vy = Math.max(bird.vy, 0);
    }
  }

  function drawPillars() {
    pillars.forEach((p) => {
      const grad = ctx.createLinearGradient(p.x, 0, p.x + PILLAR_WIDTH, 0);
      grad.addColorStop(0, "#241f52");
      grad.addColorStop(0.5, "#332c74");
      grad.addColorStop(1, "#241f52");

      ctx.save();
      ctx.shadowColor = "rgba(150, 140, 255, 0.35)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = grad;

      roundRect(ctx, p.x, -20, PILLAR_WIDTH, p.gapY + 20, 18);
      ctx.fill();
      roundRect(ctx, p.x, p.gapY + p.gapHeight, PILLAR_WIDTH, height - (p.gapY + p.gapHeight) + 20, 18);
      ctx.fill();
      ctx.restore();
    });
  }

  function roundRect(c, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
  }

  function drawStarShape(c, cx, cy, outerR, innerR, points) {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  }

  function drawBird() {
    trail.forEach((t, i) => {
      const op = (i / trail.length) * 0.35;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 217, 138, ${op})`;
      ctx.arc(t.x, t.y, BIRD_RADIUS * (0.4 + (i / trail.length) * 0.4), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    ctx.shadowColor = "rgba(255, 217, 138, 0.9)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#fff6df";
    drawStarShape(ctx, 0, 0, BIRD_RADIUS, BIRD_RADIUS * 0.45, 5);
    ctx.fill();

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawBackgroundStars();
    drawPillars();
    drawHearts();
    drawBird();
  }

  function loop(now) {
    if (state !== "playing") return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    update(dt, now);
    if (state !== "playing") {
      draw();
      return;
    }
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- input ----------

  let lastInputTime = 0;

  function handlePrimaryInput() {
    // pointerdown and touchstart both fire for a single physical tap on most
    // touchscreens — without this guard every tap would double-fire (two
    // flaps, or two overlapping game loops started at once).
    const now = performance.now();
    if (now - lastInputTime < 80) return;
    lastInputTime = now;

    if (state === "start") {
      startGame();
    } else if (state === "playing") {
      flap();
    } else if (state === "gameover") {
      startGame();
    }
  }

  // pointerdown covers mouse + touch on virtually every modern browser, but
  // some in-app webviews (Telegram/Instagram browsers etc.) are inconsistent,
  // so touchstart is wired up too as a safety net. Calling the handler twice
  // for one tap is harmless — flap() and startGame() are both idempotent.
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handlePrimaryInput();
  });

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      handlePrimaryInput();
    },
    { passive: false }
  );

  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });

  retryBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      handlePrimaryInput();
    }
  });

  // Mobile browsers often correct window.innerHeight a moment after the page
  // loads (address bar collapsing, etc.). If that resize lands mid-game, we
  // clamp the star back into view instead of letting a shrinking viewport
  // count as an instant, unfair death.
  window.addEventListener("resize", () => {
    resize();
    if (state === "playing" && bird) {
      bird.y = Math.min(Math.max(bird.y, BIRD_RADIUS + 2), height - BIRD_RADIUS - 2);
    } else {
      draw();
    }
  });

  window.addEventListener("orientationchange", () => {
    setTimeout(resize, 250);
  });

  // ---------- init ----------

  resize();
  // some mobile browsers report a slightly-off innerHeight on first paint —
  // correct it a beat later so the very first game isn't sized wrong
  setTimeout(resize, 300);
  draw();
})();
