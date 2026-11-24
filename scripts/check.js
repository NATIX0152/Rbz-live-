// Vérification hors-ligne : charge commandes + événements, valide les définitions slash.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../src');
let n = 0;
const names = new Set();
for (const cat of fs.readdirSync(path.join(root, 'commands'))) {
  for (const f of fs.readdirSync(path.join(root, 'commands', cat))) {
    for (const cmd of [].concat(require(path.join(root, 'commands', cat, f)))) {
      const json = cmd.data.toJSON(); // lève une erreur si la définition est invalide
      if (names.has(json.name)) throw new Error(`Commande en double : ${json.name}`);
      if (typeof cmd.execute !== 'function') throw new Error(`${json.name} sans execute()`);
      names.add(json.name);
      n++;
    }
  }
}
for (const f of fs.readdirSync(path.join(root, 'events'))) {
  const ev = require(path.join(root, 'events', f));
  if (!ev.name || typeof ev.execute !== 'function') throw new Error(`Événement invalide : ${f}`);
}
console.log(`OK : ${n} commandes, ${fs.readdirSync(path.join(root, 'events')).length} fichiers d'événements`);
