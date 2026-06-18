/* Flappy TBAN — moteur de jeu (canvas 2D, sans dépendance).
   États : "ready" (écran d'accueil) → "playing" → "dead" (Game Over). */
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;   // 360
  const H = canvas.height;  // 640

  // --- Réglages du gameplay --------------------------------------------------
  const GROUND_H = 90;
  const FLOOR_Y = H - GROUND_H;
  const GRAVITY = 1500;        // px/s²
  const FLAP_V = -430;         // impulsion vers le haut (px/s)
  const PIPE_W = 64;
  const PIPE_GAP = 165;        // ouverture entre les tuyaux
  const PIPE_SPACING = 220;    // distance horizontale entre deux tuyaux
  const PIPE_SPEED = 150;      // px/s vers la gauche
  const BIRD_X = 96;
  const BIRD_R = 15;

  // --- État ------------------------------------------------------------------
  let state = 'ready';
  let bird = { y: H / 2, v: 0 };
  let pipes = [];
  let score = 0;
  let spawnDx = 0;            // distance parcourue depuis le dernier tuyau
  let groundScroll = 0;
  let lastTime = 0;

  function reset() {
    bird = { y: H / 2, v: 0 };
    pipes = [];
    score = 0;
    spawnDx = PIPE_SPACING;  // un tuyau apparaît rapidement
    state = 'playing';
    hideGameOver();
  }

  function spawnPipe() {
    const margin = 60;
    const gapTop =
      margin + Math.random() * (FLOOR_Y - PIPE_GAP - margin * 2);
    pipes.push({ x: W + PIPE_W, gapTop, passed: false });
  }

  function flap() {
    if (state === 'ready') { reset(); return; }
    if (state === 'playing') { bird.v = FLAP_V; return; }
    // En "dead", on ne relance pas au clic (on passe par le bouton Rejouer
    // pour ne pas rejouer par accident en validant le pseudo).
  }

  // --- Boucle de jeu ---------------------------------------------------------
  function update(dt) {
    if (state !== 'playing') return;

    bird.v += GRAVITY * dt;
    bird.y += bird.v * dt;

    // Génération des tuyaux à intervalle de distance régulier
    spawnDx += PIPE_SPEED * dt;
    if (spawnDx >= PIPE_SPACING) {
      spawnDx -= PIPE_SPACING;
      spawnPipe();
    }

    for (const p of pipes) {
      p.x -= PIPE_SPEED * dt;
      if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
        p.passed = true;
        score++;
      }
    }
    pipes = pipes.filter((p) => p.x + PIPE_W > -10);

    // Collisions sol / plafond
    if (bird.y + BIRD_R >= FLOOR_Y || bird.y - BIRD_R <= 0) {
      return die();
    }
    // Collisions avec les tuyaux
    for (const p of pipes) {
      if (hitsPipe(p)) return die();
    }
  }

  // Collision cercle (oiseau) / rectangles (tuyaux haut et bas)
  function hitsPipe(p) {
    const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
    if (!inX) return false;
    const gapBottom = p.gapTop + PIPE_GAP;
    return bird.y - BIRD_R < p.gapTop || bird.y + BIRD_R > gapBottom;
  }

  function die() {
    if (state !== 'playing') return;
    state = 'dead';
    showGameOver(score);
  }

  // --- Rendu -----------------------------------------------------------------
  function draw() {
    // Ciel
    ctx.fillStyle = '#4ec0ca';
    ctx.fillRect(0, 0, W, H);
    drawClouds();

    // Tuyaux
    for (const p of pipes) drawPipe(p);

    // Sol
    drawGround();

    // Oiseau
    drawBird();

    // Score en cours de partie
    if (state === 'playing' || state === 'dead') {
      drawScore(score);
    }
    if (state === 'ready') drawReady();
  }

  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    const offset = (groundScroll * 0.3) % (W + 120);
    for (let i = 0; i < 3; i++) {
      const cx = ((i * 150 - offset) % (W + 120) + W + 120) % (W + 120) - 60;
      const cy = 90 + (i % 2) * 60;
      ellipse(cx, cy, 34, 16);
      ellipse(cx + 24, cy + 6, 26, 13);
      ellipse(cx - 22, cy + 8, 22, 11);
    }
  }

  function drawPipe(p) {
    const gapBottom = p.gapTop + PIPE_GAP;
    const lip = 18;
    // Corps
    ctx.fillStyle = '#5bbf2e';
    ctx.fillRect(p.x, 0, PIPE_W, p.gapTop);
    ctx.fillRect(p.x, gapBottom, PIPE_W, FLOOR_Y - gapBottom);
    // Rebords (lèvres)
    ctx.fillStyle = '#4a9e25';
    ctx.fillRect(p.x - 4, p.gapTop - lip, PIPE_W + 8, lip);
    ctx.fillRect(p.x - 4, gapBottom, PIPE_W + 8, lip);
    // Contour clair
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(p.x + 6, 0, 6, p.gapTop);
    ctx.fillRect(p.x + 6, gapBottom, 6, FLOOR_Y - gapBottom);
  }

  function drawGround() {
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, FLOOR_Y, W, GROUND_H);
    ctx.fillStyle = '#caa45a';
    ctx.fillRect(0, FLOOR_Y, W, 8);
    // Hachures qui défilent
    ctx.fillStyle = '#c2b765';
    const step = 24;
    const off = groundScroll % step;
    for (let x = -off; x < W; x += step) {
      ctx.fillRect(x, FLOOR_Y + 12, 12, 10);
    }
  }

  function drawBird() {
    const angle = Math.max(-0.5, Math.min(1.1, bird.v / 600));
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(angle);

    // Corps
    ctx.fillStyle = '#f7c948';
    circle(0, 0, BIRD_R);
    ctx.fillStyle = '#f0a500';
    circle(0, BIRD_R - 6, BIRD_R - 4); // ventre légèrement plus foncé
    // Aile
    ctx.fillStyle = '#fff3bf';
    ellipse(-3, 2, 8, 5);
    // Œil
    ctx.fillStyle = '#fff';
    circle(6, -5, 5);
    ctx.fillStyle = '#1f2933';
    circle(8, -5, 2.4);
    // Bec
    ctx.fillStyle = '#e8590c';
    ctx.beginPath();
    ctx.moveTo(BIRD_R - 2, -2);
    ctx.lineTo(BIRD_R + 8, 1);
    ctx.lineTo(BIRD_R - 2, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawScore(s) {
    ctx.font = 'bold 48px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1f2933';
    ctx.fillStyle = '#fff';
    ctx.strokeText(String(s), W / 2, 80);
    ctx.fillText(String(s), W / 2, 80);
  }

  function drawReady() {
    ctx.fillStyle = 'rgba(31,41,51,.35)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('Prêt ?', W / 2, H / 2 - 30);
    ctx.font = '500 18px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('Clique / Espace / tap', W / 2, H / 2 + 6);
    ctx.fillText('pour commencer', W / 2, H / 2 + 30);
  }

  // Petites aides de dessin
  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function ellipse(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    lastTime = ts;
    if (dt > 0.05) dt = 0.05; // borne anti-saut (onglet en arrière-plan)

    if (state === 'playing') groundScroll += PIPE_SPEED * dt;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // --- Game Over / Leaderboard ----------------------------------------------
  const gameoverEl = document.getElementById('gameover');
  const finalScoreEl = document.getElementById('final-score');
  const form = document.getElementById('score-form');
  const nameInput = document.getElementById('player-name');
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');
  const replayBtn = document.getElementById('replay');
  const scoresEl = document.getElementById('scores');
  const refreshBtn = document.getElementById('refresh');

  function showGameOver(s) {
    finalScoreEl.textContent = s;
    saveStatus.textContent = '';
    saveBtn.disabled = false;
    saveBtn.textContent = 'Enregistrer mon score';
    gameoverEl.classList.remove('hidden');
    nameInput.focus();
  }
  function hideGameOver() {
    gameoverEl.classList.add('hidden');
  }

  async function loadScores() {
    scoresEl.innerHTML = '<li class="empty">Chargement…</li>';
    try {
      const res = await fetch('/api/scores');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = await res.json();
      renderScores(rows);
    } catch (err) {
      scoresEl.innerHTML =
        '<li class="error">Classement indisponible</li>';
      console.error('Lecture du classement impossible :', err);
    }
  }

  function renderScores(rows) {
    if (!rows.length) {
      scoresEl.innerHTML =
        '<li class="empty">Aucun score — sois le premier !</li>';
      return;
    }
    scoresEl.innerHTML = rows
      .map(
        (r) =>
          `<li><span class="pname">${escapeHtml(r.name)}</span>` +
          `<span class="pscore">${r.score}</span></li>`
      )
      .join('');
  }

  async function submitScore(name, value) {
    saveBtn.disabled = true;
    saveStatus.textContent = 'Envoi…';
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: value }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      saveStatus.textContent = 'Score enregistré ✔';
      saveBtn.textContent = 'Enregistré';
      await loadScores();
    } catch (err) {
      saveStatus.textContent = 'Échec de l\'envoi, réessaie.';
      saveBtn.disabled = false;
      console.error('Envoi du score impossible :', err);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // --- Entrées ---------------------------------------------------------------
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); flap(); });
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      // Ne pas voler si on est en train de taper son pseudo
      if (document.activeElement === nameInput) return;
      e.preventDefault();
      flap();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (saveBtn.disabled) return;
    const name = nameInput.value.trim() || 'Anonyme';
    submitScore(name, score);
  });

  replayBtn.addEventListener('click', () => reset());
  refreshBtn.addEventListener('click', () => loadScores());

  // --- Démarrage -------------------------------------------------------------
  loadScores();
  requestAnimationFrame(loop);
})();
