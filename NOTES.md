# Notes du projet : D'Écuyer à Chevalier

Ce fichier permet de reprendre le développement dans n'importe quelle conversation.

## Le jeu
- Jeu 3D vue à la 3e personne, dans le navigateur. Hébergé sur GitHub Pages : https://godsaucisse.github.io/ecuyertochevalier/
- Cadre : royaume de France, automne 1126 (règne de Louis VI). Fief fictif de Montclair.
- Le joueur incarne un jeune écuyer qui doit devenir chevalier.
- Le créateur ne code pas : Claude écrit et envoie le code, le créateur teste et donne ses retours.

## Technique
- Three.js r170, copié dans `lib/` avec ses modules de post-traitement dans `lib/addons/` (aucune dépendance externe, pas d'étape de compilation).
- Direction artistique : inspirée de For Honor, fidèle à 1126. Fin d'après-midi d'automne, soleil bas, brume dorée,
  étalonnage « cinéma » (contraste, ombres froides, lumières chaudes, vignettage, grain), caméra par-dessus l'épaule.
- Qualité graphique : haute sur ordinateur (occlusion ambiante GTAO, ombres 4096, 120 000 brins d'herbe),
  allégée sur mobile. Forçable avec `?qualite=haute` ou `?qualite=basse` dans l'adresse.
- Modules JavaScript dans `src/` :
  - `main.js` : rendu, caméra 3e personne, boucle de jeu, écran titre.
  - `world.js` : terrain, château, village, église, terrain d'entraînement, forêt, collisions.
  - `humanoid.js` : personnages construits en formes simples (joueur et PNJ).
  - `player.js` : déplacements, saut, attaque à l'épée.
  - `npcs.js` : personnages non-joueurs.
  - `quests.js` : histoire, dialogues et objectifs.
  - `input.js` : clavier (AZERTY et QWERTY), souris, commandes tactiles.
  - `ui.js` : interface (quête, dialogues, boussole, messages).
  - `audio.js` : sons générés par le navigateur.
  - `textures.js` : textures générées par le code (pierre, ardoise, chaume, enduit, bois, terre, mailles, gambison, cuir, acier, armoiries).
  - `sky.js` : ciel et carte d'environnement (reflets des métaux).
  - `postfx.js` : post-traitement (GTAO, bloom, étalonnage).
  - `grass.js` : herbe animée par le vent. `particles.js` : poussière et feuilles mortes.
  - `combat.js` : règles du combat (garde en 3 directions, coups légers/lourds, blocage, parade, esquive, endurance) et poses.
  - `duel.js` : duel contre Bertrand (leçons + duel libre), IA, indicateurs de garde, étincelles, ralenti.
  - `save.js` : sauvegarde automatique dans le navigateur (localStorage).

## Combat (inspiré de For Honor)
- Garde vue depuis le combattant : 'L' (sa gauche), 'T' (haut), 'R' (sa droite). Une attaque lancée depuis d arrive sur le côté mirror(d) du défenseur.
- Bloquer : garde du côté de l'indicateur rouge. Parer : coup lourd du même côté dans les 0,32 s avant l'impact (0,5 s pendant la leçon).
- Commandes ordinateur : souris = garde (ou touches 1/2/3), clic gauche/F = léger, clic droit/R = lourd, Espace = esquive.
- Commandes mobile : glisser à droite = garde, ⚔️ léger, 💥 lourd, ↶ esquive.
- Leçons : bloquer ×3, toucher ×3, parer ×1 (passée après 6 essais), puis duel libre. Défaite = on recommence le duel libre.
- Tester en local : `python3 -m http.server` dans le dossier, puis ouvrir http://localhost:8000
- **Avant chaque envoi sur GitHub : lancer `python3 tools/version.py`** (change le numéro de version des fichiers pour que les navigateurs chargent la nouvelle version au lieu de celle en cache).
- Débogage : l'objet `window.game` donne accès au joueur, au monde, aux PNJ et aux quêtes.

## Carte (coordonnées x, z)
- Départ du joueur : (0, 40), au sud du village.
- Château : centre (0, -40), murailles de 36 × 36, porte au sud. Donjon en (0, -47).
- Village : entre z = 15 et z = 50, de part et d'autre du chemin principal (x = 0).
- Église romane : (-20, 6). Puits : (4, 29). Champ : (38, 38).
- Terrain d'entraînement : centre (26, 0), entrée à l'ouest. Quintaine en (27.5, 0).
- Limite du monde : rayon de 90 m.

## Personnages
- Sire Godefroy de Montclair : le seigneur, ancien de la première croisade.
- Bertrand : maître d'armes.
- Mathilde : villageoise.
- Deux gardes à la porte du château (cotte de mailles, casque à nasal, écu, lance).

## Équipements (humanoid.js, option `outfit`)
- `gambeson` : écuyer (gambison matelassé, épée de bois).
- `mail` : homme d'armes (haubert de mailles, camail, casque normand à nasal, écu en amande aux armes de Montclair : d'azur au chevron d'or).
- `lord` : seigneur (tunique longue, manteau rouge à col de fourrure, épée au côté).
- `dress` : villageoise (robe longue, voile).

## Quête (quests.js, étapes)
0 seigneur → 1 Bertrand → 2 quintaine ×5 → 3 retour à Bertrand → 4 duel → 5 raconter au seigneur → 6 fin du chapitre I

## Avancement
- [x] Chapitre I : arrivée, rencontre avec le seigneur, entraînement à la quintaine, duel d'entraînement.
- [x] Combat à la For Honor
- [x] Sauvegarde automatique
- [x] Graphismes « For Honor » : lumière, matériaux, armures
- [ ] Vrais modèles 3D et animations (Mixamo) pour aller plus loin
- [ ] Équitation (chevaux)
- [ ] Combats contre de vrais adversaires (brigands…), plusieurs ennemis
- [ ] Caméra qui évite de traverser les murs
- [ ] Intérieurs des bâtiments
- [ ] Musique d'ambiance
- [ ] Adoubement (fin du jeu)
