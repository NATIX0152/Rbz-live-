# Résumé pour reprendre le projet

## Objectif
Site d'enchères avec les pièces TikTok : timer, compteur de pièces, classement, menus, et un bot qui lit le live TikTok et compte chaque cadeau.

## Où est le code
- Dépôt : https://github.com/NATIX0152/Rbz-live-
- Branche du site : `claude/affectionate-turing-ugm2kj` (la branche `main` ne contient que l'ancien README.md).

## Contenu
- `server.js` : serveur Express + WebSocket, état de l'enchère, timer, anti-snipe, bot (`tiktok-live-connector` v2 : `TikTokLiveConnection`, `WebcastEvent.GIFT` / `CHAT`). Un cadeau = diamantCount × repeatCount ; les combos ne sont comptés qu'à la fin (`repeatEnd`) ; seuls les cadeaux reçus pendant que l'enchère est « running » comptent, au-dessus de la mise minimum.
- `public/index.html`, `app.js`, `style.css` : tableau de bord (menus : Enchère, Réglages, Bot TikTok, Historique & chat, Overlay OBS). Timer + classement en haut, boutons de contrôle (Démarrer/Pause/Reset/±temps) dans une carte séparée en bas.
- `public/overlay.html` : overlay OBS (`/overlay.html`).
- Lancement : `npm install` puis `npm start` → http://localhost:3000.

## État
- Testé en local avec des cadeaux simulés (OK). Bot jamais testé sur un vrai live.
- Déploiement Render en cours, échec constaté : le service construisait `main` (commit 034a03a) et cherchait `package.json` dans `src/`.
  À régler dans Render : Branch = `claude/affectionate-turing-ugm2kj`, Root Directory vide, Language = Node, Build = `npm install`, Start = `npm start`, plan Free.
- Un autre service Render (« Rbz-live--1 ») construisait un commit `079d376` qui n'est pas dans ce dépôt.

## À faire ensuite (au choix de l'utilisateur)
- Mettre le site sur `main` (pull request) ou dans un autre dépôt.
- Finir le déploiement Render et tester le bot sur un vrai live.
