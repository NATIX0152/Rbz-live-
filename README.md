# RBZ Live – Enchères de coins TikTok Live

Site + bot : le serveur (`server.js`) se connecte à ton live TikTok, lit les cadeaux envoyés par les
spectateurs et les ajoute automatiquement au classement de l'enchère (aucun cadeau manuel/faux possible).

## Lancer
```bash
npm install
npm start          # puis ouvre http://localhost:3000
```
1. Passe en live sur TikTok.
2. Paramètres TikTok → entre ton @pseudo → « Se connecter au live ».
3. Enchère live → choisis une pièce → « Démarrer l'enchère ». Les coins envoyés pendant le chrono
   s'additionnent par spectateur (minimum, temps de comptage et snipe delay réglables).

Pour que d'autres personnes y accèdent (ou pour l'utiliser depuis ton téléphone), héberge-le sur un service
Node (Render, Railway, Fly.io…) : commande de démarrage `npm start`.

Cadeaux « à série » (roses…) : comptés une seule fois, à la fin de la série. `DEBUG=1 npm start` affiche
les cadeaux reçus dans la console.

## Clé API Euler Stream (optionnelle, recommandée)
La signature de la connexion passe par Euler Stream. Avec une clé (gratuite sur eulerstream.com), c'est plus fiable,
surtout une fois hébergé. Ne la mets jamais dans le code : définis la variable d'environnement `EULER_API_KEY`
(`EULER_API_KEY=ta_cle npm start`, ou dans les variables de ton hébergeur).

## Déployer sur Render (gratuit)
Le dépôt contient un `render.yaml` : sur https://dashboard.render.com → **New → Blueprint** → choisis ce dépôt
→ **Apply**. (Ou **New → Web Service** avec Build `npm install`, Start `npm start`, plan Free.)
Tu obtiens un lien `https://rbz-live-xxxx.onrender.com` : ouvre-le, entre le @ du live, et c'est parti.
Optionnel : ajoute `EULER_API_KEY` dans l'onglet *Environment*. Le plan gratuit s'endort après ~15 min sans visite :
ouvre le site avant ton live et garde l'onglet ouvert.
