# Suivi Coach ↔ Athlète — prototype fonctionnel

**Version 4.0** — déployable en ligne (Vercel + Turso + Vercel Blob), pour un accès depuis
n'importe où sans dépendre d'un Mac allumé. En plus de tout ce qui précède : décompte des
objectifs (priorité A/B/C façon préparateur physique), photo de
profil, et messagerie coach↔athlète, en plus de tout ce qui précède : installation mobile en PWA,
page d'accueil de l'athlète centrée sur le jour actuel avec **check-in de forme quotidien**
(calcul scientifiquement fondé, indice de Hooper & Mackinnon), authentification par rôle,
invitation coach↔athlète, calendrier multi-sport, séances avec musculation détaillée en séries
individuelles (façon Strong/Hevy), profil physiologique historisé, cycle menstruel partagé sur
consentement (profils féminins), résilience Garmin/Strava, bibliothèque de ressources liée aux
exercices, notifications in-app, sécurité des comptes et RGPD. Détail complet ci-dessous.

Ce projet est une implémentation du MVP décrit dans le prompt produit (auth par rôle,
invitation coach→athlète, calendrier, création de séance multi-sport avec musculation
en blocs, retour athlète, commentaires, profil athlète avec historique).

## Ouvrir l'application sur votre MacBook

1. Décompressez le fichier `coach-athlete-app.zip` (double-clic dessus dans le Finder).
2. Dans le dossier obtenu, double-cliquez sur **« Lancer l'application.command »**.
3. **Première fois seulement** : macOS bloque par défaut les scripts qui ne viennent pas de l'App Store.
   Si une fenêtre dit *"Impossible d'ouvrir... l'éditeur ne peut être vérifié"* :
   - Faites **clic droit (ou Ctrl+clic)** sur « Lancer l'application.command » → **Ouvrir**
   - Une fenêtre s'affiche avec un bouton **Ouvrir** — cliquez dessus (à faire une seule fois)
4. Une fenêtre de Terminal s'ouvre : au premier lancement elle installe les dépendances
   (1 à 2 minutes), puis démarre l'application et ouvre votre navigateur automatiquement sur
   http://localhost:3000. Elle prépare aussi un **lien public temporaire** (quelques secondes,
   via cloudflared) affiché en gros dans le Terminal — c'est ce lien qu'il faut ouvrir sur
   votre téléphone (voir section dédiée ci-dessous).
5. Pour arrêter l'application, fermez la fenêtre de Terminal (ou Ctrl+C dedans).

