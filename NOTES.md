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
  - `horse.js` : Tonnerre, le cheval (modèle articulé, pas/trot/galop, conduite, cavalier en selle, pointe de lance).
  - `course.js` : parcours de 8 portes à bannières, lice de joute, quintaine de joute, tribune, spectateurs, lance.
  - `layout.js` : emplacements des chapitres II et III (portes, lice, écurie, route de l'abbaye, clairière) ; le décor évite d'y planter des arbres.
  - `battle.js` : combat contre plusieurs ennemis (hérite du duel) ; cible verrouillée, Tab / 🎯 pour changer.
  - `chapter3.js` : route forestière, cheval gris de Sire Godefroy (escorte aller/retour), brigands, embuscade, combat mis en scène du seigneur.
  - `life.js` : forge et forgeron Gautier, villageois qui se promènent (et parlent), poules.
  - `music.js` : musique générée en direct (mode dorien de ré : luth, flûte, bourdon ; en combat : vièle et tambour).
  - `ambience.js` : vent, oiseaux, cloche de l'église. Sons selon la distance : `atDistance()` dans audio.js.
  - `settings.js` : réglages (volumes, sensibilité, qualité). `map.js` : carte du monde (menu pause).

## Combat (version simple, demandée par le créateur)
- Pas de directions. Clic gauche = coup léger, clic droit = coup lourd, Maj (maintenir) = parer, Espace = esquiver, Tab = changer de cible.
- Mobile : ⚔️ léger, 💥 lourd, 🛡 parer (maintenir), ↶ esquive, 🎯 cible.
- Parer bloque tout mais coûte de l'endurance (léger 5, lourd 15) ; à 0 → garde brisée (étourdi). Endurance : remonte deux fois moins vite garde levée.
- Parade parfaite : garde levée moins de 0,3 s avant l'impact (0,5 s pendant la leçon) → l'attaquant est déséquilibré.
- Signal au-dessus des ennemis : « ! » rouge = attaque légère, orange = attaque lourde, 🛡 = il se protège.
- Leçons de Bertrand : parer ×3, toucher ×3 (quand il baisse sa garde), parade parfaite ×1 (passée après 6 essais), puis duel libre.
- Les directions L/T/R restent dans combat.js uniquement pour varier les animations.

## Quête (quests.js, étapes)
Chapitre I : 0 seigneur → 1 Bertrand → 2 quintaine ×5 → 3 retour à Bertrand → 4 duel → 5 raconter au seigneur
Chapitre II « En selle » : 6 Bertrand aux écuries → 7 monter sur Tonnerre → 8 franchir les 8 portes → 9 joute ×3 au galop
→ 10 Bertrand à l'entrée de la lice → 11 rapport au seigneur
Chapitre III « L'embuscade » : 12 Godefroy dans la cour (donne une épée d'acier) → 13 escorte à cheval sur la route
→ 14 embuscade (3 brigands, Godefroy contre un 4e) → 15 dialogue → 16 retour au château → 17 Godefroy dans la cour → 18 fin
(Une sauvegarde à l'étape 14 reprend à l'étape 13.)
Bertrand change de place selon l'étape (QuestManager.placeNPCs).

## Cheval
- Ordinateur : Z/↑ avancer (trot), Maj galop, Q/D tourner, S freiner/reculer, E monter/descendre (à l'arrêt).
- Mobile : joystick (poussé à fond = galop), 💬 monter/descendre.
- Joute : la pointe de lance doit passer à moins de 1,2 m de l'écu, au galop (vitesse > 8).

## Avancement
- [x] Chapitre I : arrivée, rencontre avec le seigneur, entraînement à la quintaine, duel d'entraînement.
- [x] Combat à la For Honor
- [x] Sauvegarde automatique
- [x] Chapitre II : équitation, parcours, joute
- [x] Chapitre III : escorte, embuscade, combat contre plusieurs ennemis
- [x] Musique, ambiance sonore, village vivant
- [x] Menu pause, réglages, carte
- [x] Graphismes « For Honor » : lumière, matériaux, armures
- [ ] Vrais modèles 3D et animations (Mixamo) pour aller plus loin
- [ ] Caméra qui évite de traverser les murs
- [ ] Intérieurs des bâtiments
- [ ] Chapitre IV : qui a renseigné les brigands ? (enquête) puis la cour du comte à la Pentecôte
- [ ] Adoubement (fin du jeu)
