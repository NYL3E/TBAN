// Connexion PostgreSQL + initialisation de la table métier (les scores).
// La création de table est idempotente : l'app peut redémarrer sans risque.
const { Pool } = require('pg');

// On accepte soit une URL complète (DATABASE_URL), soit des variables séparées.
// En docker-compose, l'hôte de la base est "db" (le nom du service).
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'db',
        port: Number(process.env.PGPORT) || 5432,
        user: process.env.PGUSER || 'flappy',
        password: process.env.PGPASSWORD || 'flappy',
        database: process.env.PGDATABASE || 'flappy',
      }
);

// La base met quelques secondes à démarrer (surtout au premier déploiement).
// On retente donc plusieurs fois avant d'abandonner.
async function initDb(retries = 15, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scores (
          id         SERIAL PRIMARY KEY,
          name       VARCHAR(20)  NOT NULL,
          score      INTEGER      NOT NULL CHECK (score >= 0),
          created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
      `);
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC);'
      );
      console.log('[db] Connecté à PostgreSQL — table "scores" prête.');
      return;
    } catch (err) {
      console.error(
        `[db] Tentative ${attempt}/${retries} échouée : ${err.message}`
      );
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = { pool, initDb };
