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
  - `timeofday.js` : jour/nuit (1 h de jeu = 2 min), soleil/lune, couleurs du ciel, nuages, étoiles, torches, fenêtres éclairées, météo (clair, nuageux, brume, pluie). `lockWeather()` pour imposer une météo pendant l'histoire.
  - `chapter5.js` : route de l'est, chevaux de Godefroy (gris) et Bertrand (noir), piège du Borgne (Godefroy et Bertrand battent leur brigand puis viennent aider), cour du comte Thibaut, nobles, serment, adoubement.
  - `economy.js` : deniers, équipement (casque, écu, cotte de mailles, épée d'acier) et boutique de Gautier. `Player.applyEquipment()` change l'apparence et les stats (defenseMul, blockCostMul, damageMul).
  - `interiors.js` : grande salle du donjon (Hersende), église (autel : « Prier »), taverne « À la Pomme d'Or » (Raoul, deux clients). Pièces construites à x = 250, entrée/sortie par fondu ; la caméra reste entre les murs.
  - `chapter4.js` : croix de pierre, buissons, Aymeric l'intendant (le traître), père Anselme, le Borgne, lanterne, rencontre nocturne et filature.

## Combat (version simple, demandée par le créateur)
- Pas de directions. Clic gauche = coup léger, clic droit = coup lourd, E (maintenir, ou Maj) = parer — E par défaut car 5 appuis sur Maj ouvrent les « touches rémanentes » de Windows, Espace = esquiver, Tab = changer de cible.
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
Chapitre IV « Le traître » : 18 Godefroy confie l'enquête → 19 trois témoins (Gautier, père Anselme, Mathilde)
→ 20 se cacher dans les buissons près de la croix (saut à 22 h 30, brume) → 21 rencontre Aymeric / le Borgne
→ 22 filature (repéré si à moins de 13 m quand il se retourne, ou à moins de 3,5 m ; perdu au-delà de 34 m)
→ 23 dénoncer à Godefroy → combat contre Aymeric → saut au petit matin → 24 fin du chapitre IV.
(Une sauvegarde aux étapes 21-22 reprend à l'étape 20.)
Chapitre V « La Pentecôte » : 24 Godefroy annonce le départ → 25 rejoindre Godefroy et Bertrand à cheval devant la porte
→ 26 chevauchée vers l'est, piège du Borgne (Borgne 110 PV + 2 hommes) → fondu « Le lendemain, à la cour du comte… »
→ 27 grande salle du comte (pièce « court » d'interiors.js) : s'agenouiller (E), serment, adoubement, manteau + 100 deniers
→ écran de fin → 28 jeu libre, chevalier de Montclair. (Une sauvegarde à l'étape 26 reprend à l'étape 25.)
Bertrand change de place selon l'étape (QuestManager.placeNPCs).

## Deniers
- Gains : quintaine 10, duel de Bertrand 25, parcours 15, joute 35, embuscade 40, traître 60, revanche contre Bertrand 15 (à volonté, étape 5 ou ≥ 11).
- Prix : casque 40, écu 60, cotte de mailles 120, épée d'acier 80 (offerte par Godefroy au chapitre III).
- Les anciennes sauvegardes sans bourse reçoivent des deniers selon leur étape.
- Dialogues à choix : `ui.showChoice(nom, texte, options, rappel)` (touches 1/2/3 ou clic).

## Cheval
- Ordinateur : Z/↑ avancer (trot), Maj galop, Q/D tourner, S freiner/reculer, E monter/descendre (à l'arrêt).
- Mobile : joystick (poussé à fond = galop), 💬 monter/descendre.
- Joute : la pointe de lance doit passer à moins de 1,2 m de l'écu, au galop (vitesse > 8).

## Activités (activities.js, à partir de l'étape 5)
- Arc (bow.js) : donné par Guillaume l'archer (terrain d'armes, ~(20,6)). B (ou 🏹) = prendre/ranger, clic = tirer. Flèches avec pesanteur, cibles notées 10→1 en (31.84, 1, ±4).
- Concours de tir : 5 flèches depuis l'enclos (x < 25.5) ; ≥ 30 points = 10 deniers (puis 4).
- Chasse (hunt.js) : 6 cerfs dans les bois (52 à 84 m du centre), fuient à 15 m (24 m à cheval), réapparaissent après 90 s. E sur la carcasse = venaison, vendue 8 deniers à Raoul.
- Dés : « Un vieux soldat » à la taverne, mise 5, 3 dés chacun.
- Course : Bertrand (étape ≥ 11, sauf 13-14, 19, 24-27), à cheval, sur les 8 portes ; rival à 9,8 m/s ; 20 deniers (puis 8).
- Quêtes secondaires : poules d'Aude (fermière, (-8.5,27.5), 4 poules, 15 d) ; lettre d'Anselme pour frère Odon (ermitage HERMIT (-70,42), 20 d) ; gibier pour Hersende (2 venaisons, 25 d).
- « ! » / « ? » dorés au-dessus des personnages ; lignes sous l'objectif ; onglet Journal dans la pause ; sauvegarde dans `act`.
- Quand on parle à un PNJ qui n'est pas l'objectif de l'histoire, main.js (talkTo) propose d'abord les options des activités.
- Tutoriel (tutorial.js) : conseils au début d'une nouvelle partie (une seule fois, mémorisé dans localStorage).

## Avancement
- [x] Chapitre I : arrivée, rencontre avec le seigneur, entraînement à la quintaine, duel d'entraînement.
- [x] Combat à la For Honor
- [x] Sauvegarde automatique
- [x] Chapitre II : équitation, parcours, joute
- [x] Chapitre III : escorte, embuscade, combat contre plusieurs ennemis
- [x] Musique, ambiance sonore, village vivant
- [x] Menu pause, réglages, carte
- [x] Jour/nuit et météo
- [x] Chapitre IV : enquête, filature, traître démasqué
- [x] Deniers et équipement (boutique de Gautier)
- [x] Intérieurs : grande salle, église, taverne
- [x] Graphismes « For Honor » : lumière, matériaux, armures
- [ ] Vrais modèles 3D et animations (Mixamo) pour aller plus loin
- [x] Caméra qui évite de traverser les murs (intérieurs : limites de la pièce ; dehors : avoidWalls dans main.js)
- [x] Chapitre V : la Pentecôte, le Borgne capturé, l'adoubement (fin de l'histoire)
- [x] Quêtes secondaires, mini-jeux (tir à l'arc, dés, courses), chasse
- [x] Finitions : bruits de pas, caméra qui évite les murs dehors, tutoriel
