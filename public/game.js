/* Flappy TBAN — moteur de jeu (canvas 2D, sans dépendance).
   - Pseudo défini UNE fois (en haut à droite), mémorisé (localStorage).
   - Difficulté progressive douce avec le score.
   - Score enregistré AUTOMATIQUEMENT en base à chaque partie.
   - Invincibilité : touche I ou bouton, 3 s de bouclier, rechargement 15 s. */
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
  const speedFor = (s) => Math.min(MAX_SPEED, BASE_SPEED + s * 3);
  const gapFor = (s) => Math.max(MIN_GAP, BASE_GAP - s * 1.6);

  // --- Invincibilité ---------------------------------------------------------
  const INVINC_DURATION = 3;   // secondes d'invincibilité
  const INVINC_COOLDOWN = 15;  // secondes de recharge
  let invincTimer = 0;         // temps restant d'invincibilité
  let invincCooldown = 0;      // temps restant avant de pouvoir réutiliser

  const invincBtn = document.getElementById('invinc-btn');

  function activateInvincibility() {
    if (state !== 'playing') return;
    if (invincCooldown > 0) return;
    if (invincTimer > 0) return;
    invincTimer = INVINC_DURATION;
    invincCooldown = INVINC_COOLDOWN;
    updateInvincBtn();
  }

  function updateInvincBtn() {
    if (invincTimer > 0) {
      invincBtn.textContent = '\u{1F6E1}\uFE0F ' + Math.ceil(invincTimer) + 's';
      invincBtn.className = 'btn btn-invinc active';
      invincBtn.disabled = true;
    } else if (invincCooldown > 0) {
      invincBtn.textContent = '\u23F3 ' + Math.ceil(invincCooldown) + 's';
      invincBtn.className = 'btn btn-invinc cooldown';
      invincBtn.disabled = true;
    } else {
      invincBtn.textContent = '\u{1F6E1}\uFE0F Invincible (I)';
      invincBtn.className = 'btn btn-invinc';
      invincBtn.disabled = false;
    }
  }

  // --- État ------------------------------------------------------------------
  let state = 'ready';        // "ready" | "playing" | "dead"
  let bird = { y: H / 2, v: 0 };
  let pipes = [];
  let score = 0;
  let spawnDx = 0;
  let groundScroll = 0;
  let lastTime = 0;

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
    spawnDx = PIPE_SPACING;
    state = 'playing';
    invincTimer = 0;
    invincCooldown = 0;
    updateInvincBtn();
    gameoverEl.classList.add('hidden');
  }

  function spawnPipe() {
    const gap = gapFor(score);
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
    if (state !== 'playing') return;
    const speed = speedFor(score);

    // Décompte invincibilité
    if (invincTimer > 0) {
      invincTimer = Math.max(0, invincTimer - dt);
      updateInvincBtn();
    }
    if (invincCooldown > 0) {
      invincCooldown = Math.max(0, invincCooldown - dt);
      if (invincTimer <= 0) updateInvincBtn();
    }

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
        score++;
      }
    }
    pipes = pipes.filter((p) => p.x + PIPE_W > -10);

    // Collisions ignorées si invincible
    if (invincTimer > 0) return;

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
    showGameOver(score);
    saveScore(score);   // sauvegarde AUTOMATIQUE et obligatoire
  }

  // --- Rendu -----------------------------------------------------------------
  function draw() {
    ctx.fillStyle = '#4ec0ca';
    ctx.fillRect(0, 0, W, H);
    drawClouds();
    for (const p of pipes) drawPipe(p);
    drawGround();
    drawBird();
    if (state === 'playing' || state === 'dead') drawScore(score);
    if (state === 'ready') drawReady();
    if (invincTimer > 0 && state === 'playing') drawInvincOverlay();
  }

  function drawInvincOverlay() {
    const pct = invincTimer / INVINC_DURATION;
    // Teinte violette sur l'écran
    ctx.fillStyle = 'rgba(120, 80, 255, 0.18)';
    ctx.fillRect(0, 0, W, H);
    // Barre de progression en bas
    ctx.fillStyle = 'rgba(120, 80, 255, 0.55)';
    ctx.fillRect(0, FLOOR_Y - 6, W * pct, 6);
    // Texte
    ctx.font = 'bold 17px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#5b2fc9';
    ctx.strokeText('INVINCIBLE \u2014 ' + Math.ceil(invincTimer) + 's', W / 2, 115);
    ctx.fillText('INVINCIBLE \u2014 ' + Math.ceil(invincTimer) + 's', W / 2, 115);
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

    // Halo de bouclier si invincible
    if (invincTimer > 0) {
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 80);
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 22 * pulse;
      ctx.strokeStyle = 'rgba(168, 85, 247, ' + (0.7 * pulse) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

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
    if (state === 'playing') groundScroll += speedFor(score) * dt;
    update(dt);
    draw();
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
    saveStatus.textContent = 'Enregistrement\u2026';
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
      saveStatus.textContent = `Score ${value} enregistré \u2714`;
      saveStatus.classList.remove('error');
      await loadScores();
    } catch (err) {
      saveStatus.textContent = 'Échec de l\'enregistrement \u2014 réseau ?';
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
      scoresEl.innerHTML = '<li class="empty">Aucun score \u2014 sois le premier !</li>';
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
    if (document.activeElement === inputEl) return;  // on tape son pseudo
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      flap();
    }
    if (e.code === 'KeyI') {
      e.preventDefault();
      activateInvincibility();
    }
  });
  replayBtn.addEventListener('click', () => reset());
  refreshBtn.addEventListener('click', () => loadScores());
  invincBtn.addEventListener('click', () => activateInvincibility());

  // --- Démarrage -------------------------------------------------------------
  updateInvincBtn();
  loadScores();
  requestAnimationFrame(loop);
})();
