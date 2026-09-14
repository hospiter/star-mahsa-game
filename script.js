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

  const GRAVITY = 1500;       // px/s^2
  const FLAP_VELOCITY = -420; // px/s
  const BIRD_RADIUS = 15;
  const BIRD_X_FRACTION = 0.28;
  const PILLAR_WIDTH = 64;
  const PILLAR_SPACING = 280; // px between pillar spawn points
  const BASE_SPEED = 190;     // px/s
  const MAX_SPEED_BONUS = 130;

  const MILESTONES = [
    { score: 5, text: "دیدی؟ داری می‌درخشی ✨" },
    { score: 10, text: "همینجوری برو، ستاره‌ی من 💫" },
    { score: 15, text: "هیچی نمی‌تونه جلوتو بگیره 🌙" },
    { score: 20, text: "تو از هر ستاره‌ای پرنورتری 🩶" },
    { score: 30, text: "عالی داری پیش میری، مهسا جان 🌸" },
    { score: 50, text: "افسانه‌ای شدی! 🏆" },
  ];

  // ---------- state ----------

  let state = "start"; // 'start' | 'playing' | 'gameover'
  let bird, pillars, score, trail, distanceSinceSpawn, shownMilestones;
  let lastTime = 0;
  let toastTimer = null;

  function resetGame() {
    bird = {
      x: width * BIRD_X_FRACTION,
      y: height / 2,
      vy: 0,
      rotation: 0,
    };
    pillars = [];
    trail = [];
    score = 0;
    distanceSinceSpawn = 0;
    shownMilestones = new Set();
    scoreValueEl.textContent = "0";
  }

  function currentSpeed() {
    return BASE_SPEED + Math.min(score * 3, MAX_SPEED_BONUS);
  }

  function spawnPillar() {
    const margin = 70;
    const gapHeight = Math.max(190, 250 - Math.min(score * 2, 60));
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
    toastTimer = setTimeout(() => toastEl.classList.remove("visible"), 2200);
  }

  function checkMilestones() {
    MILESTONES.forEach((m) => {
      if (score === m.score && !shownMilestones.has(m.score)) {
        shownMilestones.add(m.score);
        showToast(m.text);
      }
    });
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
    startScreen.hidden = true;
    gameOverScreen.hidden = true;
    hud.hidden = false;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // ---------- update & draw ----------

  function update(dt) {
    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;
    bird.rotation = Math.max(-0.5, Math.min(1.1, bird.vy / 600));

    trail.push({ x: bird.x, y: bird.y });
    if (trail.length > 10) trail.shift();

    const speed = currentSpeed();
    distanceSinceSpawn += speed * dt;
    if (distanceSinceSpawn >= PILLAR_SPACING) {
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
        checkMilestones();
      }

      if (p.x + PILLAR_WIDTH < -10) {
        pillars.splice(i, 1);
        continue;
      }

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

    if (bird.y - BIRD_RADIUS < 0 || bird.y + BIRD_RADIUS > height) {
      endGame();
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
    drawBird();
  }

  function loop(now) {
    if (state !== "playing") return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    update(dt);
    if (state !== "playing") {
      draw();
      return;
    }
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- input ----------

  function handlePrimaryInput() {
    if (state === "start") {
      startGame();
    } else if (state === "playing") {
      flap();
    } else if (state === "gameover") {
      startGame();
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handlePrimaryInput();
  });

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

  window.addEventListener("resize", () => {
    resize();
    if (state !== "playing") draw();
  });

  // ---------- init ----------

  resize();
  draw();
})();
