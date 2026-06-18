# 🐤 Flappy TBAN — Flappy Bird avec leaderboard en ligne

Projet final du module **« Déployer et exploiter une application web »**
(Bachelor 3 Tech & Business — Chef de Projet Digital).

Groupe **TBAN** : **Lenny TRIDAT**, **Alexis BRUN**, **Raphaël ASSY**, **Seno NGUYEN**.

Un mini-jeu **Flappy Bird** (HTML5 canvas) doublé d'un **leaderboard persistant** :
chaque joueur peut enregistrer son score, qui est stocké dans **PostgreSQL** et
affiché dans un classement « Top 10 ». Ce sont ces scores qui constituent la
**donnée métier** persistée par l'application.

---

## 🧱 Architecture

```
Utilisateur (navigateur)
        ↓ HTTPS
Internet
        ↓
Coolify (reverse-proxy Traefik + Let's Encrypt)
        ↓
Docker
   ├── Conteneur "app"  : Node.js + Express  → sert le jeu + l'API /api/scores
   └── Conteneur "db"   : PostgreSQL 16       → table "scores" (volume persistant)
```

- **Frontend** : `public/` — HTML / CSS / JavaScript vanilla (canvas 2D), aucune dépendance.
- **Backend** : `server/` — Express sert les fichiers statiques **et** l'API REST.
- **Base de données** : PostgreSQL, table `scores (id, name, score, created_at)`.

### API

| Méthode | Route          | Rôle                                            |
|--------:|----------------|-------------------------------------------------|
| `GET`   | `/health`      | Healthcheck (200 si app + DB OK, 503 sinon)     |
| `GET`   | `/api/scores`  | Renvoie les 10 meilleurs scores (JSON)          |
| `POST`  | `/api/scores`  | Enregistre un score `{ "name": "...", "score": 42 }` |

---

## ▶️ Lancer en local

### Option 1 — Docker Compose (recommandé, identique à la prod)

```bash
cp .env.example .env        # adapter le mot de passe si besoin
docker compose up --build
# Jeu disponible sur http://localhost:3000
```

La donnée est conservée dans le volume `db_data` entre deux redémarrages.

### Option 2 — Node en local (nécessite un PostgreSQL accessible)

```bash
npm install
export DATABASE_URL="postgres://flappy:flappy@localhost:5432/flappy"
npm start
# http://localhost:3000
```

> Sans base joignable, le serveur démarre quand même : `/health` répond `503`
> (`db: down`) et retente la connexion automatiquement. Pratique pour démontrer
> le monitoring.

---

## 🚀 Déploiement sur Coolify (runbook)

> Pré-requis : le code est poussé sur un dépôt **GitHub public**.

1. **Connexion** à Coolify : `https://coolify.planbadge.fr`.
2. **New Resource → Docker Compose** (ou *Public/Private Repository*), puis
   sélectionner le dépôt GitHub `flappy-tban` (branche `main`).
3. Coolify détecte le `docker-compose.yml` (services **app** + **db**).
4. **Environment Variables** : renseigner
   `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` et
   `DATABASE_URL=postgres://<user>:<password>@db:5432/<db>`.
5. **Domains** : associer le domaine public (ex. `lenny.planbadge.fr`) au
   service **app**, port **3000**. Activer **HTTPS / Let's Encrypt**.
6. **Healthcheck** (onglet de l'app) : Path `/health`, Port `3000`, statut
   attendu `200`.
7. **Deploy**. Vérifier dans les **Logs** que le conteneur passe en
   `running:healthy` et que l'on voit `Table "scores" prête`.
8. Ouvrir l'URL publique, jouer, enregistrer un score → il apparaît dans le Top 10.

### Persistance du volume

Le service `db` monte le volume `db_data` sur `/var/lib/postgresql/data`.
Ne **pas** supprimer ce volume lors d'un redéploiement, sinon les scores sont perdus.

---

## 📈 Supervision

- **Healthcheck Coolify** : interroge `/health` (vérifie aussi la base).
- **Uptime Kuma** (`https://monitoring.planbadge.fr`) : monitor HTTP(s) externe
  sur l'URL publique, intervalle 60 s, alerte si le service tombe.
- **Healthcheck Docker** intégré dans le `Dockerfile` et le `docker-compose.yml`.

## 🪵 Logs

Consultables dans **Coolify → application → onglet Logs**. Exemples de lignes utiles :

```
[server] Flappy TBAN à l'écoute sur le port 3000
[db] Connecté à PostgreSQL — table "scores" prête.
[api] Nouveau score enregistré : Lenny = 27
[health] Base de données injoignable : ...   (si la DB tombe)
```

## 💾 Sauvegardes (règle 3-2-1)

- **Code** : GitHub (hors-site) + clones locaux des membres.
- **Base de données** : dump régulier via

  ```bash
  docker compose exec db pg_dump -U flappy flappy > backup_$(date +%F).sql
  ```

  À conserver sur 2 supports différents + 1 copie hors-site (voir le rapport).

---

## 📁 Structure

```
flappy-tban/
├── public/            # le jeu (front)
│   ├── index.html
│   ├── style.css
│   └── game.js
├── server/            # le backend
│   ├── server.js      # routes Express + API
│   └── db.js          # connexion PostgreSQL + table
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🤝 Contributeurs

| Identité étudiant | Pseudo GitHub        |
|-------------------|----------------------|
| Lenny TRIDAT      | _à compléter_        |
| Alexis BRUN       | _à compléter_        |
| Raphaël ASSY      | _à compléter_        |
| Seno NGUYEN       | _à compléter_        |
