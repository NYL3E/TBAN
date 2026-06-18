// Serveur Flappy TBAN : sert le jeu (fichiers statiques) + l'API du leaderboard.
const path = require('path');
const express = require('express');
const { pool, initDb } = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Healthcheck : utilisé par Coolify ET Uptime Kuma -----------------------
// Renvoie 200 si l'app répond et que la base est joignable, 503 sinon.
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'up', uptime: process.uptime() });
  } catch (err) {
    console.error('[health] Base de données injoignable :', err.message);
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

// --- Lire les 10 meilleurs scores -------------------------------------------
app.get('/api/scores', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT name, score, created_at
         FROM scores
        ORDER BY score DESC, created_at ASC
        LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    console.error('[api] Lecture des scores impossible :', err.message);
    res.status(500).json({ error: 'Lecture des scores impossible' });
  }
});

// --- Enregistrer un score ----------------------------------------------------
app.post('/api/scores', async (req, res) => {
  const name =
    String(req.body?.name ?? '').trim().slice(0, 20) || 'Anonyme';
  const score = Number.parseInt(req.body?.score, 10);

  // Validation simple côté serveur (on ne fait jamais confiance au client).
  if (!Number.isInteger(score) || score < 0 || score > 100000) {
    return res.status(400).json({ error: 'Score invalide' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO scores (name, score)
       VALUES ($1, $2)
       RETURNING id, name, score, created_at`,
      [name, score]
    );
    console.log(`[api] Nouveau score enregistré : ${name} = ${score}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[api] Enregistrement du score impossible :', err.message);
    res.status(500).json({ error: 'Enregistrement impossible' });
  }
});

// --- Réinitialiser le classement (scores vidés) ------------------------------
app.delete('/api/scores', async (_req, res) => {
  try {
    await pool.query('TRUNCATE TABLE scores RESTART IDENTITY;');
    console.log('[api] Classement réinitialisé (scores vidés).');
    res.json({ message: 'Classement réinitialisé avec succès' });
  } catch (err) {
    console.error('[api] Impossible de réinitialiser le classement :', err.message);
    res.status(500).json({ error: 'Impossible de réinitialiser le classement' });
  }
});

// On démarre le serveur tout de suite : le healthcheck répond même pendant
// que la base finit de booter (il signalera "db: down" en attendant).
app.listen(PORT, () => {
  console.log(`[server] Flappy TBAN à l'écoute sur le port ${PORT}`);
});

initDb().catch((err) => {
  console.error(
    '[server] Base toujours injoignable après plusieurs tentatives :',
    err.message
  );
});