**Prérequis** : Node.js doit être installé sur votre Mac (gratuit, depuis
[nodejs.org](https://nodejs.org), choisir la version "LTS"). Le script vous le signale s'il manque.

Les fois suivantes, double-cliquer sur « Lancer l'application.command » suffit — pas besoin de
réinstaller quoi que ce soit, ni de repasser par le clic droit.

### Si macOS ne propose que "Mettre à la corbeille" (pas de bouton "Ouvrir")

Sur les versions récentes de macOS, le clic droit → Ouvrir ne suffit parfois plus. Deux solutions
fiables, à faire une seule fois :

**Option A — via le Terminal (la plus simple)**
1. Ouvrez l'app **Terminal** (Cmd+Espace, tapez "Terminal", Entrée)
2. Tapez `bash ` (avec un espace après), sans appuyer sur Entrée
3. Glissez-déposez le fichier « Lancer l'application.command » depuis le Finder dans la fenêtre du Terminal — son chemin s'ajoute automatiquement
4. Appuyez sur Entrée

**Option B — lever le blocage définitivement**
1. Ouvrez le Terminal (Cmd+Espace, "Terminal", Entrée)
2. Tapez `xattr -cr ` (avec un espace après), sans appuyer sur Entrée
3. Glissez-déposez le **dossier** `coach-athlete-app` (pas le fichier) dans la fenêtre du Terminal
4. Appuyez sur Entrée — ensuite, le double-clic sur « Lancer l'application.command » fonctionnera normalement

### Si le téléphone n'arrive pas à ouvrir l'adresse ("Safari ne peut pas ouvrir la page")

Dans l'ordre du plus fréquent au moins fréquent :

1. **Le téléphone n'est pas vraiment sur le Wi-Fi du Mac.** Sur iPhone : Réglages → Wi-Fi, vérifiez
   le réseau connecté. Désactivez temporairement les données mobiles (4G/5G) pour être sûr que la
   connexion passe par le Wi-Fi et pas par le réseau cellulaire.
2. **Le pare-feu du Mac bloque les connexions entrantes.** Réglages Système → Réseau → Pare-feu.
   S'il est activé, macOS doit demander d'autoriser Node à recevoir des connexions au premier
   lancement — vérifiez que cette autorisation n'a pas été refusée par erreur.
3. **Le Wi-Fi isole les appareils entre eux ("isolation client"/"AP isolation").** Fréquent sur les
   réseaux "Invités". Reconnectez le téléphone au réseau Wi-Fi principal plutôt qu'à un réseau
   invité.
4. **Trouver l'adresse manuellement** si le script ne l'affiche pas : dans le Terminal, tapez
   `ipconfig getifaddr en0` (ou `en1` si `en0` ne renvoie rien) pour obtenir l'adresse IP du Mac
   sur le Wi-Fi, puis ouvrez `http://CETTE_ADRESSE:3000` sur le téléphone.
5. Si rien ne fonctionne, testez d'abord l'adresse affichée **depuis le navigateur du Mac
   lui-même** (pas localhost, l'adresse réseau) : si ça ne marche pas non plus depuis le Mac,
   le problème vient du pare-feu (point 2), pas du téléphone.

## Démarrer en local

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3000. Créez d'abord un compte **coach**, générez un lien
d'invitation depuis son tableau de bord, puis ouvrez ce lien dans une autre session
(navigation privée) pour créer le compte **athlète** lié.

## Déploiement en ligne (Vercel + Turso) — V4

Depuis la V4, l'application est réellement déployable en ligne : la base de données et le
stockage de fichiers basculent automatiquement vers des services hébergés dès que les bonnes
variables d'environnement sont présentes (rien à changer dans le code). En local, sans ces
variables, tout continue de fonctionner exactement comme avant (SQLite + disque local, zéro
configuration).

### Pourquoi c'était nécessaire

Un déploiement Vercel exécute le code dans des fonctions serverless : le système de fichiers y
est éphémère (tout ce qui est écrit disparaît à la requête suivante) et il n'y a pas de
processus persistant pour héberger un fichier SQLite local. Il fallait donc une vraie base de
données accessible par le réseau, et un vrai stockage de fichiers en ligne pour les
photos/vidéos.

### Étape 1 — Créer la base de données (Turso, gratuit)

Turso héberge une base SQLite distante — même langage SQL que ce prototype utilise déjà en
local, donc aucune réécriture de requête n'a été nécessaire pour la migration.

1. Créez un compte sur [turso.tech](https://turso.tech) (gratuit, pas de carte bancaire requise
   pour le tier gratuit)
2. Installez leur outil en ligne de commande et connectez-vous :
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   ```
3. Créez la base :
   ```bash
   turso db create suivi-coach-athlete
   ```
4. Récupérez l'URL de connexion et générez un jeton d'accès :
   ```bash
   turso db show suivi-coach-athlete --url
   turso db tokens create suivi-coach-athlete
   ```
   Notez les deux valeurs affichées — elles deviendront `TURSO_DATABASE_URL` et
   `TURSO_AUTH_TOKEN`.

### Étape 2 — Déployer sur Vercel (gratuit)

1. Créez un compte sur [vercel.com](https://vercel.com) (l'inscription avec un compte GitHub
   est la plus simple)
2. Poussez ce projet sur un dépôt GitHub (créez-en un vide sur GitHub, puis depuis le dossier du
   projet : `git init && git add . && git commit -m "Premier déploiement" && git remote add
   origin <URL-de-votre-dépôt> && git push -u origin main`)
3. Sur Vercel, cliquez "Add New Project", choisissez ce dépôt, laissez les réglages par défaut
   (Vercel détecte Next.js automatiquement) et cliquez "Deploy"

### Étape 3 — Configurer les variables d'environnement

Sur Vercel : Project Settings → Environment Variables, ajoutez :
- `TURSO_DATABASE_URL` → la valeur récupérée à l'étape 1
- `TURSO_AUTH_TOKEN` → la valeur récupérée à l'étape 1

Pour le stockage de fichiers (photos, vidéos, avatars) :
1. Sur Vercel : Storage → Create Database → **Blob**, créez un store (gratuit jusqu'à 1 Go)
2. Vercel ajoute automatiquement la variable `BLOB_READ_WRITE_TOKEN` au projet — rien à faire
   de plus

Redéployez ensuite (Vercel le fait automatiquement à chaque `git push`, ou via le bouton
"Redeploy" dans l'interface).

### Résultat

Une vraie adresse `https://votre-projet.vercel.app`, accessible depuis n'importe où (Wi-Fi,
4G/5G, peu importe l'appareil), sans dépendre d'un Mac allumé. Elle s'installe sur l'écran
d'accueil d'un téléphone exactement comme décrit dans la section PWA ci-dessous — c'est la
version la plus proche d'une "vraie application" atteignable sans passer par l'App Store/Play
Store (qui demandent un compte développeur et une revue, hors de portée de ce prototype — voir
plus bas).

### Développer en local après cette migration

Rien ne change : `npm install && npm run dev` fonctionne toujours sans aucune variable
d'environnement (base SQLite locale, fichiers sur disque). Les variables `TURSO_DATABASE_URL`
et `BLOB_READ_WRITE_TOKEN` ne doivent être définies que sur Vercel — les laisser vides en local
active automatiquement le mode local.

## Choix techniques de ce prototype (différents de la stack cible du prompt, à dessein)

- **Base de données : SQLite en local / Turso en production** (`src/lib/db.ts`, client libSQL) —
  plus une note "à porter vers Postgres" comme avant : depuis la V4, ce même code est réellement
  déployé via Turso (base SQLite hébergée, dialecte identique), voir section "Déploiement en
  ligne" ci-dessus. Choisi plutôt que Postgres pour minimiser la réécriture de requêtes lors de
  la migration (même langage SQL des deux côtés).
- **Stockage de fichiers : disque local en dev / Vercel Blob en production** (`src/lib/storage.ts`),
  bascule automatique selon la présence de `BLOB_READ_WRITE_TOKEN`.
- **Polices système au lieu de Google Fonts** : l'environnement où ce prototype a été
  généré n'a pas d'accès réseau à `fonts.googleapis.com`. Les polices prévues dans la
  direction visuelle (Fraunces + Public Sans) sont documentées dans
  `src/app/globals.css` ; il suffit de réintroduire `next/font/google` en déploiement
  réel (Vercel a l'accès réseau nécessaire) pour les récupérer.
- **Server Actions Next.js** plutôt que des routes API séparées, pour rester
  compact — comportement identique côté utilisateur.

## Ce qui est implémenté (MVP + différenciateurs prioritaires du prompt)

- Authentification par rôle, sessions httpOnly, mots de passe hachés (bcrypt)
- Flux d'invitation coach → athlète (lien à token), révocation d'accès dans les deux sens
- Permission stricte : un coach ne voit que ses athlètes activement liés (testé, voir `scripts/e2e-check.ts`)
- Calendrier athlète en vue semaine, avec filtres par sport et par catégorie
- Création de séance adaptée au sport ; pour la musculation, un constructeur en blocs
  (échauffement mobilité/plyo/proprio → principal/secondaire/complémentaire/spécifique → gainage → retour au calme)
- Retour athlète (statut, RPE, ressenti) avec statut "non réalisée" en gris neutre (pas de rouge culpabilisant)
- Fil de commentaires par séance
- Profil athlète : mesures historisées, blessures, journal de bord, indicateur de complétion (onboarding progressif)
- **Cycle menstruel partagé** (différenciateur produit prioritaire, cf. étude de marché) : saisie par
  l'athlète, estimation de phase, **partage désactivé par défaut** avec consentement explicite et séparé
  pour l'activer ; côté coach, seule la phase estimée est visible (jamais le détail des entrées), et
  seulement si l'athlète a explicitement activé le partage
- **Sécurité des comptes** : réinitialisation de mot de passe par lien à expiration courte et usage unique,
  déconnexion à distance de toutes les sessions actives, changement de mot de passe invalidant les
  sessions existantes
- **RGPD** : export self-service (JSON complet + résumé texte lisible) depuis `/settings`, suppression de
  compte en libre-service avec effacement en cascade de toutes les données associées, consentement CGU
  séparé et horodaté à l'inscription
- Page légale (`/legal`) — squelette à faire valider par un juriste avant tout lancement réel
- **Résilience Garmin/Strava** (cf. prompt, risque de dépendance à un fournisseur unique) : statut de
  connexion toujours visible et honnête (jamais de faux "connecté"), affiché par fournisseur avec message
  d'erreur explicite si les identifiants d'API ne sont pas configurés ; **import manuel** d'activité
  (date, sport, durée, distance, FC moyenne) fonctionnel dès maintenant comme filet de sécurité
  indépendant de toute API tierce
- **Bibliothèque de ressources** (cf. demande explicite : "je veux pouvoir la remplir moi-même") — page
  `/coach/resources` : upload réel de vidéos et photos (stockage sur disque, `data/uploads/`), fiches
  matériel avec ou sans photo, suppression, filtrage par type. Chaque coach ne voit et ne gère que sa
  propre bibliothèque ; les fichiers sont servis via une route qui vérifie la permission (coach
  propriétaire ou l'un de ses athlètes actifs), jamais accessibles publiquement par URL directe.
- **Lien exercice ↔ bibliothèque** : en construisant une séance de musculation, chaque exercice peut être
  associé à une vidéo ou une photo de la bibliothèque du coach (menu déroulant dans le constructeur de
  blocs). L'aperçu (lecteur vidéo ou image) s'affiche directement sur la fiche de la séance, pour le coach
  comme pour l'athlète. Un exercice ne peut jamais être lié à la ressource d'un autre coach — vérifié côté
  serveur, pas seulement dans le formulaire.

## Brancher le vrai OAuth2 Garmin/Strava (au-delà de ce prototype)

La structure de données (`external_connections`, `imported_activities`) et l'action
`connectProviderAction` sont prêtes à recevoir le vrai flux. Il manque : obtenir des
identifiants développeur auprès de Garmin (Garmin Connect Developer Program) et de Strava
(Strava API), les configurer en variables d'environnement (`GARMIN_CLIENT_ID`,
`STRAVA_CLIENT_ID` + secrets), puis implémenter les routes `/api/oauth/garmin/start` et
`/api/oauth/strava/start` (redirection vers le fournisseur, callback qui échange le code
contre un token, stockage chiffré du token). Tant que ces identifiants ne sont pas
configurés, l'app l'indique clairement plutôt que de simuler une connexion.

## Ce qui n'est volontairement PAS implémenté (post-MVP selon le prompt)

- Synchronisation Garmin/Strava (OAuth2 réel — la structure de résilience est en place, voir plus bas)
- **Canal email/push** pour les notifications (voir ci-dessous — les notifications elles-mêmes sont
  fonctionnelles, seul le relais par email/push vers l'extérieur nécessiterait un service tiers)
- PWA hors-ligne
- 2FA (TOTP)
- Résumé RGPD au format PDF (le résumé texte actuel contient les mêmes informations)
- Tests automatisés complets sous un vrai framework (Jest/Vitest) — un script de vérification de bout en
  bout existe et couvre la logique métier + les points critiques de sécurité :
  `npx tsx scripts/e2e-check.ts`

## V3 — décompte des objectifs, photo de profil, messagerie

**Décompte des objectifs**, inspiré des meilleures apps de coaching (TrainingPeaks, Nolio,
RunMotion affichent toutes un compte à rebours vers l'échéance principale) et pensé du point
de vue d'un préparateur physique :
- Chaque objectif/événement peut recevoir une **priorité A/B/C**, la convention standard en
  préparation physique (popularisée par TrainingPeaks/Joe Friel) : A = objectif principal de la
  saison (celui autour duquel se planifie l'affûtage), B = objectif secondaire, C = sortie de
  calage/test. Un préparateur physique ne traite jamais toutes les échéances à égalité — ce champ
  permet cette hiérarchisation dès la création de la séance.
- Une section **"Prochains objectifs"** avec décompte ("J-12", "Demain", "Aujourd'hui") et urgence
  visuelle croissante, visible côté athlète (page d'accueil) et côté coach (fiche de chaque
  athlète, pour repérer en un coup d'œil qui a une échéance qui approche parmi plusieurs athlètes
  suivis).

**Photo de profil** — l'athlète peut ajouter/changer/retirer sa photo depuis son profil (upload
réel, stockage identique à la bibliothèque de ressources). Visible : dans son propre profil, dans
la barre de navigation, et côté coach dans la liste de ses athlètes et sur la fiche de chacun.
Route de service dédiée (`/api/avatar/[userId]`) qui vérifie la permission avant de servir le
fichier — jamais accessible à un tiers même avec l'URL en main. Une image par défaut (initiale
sur fond de couleur) s'affiche tant qu'aucune photo n'est ajoutée.

**Messagerie coach ↔ athlète** — discussion libre, indépendante du fil de commentaires attaché à
chaque séance (qui reste utile pour discuter d'une séance précise). Accessible via le bouton
"💬 Discuter" sur la fiche athlète (coach) et à côté de chaque coach dans "Mes coachs" (athlète).
Chaque nouveau message déclenche une notification in-app. Rafraîchissement automatique léger
(toutes les 15 secondes) pendant que la conversation est ouverte, pour une impression de
discussion vivante — pas un vrai temps réel (websockets), hors de portée de ce prototype.

## Installer l'application sur votre téléphone (V2.3, mise à jour V3.1)

L'app est une PWA (Progressive Web App) installable, avec sa propre icône sur l'écran
d'accueil — mais elle reste servie par votre Mac (ce n'est pas une application téléchargeable
depuis l'App Store/Play Store, voir plus loin pourquoi). Deux méthodes pour y accéder depuis
le téléphone :

### Méthode recommandée : le lien public temporaire

Depuis la V3.1, « Lancer l'application.command » crée automatiquement un **lien public**
(`https://....trycloudflare.com`) via un tunnel cloudflared — sans compte, sans inscription.
C'est la méthode à privilégier : elle évite tous les problèmes classiques de réseau local
(pare-feu du Mac, proxy, isolation Wi-Fi entre appareils, réseaux "Invités"...) puisque le
téléphone se connecte à une vraie adresse internet plutôt qu'au Mac directement. Fonctionne
aussi bien en Wi-Fi qu'en 4G/5G, depuis n'importe où.

1. Lancez l'application (« Lancer l'application.command »)
2. Repérez l'encadré avec le lien `https://....trycloudflare.com` dans le Terminal
   (il est aussi copié automatiquement dans le presse-papier du Mac)
3. Envoyez-vous ce lien (Messages, AirDrop, email...) et ouvrez-le sur le téléphone
4. **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil »
   **Android (Chrome)** : menu ⋮ → « Ajouter à l'écran d'accueil »

**À savoir** : ce lien change à chaque redémarrage de l'application (adresse aléatoire à
chaque lancement) — il faudra refaire les étapes 2-3 si vous relancez le Mac ou l'app.

### Méthode de secours : réseau local

Si le lien public ne peut pas être créé (pas de connexion internet sur le Mac), une adresse
locale (`http://192.168.x.x:3000`) s'affiche aussi dans le Terminal. Elle ne fonctionne que si
le téléphone est sur le **même Wi-Fi** que le Mac, et peut être bloquée par le pare-feu du Mac,
un proxy, ou une isolation réseau — voir la section dépannage plus haut si ça ne passe pas.

Dans les deux cas, une fois ouverte sur le téléphone, l'app s'installe et s'ouvre en plein
écran, sans barre d'adresse — comme une app installée normalement.

**Limite assumée** : ce n'est pas un vrai mode hors-ligne — le Mac doit rester allumé et
l'application lancée pendant toute l'utilisation, puisque les données (base SQLite) vivent sur
l'ordinateur. Un vrai fonctionnement mobile indépendant (accessible même Mac éteint,
installable depuis l'App Store) nécessiterait un hébergement en ligne permanent — une
migration plus lourde (base de données et stockage de fichiers hébergés) que je peux préparer
sur demande, mais qui n'a pas été faite dans cette version.

## V2.2 — corrections et améliorations

**Correction critique : upload de fichiers vers la bibliothèque.** La limite par défaut des
Server Actions Next.js (1 Mo) bloquait silencieusement l'envoi de toute vraie photo ou vidéo —
seuls les tout petits fichiers de test passaient. Relevée à 55 Mo dans `next.config.ts`, alignée
sur la limite réelle d'upload (50 Mo, `src/lib/storage.ts`). C'est le type de bug qui n'apparaît
qu'avec un vrai fichier, jamais avec les fichiers de quelques octets utilisés dans les tests
automatisés — à garder en tête pour la suite.

**Forme du jour : calcul scientifiquement fondé.** Le score n'est plus une moyenne maison : il
suit le principe du questionnaire de bien-être de **Hooper & Mackinnon (1995)**, une référence
en sciences du sport pour le suivi de charge d'entraînement, étendue à 5 items sur une échelle
de 1 à 10 (le questionnaire original en utilise 4, sur 1 à 7). Une revue systématique plus
récente (Saw, Main & Gastin, *British Journal of Sports Medicine*, 2016) confirme que ces
mesures auto-rapportées simples sont au moins aussi sensibles que des mesures physiologiques
objectives pour détecter la fatigue. L'indice de Hooper brut (5 à 50, plus bas = meilleur état)
est affiché à côté du score sur 10 pour la traçabilité de la méthode — voir
`src/lib/checkin-types.ts`.

**Constructeur de séances de musculation, inspiré des meilleures apps du marché (Strong,
Hevy, Jefit) :**
- **Autocomplétion des exercices** : recherche dans une bibliothèque d'~60 exercices courants,
  avec les exercices déjà utilisés par ce coach mis en avant en premier (historique personnel)
- **Séries individuelles détaillées** (au lieu d'un seul champ "séries/répétitions/charge"
  global) : chaque série a ses propres répétitions et charge, ce qui permet les séries
  pyramidales, les montées en charge progressives, etc. — impossible avec l'ancien modèle
- **"Copier la série précédente"** : ajouter une série pré-remplit les valeurs de la précédente,
  il suffit d'ajuster ce qui change plutôt que de tout ressaisir (le gain de temps le plus cité
  par les utilisateurs de ces apps)

## Cycle menstruel : genre et roue visuelle (V2.1)

- **Champ genre** dans la carte "Informations générales" du profil athlète (féminin, masculin,
  autre, préfère ne pas dire) — non défini par défaut, modifiable à tout moment.
- **Le cycle menstruel n'est visible que pour un profil renseigné en genre féminin**, aussi bien
  côté athlète que côté coach (double vérification : même si `share_with_coaches` était activé
  en base pour un profil non-féminin, la carte reste masquée côté coach — testé explicitement).
- **Roue circulaire des phases**, inspirée des meilleures apps de suivi de cycle du marché (cf.
  étude de concurrence : Wild.AI, FitrWoman, et plus largement Clue/Flo) plutôt qu'un simple texte :
  anneau divisé en 4 phases colorées (menstruelle, folliculaire, ovulatoire, lutéale), un repère
  visuel sur le jour actuel, le jour du cycle et la phase au centre, et l'estimation de la date
  des prochaines règles. Composant : `src/app/athlete/profile/cycle-wheel.tsx`.

## Check-in quotidien de forme (V2)

La page d'accueil de l'athlète (`/athlete`) s'ouvre sur une section "Aujourd'hui" plutôt que
directement sur la vue semaine :
- **Séances du jour** en premier, avant tout le reste
- **Formulaire de forme du jour** : 5 curseurs (forme physique, forme mentale/motivation,
  qualité du sommeil, courbatures, stress), avec un **score global sur 10** calculé en direct
  pendant que l'athlète ajuste les curseurs (courbatures et stress sont inversés dans le calcul,
  puisqu'une valeur haute y est défavorable — voir `src/lib/checkin-types.ts`)
- Un seul check-in par jour : le réenregistrer dans la journée met à jour les valeurs plutôt que
  d'en créer un doublon (contrainte `UNIQUE(athlete_id, check_date)` en base)
- La colonne du jour est mise en évidence dans le calendrier semaine plus bas sur la même page
- **Visible par le coach** (comme les mesures, blessures et journal de bord) sur la fiche de
  l'athlète — contrairement au cycle menstruel, pas de bascule de partage séparée ici : c'est une
  donnée fonctionnelle de suivi d'entraînement, pas une donnée de santé sensible au sens RGPD art. 9

## Notifications

Système de notifications in-app fonctionnel (cloche en haut de chaque page, avec compteur de
non-lues) :
- **Nouvelle séance** envoyée par le coach → notifie l'athlète
- **Séance annulée** par le coach (bouton dédié sur la fiche de séance) → notifie l'athlète
- **Nouveau commentaire** sur une séance → notifie l'autre partie (coach ↔ athlète)
- **Rappel avant une compétition** : généré automatiquement pour tout événement (catégorie
  "Événement") à moins de 3 jours, sans jamais dupliquer le rappel — testé explicitement
  dans le script e2e

Il n'y a pas de tâche planifiée (cron) dans ce prototype : les rappels de compétition sont
générés à la volée, de façon idempotente, à chaque fois que l'athlète consulte ses
notifications (donc au plus tard à sa prochaine connexion, pas en temps réel en arrière-plan).

**Relais email/push** : hors de portée de ce prototype (nécessite un service comme Resend
pour l'email ou le Web Push API pour les notifications navigateur), mais le point
d'intégration est clair — `createNotification()` dans `src/lib/notifications.ts` est
l'endroit unique où brancher un envoi externe en plus de l'écriture en base.

## Stockage des fichiers uploadés (bibliothèque de ressources)

Les vidéos/photos déposées par le coach sont écrites sur le disque local en développement
(`data/uploads/`, à côté de la base SQLite), et sur **Vercel Blob** en production (depuis la
V4 — voir section "Déploiement en ligne" plus haut), avec un nom de fichier opaque généré côté
serveur dans les deux cas. Le reste du code (métadonnées en base, route
`/api/resources/file/[id]` qui vérifie la permission avant de servir le fichier) est identique
quel que soit le mode — seule la fonction `saveUploadedFile`/`readUploadedFile` de
`src/lib/storage.ts` bascule automatiquement entre les deux, selon la présence de la variable
d'environnement `BLOB_READ_WRITE_TOKEN`.

## Vérifier que tout fonctionne

```bash
npx tsx scripts/e2e-check.ts   # logique métier + règle de permission critique
npm run build                  # compilation de production
```
