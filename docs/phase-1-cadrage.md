# Phase 1 — Cadrage (Church Presentation)

Livrable de la Phase 1 du [`PLAN.md`](../PLAN.md) : décisions techniques et critères de
validation. Chaque section se termine par un état **(confirmé)** ou **(ouvert)** — les
points ouverts sont repris en fin de document avec un responsable et une date de tranché.

---

## 1. Versions et environnements visés

### 1.1 Cible de production

| Sujet        | Décision                                                                                                                                                        | État                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| OS           | Windows 10 (1903+) et Windows 11, **64 bits uniquement**                                                                                                        | confirmé                             |
| Distribution | Installateur `.exe` NSIS + désinstallation conservant les données utilisateur                                                                                   | confirmé                             |
| Exécution    | **Hors ligne**, aucun service requis au démarrage                                                                                                               | confirmé                             |
| Architecture | Monorepo : `app/` (Electron + React/TS), `backend/` (Laravel/PHP), `shared/` (types IPC/API)                                                                    | confirmé (voir §6)                   |
| Backend      | Laravel sur **PHP 8.3 NTS x64 portable** (zip officiel, sans MSI), extensions `pdo_sqlite`, `sqlite3`, `mbstring`, `openssl`, `fileinfo`, `tokenizer`, `sodium` | confirmé                             |
| Base         | SQLite, mode WAL, intégrité `PRAGMA foreign_keys=ON`, **FTS5 obligatoire** (vérifier `compile_options` contient `ENABLE_FTS5` au premier démarrage)             | confirmé                             |
| Front        | React 19 + TypeScript + Vite + Tailwind 4 (déjà en place), conservé autant que possible                                                                         | confirmé                             |
| Hôte de dev  | Linux (poste actuel) — **non représentatif du livrable** : toute fonctionnalité « Windows seulement » doit être testée tôt sur une VM Windows                   | ouvert (fréquence des tests Windows) |

### 1.2 Formats de médias acceptés

