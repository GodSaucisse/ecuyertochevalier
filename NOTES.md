# Notes du projet : D'Écuyer à Chevalier

Ce fichier permet de reprendre le développement dans n'importe quelle conversation.

## Le jeu
- Jeu 3D vue à la 3e personne, dans le navigateur. Hébergé sur GitHub Pages : https://godsaucisse.github.io/ecuyertochevalier/
- Cadre : royaume de France, automne 1126 (règne de Louis VI). Fief fictif de Montclair.
- Le joueur incarne un jeune écuyer qui doit devenir chevalier.
- Le créateur ne code pas : Claude écrit et envoie le code, le créateur teste et donne ses retours.

## Technique
- Three.js r170, copié dans `lib/` (aucune dépendance externe, pas d'étape de compilation).
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
- Tester en local : `python3 -m http.server` dans le dossier, puis ouvrir http://localhost:8000
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

## Avancement
- [x] Chapitre I : arrivée, rencontre avec le seigneur, entraînement à la quintaine.
- [ ] Sauvegarde de la progression
- [ ] Équitation (chevaux)
- [ ] Combats contre des adversaires
- [ ] Caméra qui évite de traverser les murs
- [ ] Intérieurs des bâtiments
- [ ] Musique d'ambiance
- [ ] Adoubement (fin du jeu)
