# RBZ Live – Enchères de pièces sur TikTok Live

Dashboard créateur (HTML/CSS/JS, sans dépendance). Ouvre `index.html` dans un navigateur.

- **Paramètres TikTok** : compte, minimum de coins, temps de comptage, snipe delay, overlay.
- **Enchère live** : classement des coins par spectateur, chrono, simulation de cadeaux.
- **Mes pièces** / **Historique** / **Tableau de bord** (données en `localStorage`).

## Brancher le vrai chat TikTok
La connexion TikTok est simulée. Pour le réel, lance un petit serveur Node avec
[`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector) qui relaie les
commentaires en WebSocket, puis appelle `window.onTikTokGift(pseudo, valeurEnCoins)` dans `app.js`.