| Type    | Formats                                  | Contraintes                                                                                               |
| ------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Images  | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` | fonds d'écran ; conversion/reservation à l'import si > 8 Mo                                               |
| Vidéos  | `.mp4` (H.264 + AAC)                     | conteneur et codecs imposés pour la compatibilité WebView2 ; rejeu avec message explicite si non supporté |
| Audio   | `.mp3`, `.wav`, `.ogg`                   | annonces sonores                                                                                          |
| Polices | `.ttf`, `.otf`, `.woff2`                 | système uniquement pour la V1 ; polices embarquées ultérieurement                                         |

Tout fichier refusé doit afficher un **message d'erreur compréhensible** (format, taille,
chemin), jamais une erreur technique brute.

### 1.3 Environnement de développement

- Linux (cible dev) + **une VM Windows 10 et une Windows 11** pour les tests d'installation,
  du packageur NSIS et du PHP portable.
- Node.js LTS, Bun/npm selon le lockfile en place (`bun.lock`), PHP 8.3 en local pour Laravel.
- Aucune dépendance réseau à l'exécution : les tests d'intégration tournent en local.

---

## 2. Critères de validation des parcours principaux

Critères **vérifiables en démonstration** (étape, résultat observé, sans ambiguïté).
Ils servent de recette pour les phases 2 à 8.

### 2.1 Préparation d'un culte

| #   | Étape attendue                                                  | Critère de succès                                                                                                   |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| P1  | Créer un programme nommé et daté                                | Le programme apparaît dans la liste et rouvre à l'identique après redémarrage complet de l'application              |
| P2  | Ajouter un chant, un passage biblique, une annonce et une image | Les 4 types d'items sont présents, dans l'ordre imposé                                                              |
| P3  | Réordonner les items (glisser-déposer)                          | L'ordre persiste après fermeture/rouverture                                                                         |
| P4  | Modifier les paroles d'un chant déjà placé                      | L'utilisateur est averti que le chant est **utilisé dans un programme** et choisit de propager ou non le changement |
| P5  | Voir les vignettes de diapositives générées                     | Chaque vignette est numérotée ; le découpage respecte le nombre de lignes max/diapositive                           |
| P6  | Quitter puis revenir                                            | Le mode en cours (Visionneuse/Édition), les panneaux ouverts et le dernier item sélectionné sont restaurés          |

### 2.2 Projection sur écran secondaire

| #   | Étape attendue                                     | Critère de succès                                                                                                                            |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Ouvrir la fenêtre de projection sur l'écran choisi | La fenêtre s'ouvre **en plein écran sur l'écran sélectionné**, sans barre de tâche ni chrome visible                                         |
| E2  | Naviguer (précédent/suivant, raccourcis)           | L'écran public suit immédiatement ; **aucune commande ni fenêtre de contrôle n'apparaît sur l'écran public**                                 |
| E3  | Écrans noir (B) / blanc (W) puis restauration      | L'écran change puis revient à la diapositive exacte précédente                                                                               |
| E4  | Changer d'écran cible à chaud                      | La projection bascule vers le nouvel écran sans redémarrage                                                                                  |
| E5  | Débrancher l'écran projeté                         | L'application **ne plante pas** ; un état « écran introuvable » est affiché en console ; le rebranchement propose de réactiver la projection |
| E6  | Un seul écran (cas portable)                       | Le mode prévisualisation unique permet de piloter sans écran secondaire                                                                      |

### 2.3 Sauvegarde et restauration

| #   | Étape attendue                                 | Critère de succès                                                                                                                  |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Exporter une sauvegarde                        | Un seul fichier (archive) contenant base, médias et paramètres ; **contrôle d'intégrité** (checksum) lisible à l'export            |
| S2  | Restaurer sur une installation vierge          | Nombre de chants, programmes et médias **identique** à l'origine ; les médias s'ouvrent                                            |
| S3  | Restaurer une archive corrompue                | Échec **propre**, message explicite, base d'origine inchangée                                                                      |
| S4  | Mise à jour de version avec données existantes | Sauvegarde de précaution créée automatiquement avant migration ; en cas d'échec de migration, la version précédente reste ouvrable |

### 2.4 Transverse

- **Hors ligne** : couper le réseau (Wi-Fi et câble) puis exécuter P1, E2 et S1 sans erreur.
- **Cloisonnement sans authentification** : aucun compte, aucune session, aucun rôle
  (décision du 2026-11-02, voir D1/D7) ; le serveur est lié à `127.0.0.1` et refuse
  les origines distantes, ce qui reste vérifié côté serveur et pas seulement dans l'UI.
- **Reprise après crash** : tuer le processus pendant une projection, relancer → état LIVE restauré à l'identique (diapositive courante incluse).

---

## 3. Licences des traductions bibliques

### 3.1 Règle d'entrée en vigueur

> **Aucune traduction n'est embarquée sans licence documentée.** Le dépôt d'import exige,
> pour chaque fichier : `translation`, `source`, `edition`, `retrieved_at`, `license`,
> `license_url`. Un fichier sans ces métadonnées est rejeté (Phase 6).

### 3.2 Grille de vérification

Pour chaque traduction, relever : (a) date de publication du texte, (b) date de mort de
l'auteur/traducteur, (c) politique de l'éditeur actuel, (d) mention de licence exigée,
(e) source du fichier numérique. Une seule ligne de la grille manquée = traduction **en attente**.

### 3.3 État des traductions

| Traduction                                      | Langue | Statut                 | Note                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Louis Segond 1910**                           | FR     | **livrée (Phase 6)**   | Domaine public (traducteur décédé en 1873, texte de 1910). Importée en SQLite (66 livres / 31 170 versets) avec avis `public/bible-ls1910.license.md` et sidecar `public/bible-ls1910.meta.json` — la **source du fichier reste à tracer** (D2 ouverte : provenance numériques initiale non documentée, licence déclarée ouverte) |
| King James Version                              | EN     | retenue sous réserve   | Texte de 1611/1769, domaine public — à confirmer sur la source numérique utilisée                                                                                                                                                                                                                                                 |
| World English Bible                             | EN     | retenue sous réserve   | Domaine public (projet public)                                                                                                                                                                                                                                                                                                    |
| Bible Malagase                                  | MG     | **à vérifier**         | Les éditions de la Société Biblique de Madagascar peuvent être protégées : licence écrite requise avant intégration                                                                                                                                                                                                               |
| Traductions modernes protégées (NIV, ESV, etc.) | divers | **exclues** pour la V1 | Licence payante/distribution : ne pas intégrer sans accord écrit                                                                                                                                                                                                                                                                  |

### 3.4 Actions Phase 1

- [x] Traduction déjà embarquée (LSG) : avis de provenance et de licence ajouté
      (`public/bible-ls1910.license.md` + `public/bible-ls1910.meta.json`) — **fait en
      Phase 6** (commit `e7e9627`, 2026-11-02) ; l'import refuse tout fichier sans les
      6 métadonnées exigées.
- [ ] Identifier la **source exacte** du JSON actuel (aucune métadonnée de provenance dans
      le fichier : seules les clés `translation` et `books` existent) et la consigner —
      **D2 ouverte**, consignée dans l'avis de licence.
- [ ] Obtenir la réponse sur la Bible malagase avant la Phase 6 — **D3 en attente**,
      aucune traduction malagase n'est embarquée.

---

## 4. Emplacement des données utilisateur et stratégie de migration

### 4.1 Emplacement (Windows)

Tout ce qui est modifiable par l'utilisateur vit **hors du répertoire d'installation**
(jamais sous `C:\Program Files\…`, inscrit en lecture seule) :

```
%LOCALAPPDATA%\ChurchPresentation\
├── data\            base SQLite (db + WAL) et fichiers de verrouillage
├── media\           images, vidéos, polices importées
├── settings\        préférences, dispositions de panneaux, raccourcis
├── backups\         sauvegardes manuelles + précaution automatique
│                    (pre-migration-<version>-<horodatage>.zip)
└── logs\            journaux d'opérations administratives (rotation, 10 Mo max)
```

- **Portable** : si un dossier `portable-data\` existe à côté de l'exécutable, il prime
  (clé USB). À décider si la V1 le supporte → **ouvert**.
- Le chemin réel est exposé par Electron Main via IPC ; le backend Laravel le reçoit au
  démarrage (`--data-dir=`), jamais déduit du répertoire courant.

### 4.2 Version du schéma

- Schema versionné par les migrations Laravel ; valeur lue au démarrage et comparée à la
  version du binaire.
- **Migration ascendante** : sauvegarde de précaution automatique → migration → vérification
  (`PRAGMA integrity_check`) → ouverture.
- **Échec** : on rouvre sur la sauvegarde, message explicite, journalisation ; l'utilisateur
  ne voit jamais une base corrompue silencieusement.
- **Descente de version** non supportée : bloquée avec message (ancienne version + base plus
  récente = refus explicite).

### 4.3 Migration des données de la version web actuelle

L'app actuelle stocke tout sous la clé `localStorage["church-presentation-v1"]`
(chants, programmes, état LIVE). Au premier lancement de la version desktop :

1. Détection d'une base vide + présence de la clé (si exécution en WebView2 partageant le
   profil, ou import manuel d'un fichier exporté depuis la version web).
2. Import one-shot : chants et programmes copiés dans SQLite, puis marqueur `legacy_imported`
   posé (jamais de réimport silencieux en double).
3. L'état LIVE n'est **pas** migré (projection en cours non transposable).

### 4.4 Sauvegardes

- Export manuel unique (base + médias + paramètres) avec checksum.
- Sauvegarde de précaution automatique **avant** toute migration de schéma et avant import.
- Rotation : 5 sauvegardes auto conservées, les manuelles ne sont jamais purgées.

---

## 5. Décisions ouvertes

| #   | Sujet                   | Question                                                                                                                            | Impact                                 | À trancher avant                           |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| D1  | Rôles                   | **Retirée le 2026-11-02** : l'utilisateur refuse toute authentification — ni compte, ni session, ni rôle.                           | Caduc (voir §Décisions tranchées)      | —                                          |
| D2  | Provenance LSG          | Quelle est la source exacte de `public/bible-ls1910.json` ?                                                                         | Traçabilité, Phase 6                   | **ouverte** (livrée avec avis)             |
| D3  | Bible malagase          | Licence obtenue ou non ?                                                                                                            | Contenu MG de la Phase 6               | **en attente** (aucune Bible MG embarquée) |
| D4  | Portabilité             | Support du mode portable (clé USB) en V1 ?                                                                                          | NSIS, chemin des données               | Phase 8                                    |
| D5  | Tests Windows           | Fréquence : à chaque phase ou uniquement en fin de projet ?                                                                         | Risque de découvert coûteux en Phase 8 | Phase 2                                    |
| D6  | Périmètre de la refonte | Faut-il migrer le code TanStack existant (routes `chants`, `bible`, `programmes`, `live`) ou repartir proprement dans le monorepo ? | Délai des phases 2-3                   | Phase 3                                    |
| D7  | Compte hors ligne       | **Sans objet depuis le rejet de l'authentification** (2026-11-02).                                                                  | Caduc                                  | —                                          |

### Décisions tranchées depuis la première version du document

- **D1 et D7 — authentification** : l'utilisateur a décidé d'utiliser l'application
  **sans authentification**. La Phase 4 est retirée du périmètre : aucun compte, aucun
  rôle, aucune permission. Le `.env` de première exécution est toujours généré avec une
  `APP_KEY` aléatoire (D7 conservé pour ce volet technique), mais il ne sert plus à
  protéger des comptes.
- **D5 — tests Windows** : l'installation et le packageur NSIS sont rejoués sur
  une VM Windows à chaque livraison de phase, pas seulement en fin de projet.
- **D6 — périmètre de la refonte** : monorepo par dossiers (`apps/desktop`,
  `backend`) **sans** toucher à l'app web Lovable ; la logique métier de
  `src/lib` est partagée par alias Vite/TypeScript plutôt que copiée.

---

## 6. Note sur l'ordre des phases

Le cahier des charges v2 listait la Phase 2 (prototype Electron) avant la Phase 3
(initialisation du monorepo), alors qu'elle en dépend. L'ordre corrigé figure dans
[`PLAN.md`](../PLAN.md) § Ordre de réalisation : **Phase 1 → 3 → 2 → 5 → 6 → 7 → 8**
(la Phase 4, authentification, ayant été retirée du périmètre le 2026-11-02).
