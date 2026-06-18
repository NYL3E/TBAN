/* Flappy TBAN — moteur de jeu (canvas 2D, sans dépendance).
   - Pseudo défini UNE fois (en haut à droite), mémorisé (localStorage).
   - Difficulté progressive douce avec le score.
   - Score enregistré AUTOMATIQUEMENT en base à chaque partie. */
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
  const PIPE_SPACING = 220;    // distance horizontale entre deux tuyaux
  const BIRD_X = 96;
  const BIRD_R = 15;

  // Difficulté progressive (douce et bornée — "pas abusé") :
  // la vitesse augmente et l'ouverture se resserre légèrement avec le score.
  const BASE_SPEED = 150, MAX_SPEED = 270;
  const BASE_GAP = 175, MIN_GAP = 120;
  const speedFor = (ts) => Math.min(MAX_SPEED, BASE_SPEED + ts * 3);
  const gapFor = (ts) => Math.max(MIN_GAP, BASE_GAP - ts * 1.6);

  // --- État ------------------------------------------------------------------
  let state = 'ready';        // "ready" | "playing" | "dead"
  let bird = { y: H / 2, v: 0 };
  let pipes = [];
  let score = 0;              // Current level score (0-29) displayed on scoreboard
  let totalScore = 0;         // Cumulative score used for difficulty & database
  let spawnDx = 0;
  let groundScroll = 0;
  let lastTime = 0;

  // Level Up popup state
  let levelUpTimer = 0;
  let levelUpText = '';

  // Background stars for night mode
  const stars = [];
  for (let i = 0; i < 40; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * (FLOOR_Y - 50),
      r: 0.5 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      speed: 1 + Math.random() * 3
    });
  }

  // --- Pseudo (identité du joueur) ------------------------------------------
  const STORE_KEY = 'flappy_tban_pseudo';
  const setEl = document.getElementById('player-set');
  const nameDisplay = document.getElementById('player-name-display');
  const editBtn = document.getElementById('player-edit');
  const formEl = document.getElementById('player-form');
  const inputEl = document.getElementById('player-input');

  let pseudo = (localStorage.getItem(STORE_KEY) || '').trim();

  function showLocked() {
    nameDisplay.textContent = pseudo;
    setEl.classList.remove('hidden');
    formEl.classList.add('hidden');
  }
  function showEditing() {
    inputEl.value = pseudo;
    setEl.classList.add('hidden');
    formEl.classList.remove('hidden');
    inputEl.focus();
    inputEl.select();
  }
  if (pseudo) showLocked(); else showEditing();

  editBtn.addEventListener('click', showEditing);
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = inputEl.value.trim().slice(0, 20);
    if (!val) { inputEl.focus(); return; }   // pseudo obligatoire
    pseudo = val;
    localStorage.setItem(STORE_KEY, pseudo);
    showLocked();
  });

  // --- Cycle de partie -------------------------------------------------------
  function reset() {
    bird = { y: H / 2, v: 0 };
    pipes = [];
    score = 0;
    totalScore = 0;
    levelUpTimer = 0;
    levelUpText = '';
    spawnDx = PIPE_SPACING;
    state = 'playing';
    gameoverEl.classList.add('hidden');
  }

  function spawnPipe() {
    const gap = gapFor(totalScore);
    const margin = 60;
    const gapTop = margin + Math.random() * (FLOOR_Y - gap - margin * 2);
    pipes.push({ x: W + PIPE_W, gapTop, gap, passed: false });
  }

  function flap() {
    if (state === 'ready') {
      if (!pseudo) { showEditing(); return; }   // on exige le pseudo d'abord
      reset();
      return;
    }
    if (state === 'playing') bird.v = FLAP_V;
    // En "dead" : on ne relance qu'avec le bouton Rejouer.
  }

  // --- Mise à jour -----------------------------------------------------------
  function update(dt) {
    if (levelUpTimer > 0) {
      levelUpTimer -= dt;
    }

    if (state !== 'playing') return;
    const speed = speedFor(totalScore);

    bird.v += GRAVITY * dt;
    bird.y += bird.v * dt;

    spawnDx += speed * dt;
    if (spawnDx >= PIPE_SPACING) {
      spawnDx -= PIPE_SPACING;
      spawnPipe();
    }

    for (const p of pipes) {
      p.x -= speed * dt;
      if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
        p.passed = true;
        totalScore++;
        // Play level up message and reset display score every 30 points
        if (totalScore % 30 === 0) {
          levelUpTimer = 2.0;
          const stage = Math.floor(totalScore / 30);
          const stageNames = ['Sunset', 'Night', 'Sunrise', 'Day'];
          levelUpText = `LEVEL ${stage + 1}: ${stageNames[stage % 4]}`;
        }
        score = totalScore % 30;
      }
    }
    pipes = pipes.filter((p) => p.x + PIPE_W > -10);

    if (bird.y + BIRD_R >= FLOOR_Y || bird.y - BIRD_R <= 0) return die();
    for (const p of pipes) if (hitsPipe(p)) return die();
  }

  function hitsPipe(p) {
    const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
    if (!inX) return false;
    const gapBottom = p.gapTop + p.gap;
    return bird.y - BIRD_R < p.gapTop || bird.y + BIRD_R > gapBottom;
  }

  function die() {
    if (state !== 'playing') return;
    state = 'dead';
    showGameOver(totalScore);
    saveScore(totalScore);   // save the cumulative total score
  }

  // --- Rendu -----------------------------------------------------------------
  function drawStars(ts) {
    for (const star of stars) {
      const opacity = 0.3 + 0.7 * Math.abs(Math.sin(star.phase + (ts * 0.002)));
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(ts) {
    // Determine the environment stage based on totalScore (every 30 points)
    const stage = Math.floor((totalScore % 120) / 30);
    let skyGradient = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);

    if (stage === 0) {
      // Day (0-29, 120-149, etc.)
      skyGradient.addColorStop(0, '#4ec0ca');
      skyGradient.addColorStop(1, '#a6e3e9');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, W, H);
      drawClouds('rgba(255, 255, 255, 0.55)');
    } else if (stage === 1) {
      // Evening Sunset (30-59, 150-179, etc.)
      skyGradient.addColorStop(0, '#2c1654');
      skyGradient.addColorStop(0.5, '#f95c88');
      skyGradient.addColorStop(1, '#ffbe53');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, W, H);

      // Sunset Sun
      const sunGrad = ctx.createRadialGradient(W / 2, FLOOR_Y - 10, 5, W / 2, FLOOR_Y - 10, 60);
      sunGrad.addColorStop(0, 'rgba(255, 230, 150, 1)');
      sunGrad.addColorStop(0.4, 'rgba(255, 120, 80, 0.9)');
      sunGrad.addColorStop(1, 'rgba(255, 80, 50, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(W / 2, FLOOR_Y - 10, 60, 0, Math.PI * 2);
      ctx.fill();

      drawClouds('rgba(255, 180, 200, 0.4)');
    } else if (stage === 2) {
      // Night (60-89, 180-209, etc.)
      skyGradient.addColorStop(0, '#0b0f19');
      skyGradient.addColorStop(1, '#1a233a');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, W, H);

      // Stars
      drawStars(ts || 0);

      // Moon
      ctx.fillStyle = 'rgba(254, 254, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(W - 80, 100, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#fefeff';
      ctx.beginPath();
      ctx.arc(W - 80, 100, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawClouds('rgba(255, 255, 255, 0.08)');
    } else if (stage === 3) {
      // Morning Sunrise (90-119, 210-239, etc.)
      skyGradient.addColorStop(0, '#1b2a47');
      skyGradient.addColorStop(0.5, '#f39189');
      skyGradient.addColorStop(1, '#ffe2ad');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, W, H);

      // Sunrise Sun
      const sunGrad = ctx.createRadialGradient(80, FLOOR_Y - 10, 5, 80, FLOOR_Y - 10, 50);
      sunGrad.addColorStop(0, '#ffffff');
      sunGrad.addColorStop(0.3, '#ffe893');
      sunGrad.addColorStop(1, 'rgba(255, 226, 173, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(80, FLOOR_Y - 10, 50, 0, Math.PI * 2);
      ctx.fill();

      drawClouds('rgba(255, 240, 200, 0.45)');
    }

    for (const p of pipes) drawPipe(p);
    drawGround();
    drawBird();
    if (state === 'playing' || state === 'dead') drawScore(score);
    if (state === 'ready') drawReady();

    // Draw temporary Level Up banner
    if (levelUpTimer > 0) {
      ctx.save();
      ctx.font = 'bold 32px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, levelUpTimer)})`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(31, 41, 51, 0.8)';
      ctx.lineWidth = 5;
      ctx.strokeText(levelUpText, W / 2, H / 2 - 100);
      ctx.fillText(levelUpText, W / 2, H / 2 - 100);
      ctx.restore();
    }
  }

  function drawClouds(color) {
    ctx.fillStyle = color || 'rgba(255,255,255,.55)';
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
    const gapBottom = p.gapTop + p.gap;
    const lip = 18;
    ctx.fillStyle = '#5bbf2e';
    ctx.fillRect(p.x, 0, PIPE_W, p.gapTop);
    ctx.fillRect(p.x, gapBottom, PIPE_W, FLOOR_Y - gapBottom);
    ctx.fillStyle = '#4a9e25';
    ctx.fillRect(p.x - 4, p.gapTop - lip, PIPE_W + 8, lip);
    ctx.fillRect(p.x - 4, gapBottom, PIPE_W + 8, lip);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(p.x + 6, 0, 6, p.gapTop);
    ctx.fillRect(p.x + 6, gapBottom, 6, FLOOR_Y - gapBottom);
  }

  function drawGround() {
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, FLOOR_Y, W, GROUND_H);
    ctx.fillStyle = '#caa45a';
    ctx.fillRect(0, FLOOR_Y, W, 8);
    ctx.fillStyle = '#c2b765';
    const step = 24;
    const off = groundScroll % step;
    for (let x = -off; x < W; x += step) ctx.fillRect(x, FLOOR_Y + 12, 12, 10);
  }

  function drawBird() {
    const angle = Math.max(-0.5, Math.min(1.1, bird.v / 600));
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#f7c948';
    circle(0, 0, BIRD_R);
    ctx.fillStyle = '#f0a500';
    circle(0, BIRD_R - 6, BIRD_R - 4);
    ctx.fillStyle = '#fff3bf';
    ellipse(-3, 2, 8, 5);
    ctx.fillStyle = '#fff';
    circle(6, -5, 5);
    ctx.fillStyle = '#1f2933';
    circle(8, -5, 2.4);
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
    if (pseudo) {
      ctx.font = 'bold 28px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(`Prêt, ${pseudo} ?`, W / 2, H / 2 - 26);
      ctx.font = '500 18px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText('Clique / Espace / tap', W / 2, H / 2 + 6);
      ctx.fillText('pour commencer', W / 2, H / 2 + 30);
    } else {
      ctx.font = 'bold 24px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText('Choisis ton pseudo', W / 2, H / 2 - 16);
      ctx.font = '500 18px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText('en haut à droite ✏️', W / 2, H / 2 + 12);
    }
  }

  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    lastTime = ts;
    if (dt > 0.05) dt = 0.05;
    if (state === 'playing') groundScroll += speedFor(totalScore) * dt;
    update(dt);
    draw(ts);
    requestAnimationFrame(loop);
  }

  // --- Game Over + Leaderboard ----------------------------------------------
  const gameoverEl = document.getElementById('gameover');
  const finalScoreEl = document.getElementById('final-score');
  const saveStatus = document.getElementById('save-status');
  const replayBtn = document.getElementById('replay');
  const scoresEl = document.getElementById('scores');
  const refreshBtn = document.getElementById('refresh');

  function showGameOver(s) {
    finalScoreEl.textContent = s;
    saveStatus.textContent = 'Enregistrement…';
    saveStatus.classList.remove('error');
    gameoverEl.classList.remove('hidden');
  }

  async function saveScore(value) {
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pseudo || 'Anonyme', score: value }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      saveStatus.textContent = `Score ${value} enregistré ✔`;
      saveStatus.classList.remove('error');
      await loadScores();
    } catch (err) {
      saveStatus.textContent = 'Échec de l\'enregistrement — réseau ?';
      saveStatus.classList.add('error');
      console.error('Envoi du score impossible :', err);
    }
  }

  async function loadScores() {
    try {
      const res = await fetch('/api/scores');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      renderScores(await res.json());
    } catch (err) {
      scoresEl.innerHTML = '<li class="error">Classement indisponible</li>';
      console.error('Lecture du classement impossible :', err);
    }
  }

  function renderScores(rows) {
    if (!rows.length) {
      scoresEl.innerHTML = '<li class="empty">Aucun score — sois le premier !</li>';
      return;
    }
    scoresEl.innerHTML = rows
      .map((r) => {
        const me = pseudo && r.name === pseudo ? ' class="me"' : '';
        return `<li${me}><span class="pname">${escapeHtml(r.name)}</span>` +
               `<span class="pscore">${r.score}</span></li>`;
      })
      .join('');
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
      if (document.activeElement === inputEl) return;  // on tape son pseudo
      e.preventDefault();
      flap();
    }
  });
  const resetBtn = document.getElementById('reset-leaderboard');

  async function resetLeaderboard() {
    if (!confirm('Voulez-vous vraiment réinitialiser le classement global à zéro ?')) return;
    try {
      const res = await fetch('/api/scores', { method: 'DELETE' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await loadScores();
    } catch (err) {
      console.error('Réinitialisation du classement impossible :', err);
      alert('Erreur lors de la réinitialisation du classement.');
    }
  }

  replayBtn.addEventListener('click', () => reset());
  refreshBtn.addEventListener('click', () => loadScores());
  resetBtn.addEventListener('click', () => resetLeaderboard());

  // --- Démarrage -------------------------------------------------------------
  loadScores();
  requestAnimationFrame(loop);
})();
