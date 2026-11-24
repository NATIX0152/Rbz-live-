# Rbz-live — Bot de modération Discord

Bot de modération en **discord.js v14** (commandes slash) avec :

- 🛡️ **Anti-raid** : détection d'arrivées massives, mode raid, lockdown automatique, filtre d'âge de compte / sans avatar
- 🤖 **Anti-bot** : tout bot ajouté par un non-autorisé est expulsé, et son auteur sanctionné
- ☢️ **Antinuke** : limites sur suppression/création de salons & rôles, bans, kicks, webhooks, permissions dangereuses — sanction de l'auteur **et annulation** des dégâts
- 🤖 **Automod** : anti-liens, anti-invitations, anti-spam, anti-mentions de masse
- 🔨 Commandes de modération complètes, logs, whitelist

## Installation

```bash
npm install
cp .env.example .env     # puis remplis DISCORD_TOKEN (et GUILD_ID pour un test rapide)
npm start
```

Dans le [Developer Portal](https://discord.com/developers/applications) > Bot, active les **intents privilégiés** :
`SERVER MEMBERS INTENT` et `MESSAGE CONTENT INTENT`.
Invite le bot avec les scopes `bot` + `applications.commands` et la permission **Administrateur**.

> ⚠️ **Place le rôle du bot tout en haut** de la hiérarchie : il ne peut sanctionner (ban, derank, restauration…) que des membres/rôles situés sous lui.
> Il a aussi besoin de « Voir les logs du serveur » pour identifier les auteurs (antinuke / anti-bot).

## Commandes

| Catégorie | Commandes |
|---|---|
| Modération | `/ban` `/unban` `/kick` `/softban` `/mute` `/unmute` `/warn` `/warnings` `/clearwarns` `/nick` `/role add\|remove` |
| Salons | `/clear` `/clearbots` `/slowmode` `/lock` `/unlock` |
| Sécurité | `/antiraid` `/antibot` `/antinuke` `/whitelist` `/automod` `/lockdown` `/setlogs` |
| Utilitaires | `/help` `/ping` `/userinfo` `/serverinfo` `/avatar` |

Avertissements : **3** → mute 1 h automatique, **5** → expulsion (modifiable dans `src/config.js`).

## Configurer la sécurité (conseillé)

```
/setlogs channel:#logs
/antiraid config threshold:5 seconds:10 action:kick min_account_age:3 duration:10
/antiraid enable
/antibot enable
/antinuke enable            (propriétaire uniquement)
/antinuke punishment type:ban
/whitelist add user:@admin-de-confiance
/automod set rule:antispam enabled:true
```

- **Exemptés** de toutes les protections : propriétaire du serveur, le bot, et les membres de `/whitelist`.
- **Antinuke** : une action est sanctionnée quand son nombre dans la fenêtre (10 s par défaut) **dépasse** la limite (`/antinuke status` pour voir les valeurs). Toutes les actions de la fenêtre sont annulées : salons/rôles recréés, créations supprimées, bans levés, permissions dangereuses retirées. Les expulsions ne sont pas annulables.
- Les alertes critiques (raid, antinuke, anti-bot) sont aussi envoyées en MP au propriétaire.
- `/antinuke`, `/whitelist` : réservés au **propriétaire** (empêche un admin compromis de se whitelister).

## Structure

```
index.js              chargement, intents, connexion
src/commands/*        commandes slash (une catégorie par dossier)
src/events/*          événements Discord (+ automod, antinuke)
src/modules/*         antiraid.js, antibot.js, antinuke.js
src/utils/*           base JSON (data/db.json), logs, audit, sanctions, lockdown
scripts/check.js      `npm run check` : valide toutes les commandes hors-ligne
```

Les données sont stockées dans `data/db.json` (ignoré par git).
