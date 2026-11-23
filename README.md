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
