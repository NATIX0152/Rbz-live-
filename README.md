# RBZ Live – Enchères de pièces sur TikTok Live

Dashboard créateur (HTML/CSS/JS, sans dépendance). Ouvre `index.html` dans un navigateur.

- **Paramètres TikTok** : compte, mot-clé d'offre (`!bid 250`), incrément, durée, anti-sniper, overlay.
- **Enchère live** : chrono, meilleure offre, chat, simulation d'offres.
- **Mes pièces** / **Historique** / **Tableau de bord** (données en `localStorage`).

## Brancher le vrai chat TikTok
La connexion TikTok est simulée. Pour le réel, lance un petit serveur Node avec
[`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector) qui relaie les
commentaires en WebSocket, puis appelle `window.onTikTokComment(pseudo, texte)` dans `app.js`.
