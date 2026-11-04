# PLAN — Church Presentation (cahier des charges v2)

Document de référence du projet. La **Phase 1 (cadrage)** est détaillée dans
[`docs/phase-1-cadrage.md`](docs/phase-1-cadrage.md) ; ce document fixe le périmètre,
l'ordre de réalisation et les critères de sortie de chaque phase.

Cible : application de présentation d'église, **hors ligne**, pour **Windows 10/11 64 bits**,
avec projection sur écran secondaire.

---

## Avancement

| Phase                                  | État       | Preuve                                                                                                                                                                                                |
| -------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Cadrage                            | ✅ livrée  | [`docs/phase-1-cadrage.md`](docs/phase-1-cadrage.md)                                                                                                                                                  |
| 3 — Socle technique et données locales | ✅ livrée  | `backend/` (Laravel 12 + SQLite), 22 tests PHPUnit, `/api/health` vérifié en HTTP réel, données dans le répertoire utilisateur                                                                        |
| 2 — Prototype Electron et multi-écrans | ✅ livrée  | `apps/desktop/` : console + fenêtre de projection indépendante, IPC typé, choix d'écran, plein écran, noir/blanc, gestion perte/retour d'écran                                                        |
| 4 — Sécurité et rôles                  | ⛔ retirée | Pas d'authentification : décision utilisateur du 2026-11-02, l'application est locale et mono-utilisateur                                                                                             |
| 5 — Espace de travail en panneaux      | ✅ livrée  | `apps/desktop/src/workspace/` : bibliothèque / éditeur / programme + aperçu (style VideoPsalm), lecture-écriture sur l'API Laravel                                                                    |
| 6 — Bible et programmes                | ✅ livrée  | `backend/` : tables Bible + FTS5, `bible:import`, `/api/bible/*`, instantanés et actions programme (39 tests) ; `apps/desktop/` : onglets Chants/Bible, éditeur à barre d'édition + liste de strophes |
| 7 — Projection LIVE, thèmes, médias    | ⬜ à faire |                                                                                                                                                                                                       |
| 8 — Sauvegarde et livraison Windows    | ⬜ à faire |                                                                                                                                                                                                       |

Détail d'exécution : [`apps/desktop/README.md`](apps/desktop/README.md).

### Preuves des phases 2 et 3 (2026-11-02)

- **Tests** : PHPUnit `backend/` → **15 tests, 47 assertions OK** ; vitest
  `apps/desktop` → **3 tests OK** (contrat IPC) ; `tsc --noEmit` et
  `npm run build` → OK ; tests racine (`vitest run`) → 6 tests OK.
- **Exécution réelle** : Electron lance le backend (migrations + `php -S` sur
  `127.0.0.1:<port>`), `/api/health` répond `status: ok` avec FTS5 et 6
  migrations ; les données sont créées dans
  `~/.local/share/church-presentation/{data,media,backups,logs,settings}`.
- **Multi-écrans et projection** : pilotage en DevTools (CDP) →
  `listDisplays()` détecte l'écran, `openProjection()` crée la seconde fenêtre
  (`index.html?window=projection`), `setProjectionState(...)` fait apparaître le
  diapositive sur l'écran public, `getPaths()`/`backendStatus()` répondent.
- **Captures** : [`docs/screenshots/console-desktop.png`](docs/screenshots/console-desktop.png)
  et [`docs/screenshots/projection.png`](docs/screenshots/projection.png).
- **À rejouer sur VM Windows** (D5) : plusieurs écrans réels, plein écran sur
  écran secondaire, chemin `%LOCALAPPDATA%\ChurchPresentation`.

### Preuve de la phase 5 — espace de travail (2026-11-02)

Interface unique en trois colonnes, dans l'esprit de VideoPsalm mais volontairement
simplifiée : **onglets Programme / bibliothèque | éditeur de chant | diapositives + aperçu**.
Chaque diapositive de la liste à droite peut être sélectionnée pour la projeter directement.

- **Backend** : `DELETE /api/songs/{song}` (refusé en `409` tant que le chant est
  référencé par un programme) et `PUT /api/programs/{program}` qui remplace la liste
  ordonnée des éléments en transaction. PHPUnit → **22 tests, 74 assertions OK**.
- **Client API** : `apps/desktop/src/api.ts` — base URL fournie par Electron
  (`backendStatus().url`, port éphémère), relative en exécution navigateur
  (proxy Vite), erreurs Laravel traduites en messages lisibles.
- **Bout en bout (CDP)** : Electron lancé →3 chants et 1 programme créés via l'API →
  rechargement → l'espace de travail affiche bibliothèque (3), éditeur, programme
  (3 éléments) et aperçu (`1 / 4`) ; `openProjection()` ouvre la fenêtre publique qui
  affiche **automatiquement** le premier élément du programme ; le bouton « suivante »
  fait passer le compteur de `1 / 4` à `2 / 4`.
- **Vérifications** : `tsc --noEmit`, `eslint apps/desktop`, `prettier --check`,
  vitest (3) et `npm run build` → OK.
- **Captures** : [`docs/screenshots/workspace-desktop.png`](docs/screenshots/workspace-desktop.png)
  et [`docs/screenshots/workspace-projection.png`](docs/screenshots/workspace-projection.png).
- **Raccourcis** : `F5` démarrer le diaporama, `←` `→` diapositive, `B` noir, `W` blanc, `Échap` rétablir,
  `Ctrl+W` afficher/masquer les paroles sans cacher la référence.

### Preuve de la phase 6 — Bible et programmes (2026-11-03)

Navigation **style VideoPsalm** : les onglets Programme, Chants, Bible et Médias partagent
le panneau gauche, un seul contenu étant affiché à la fois. Cliquer un chant ouvre ses paroles
dans l'éditeur central (une ligne par vers, ligne vide entre strophes) et l'envoie automatiquement
en LIVE. Les détails secondaires du chant sont repliés.
Choisir un élément du programme ou une diapositive reprend la projection correspondante, avec
un aperçu large dessous.

- **Base Bible** : tables `bibles` / `bible_verses` / `bible_verses_fts` (FTS5 avec
  triggers), commande `php artisan bible:import [--force|--if-missing]` avec fichier
  sidecar `<stem>.meta.json` (6 clés exigées) ; Electron lance l'import après les
  migrations, **sans bloquer** le démarrage si le fichier est absent.
- **Traduction livrée** : Louis Segond 1910 — **domaine public** (D2 déclarée ouverte,
  avis de licence dans `public/bible-ls1910.license.md`), 66 livres / 31 170 versets
  importés en 0,8 s ; D3 (Bible malagase) toujours en attente de vérification.
- **API** : `GET /api/bible`, `/bible/books`, `/bible/chapter`, `/bible/search`
  (recherche plein texte : tokens guillemetés `AND`, `*` sur le dernier, ≥ 2 caractères) ;
  `POST /api/programs/{id}/duplicate|archive|restore`, `GET /api/programs?archived=only`.
- **Instantanés** : `program_items.snapshot` renseigné pour les éléments `song` et
  `verse` au moment de l'ajout — un programme passé se projette même si le chant est
  modifié ou supprimé ; `DELETE /programs/{id}` reste une purge, l'archivage est réversible.
- **Interface** : **onglets Programme / Chants / Bible / Médias | éditeur de chant |
  diapositives | aperçu**, sélection de versets clic + **Maj+clic** (plage), édition du titre
  et des paroles avec détails secondaires repliés. Le panneau Bible affiche une seule traduction
  sélectionnable à la fois, avec recherche textuelle et recherche par référence. La sélection
  d'un verset ou d'une plage le projette automatiquement ; rechercher une référence telle que
  `Jaona 3:1-19` sélectionne et projette automatiquement la même plage ; les références acceptent
  aussi un mot de titre partiel ou une faute d'une lettre (`Mation 3:5-9` → Evanjelin’i Matio).
  La saisie propose l'autocomplétion des livres, acceptée avec **Tab** (`Asa` → **Asan’ny
  Apostoly**) ; les abréviations fonctionnent aussi dans les références complètes. Le passage
  peut aussi s'ajouter au programme.
- **Bout en bout (CDP)** : **11/11 étapes OK** — 66 livres, chapitre et versets affichés
  avec la licence, recherche « amour de dieu » → 25 résultats, `Jean 1:3` puis plage
  `Jean 1:3-5` ajoutée au programme, instantané relu par l'API
  (`versets: 3`, `traduction: Louis Segond 1910`), aperçu `1/64` avec la référence,
  éditeur (2 strophes, texte de la strophe 2), dupliquer/archiver/restaurer, projection
  ouverte ; 0 erreur console résiduelle.
- **Vérifications** : `tsc --noEmit`, `eslint apps/desktop`, `prettier --check`,
  vitest desktop (**14**) + racine (**6**), `npm run build`, PHPUnit
  (**39 tests, 167 assertions**) → OK.
- **Captures** : [`docs/screenshots/workspace-editor.png`](docs/screenshots/workspace-editor.png),
  [`docs/screenshots/workspace-bible.png`](docs/screenshots/workspace-bible.png) et
  [`docs/screenshots/workspace-projection-phase6.png`](docs/screenshots/workspace-projection-phase6.png).

---

## 0. État des lieux (code existant vs plan)

Le dépôt contient aujourd'hui une application web **TanStack Start** (React 19 + Vite + Tailwind),
sans Electron ni backend PHP :

| Élément du plan v2                                         | Existant                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Monorepo Electron + React/TS + Laravel/PHP                 | App web unique, `src/` TanStack Start                                                         |
| SQLite + FTS5, services métier                             | État en `localStorage` + `BroadcastChannel` (`src/lib/store.ts`), jeu de démonstration en dur |
| Fenêtres admin / projection indépendantes                  | `window.open("/projection")` synchronisé par `BroadcastChannel` (`src/routes/live.tsx:37`)    |
| Authentification, 4 rôles, permissions, journaux           | Rien _(section retirée du périmètre)_                                                         |
| Espace de travail en panneaux, modes Visionneuse / Édition | 5 routes indépendantes : `index`, `bible`, `chants`, `programmes`, `live` (+ `projection`)    |
| Internationalisation FR/MG/EN                              | Interface FR seule (contenus de démo FR/EN/MG)                                                |
| Thèmes, médias, sauvegarde, installateur NSIS              | `SlideView` minimal, aucun thème ni mécanisme de sauvegarde                                   |

Déjà fonctionnel et réutilisable : découpage en diapositives (`src/lib/slides.ts`),
navigation LIVE au clavier, écrans noir/blanc/restauration, Bible Louis Segond 1910
(`public/bible-ls1910.json`, 4,3 Mo).

**Conséquence :** les phases 2 et 3 sont une structuration (voire une réécriture partielle),
pas une incrémentation. Les phases 5 à 8 s'appuient sur cette base ; la phase 4
(authentification) a été retirée du périmètre.

---

## 1. Cadrage (Phase 1)

- Confirmer les versions et environnements visés : Windows 10/11 64 bits, Laravel/PHP, formats de médias.
- Définir les critères de validation des parcours principaux : préparation d'un culte, projection sur un écran secondaire, sauvegarde et restauration.
- Vérifier les licences des traductions bibliques avant leur intégration.
- Définir l'emplacement des données utilisateur et la stratégie de migration lors des mises à jour.

**Résultat :** décisions techniques et critères de validation documentés → [`docs/phase-1-cadrage.md`](docs/phase-1-cadrage.md).

---

## 2. Prototype Electron et multi-écrans

- Créer les fenêtres d'administration et de projection.
- Mettre en place le preload et une API IPC typée, limitée aux commandes autorisées.
- Détecter les écrans et permettre de choisir manuellement l'écran cible.
- Projeter une diapositive de test, gérer le plein écran et tester les écrans noir, blanc et restauration.
- Prévoir la perte ou le rebranchement d'un écran et un mode de prévisualisation sur un seul écran.

**Critère de sortie :** l'administration pilote une fenêtre de projection indépendante sur l'écran choisi.

---

## 3. Socle technique et données locales

- Initialiser le monorepo Electron, React + TypeScript et Laravel/PHP.
- Créer les migrations SQLite, modèles et services métier.
- Définir les échanges entre l'interface, Electron et l'API.
- Mettre en place le démarrage et l'arrêt contrôlés du backend, ainsi que son point de contrôle de santé.
- Séparer les données utilisateur du répertoire d'installation.

**Critère de sortie :** l'application démarre hors ligne et accède à la base locale.

---

## 4. Sécurité et interface de base

> **⛔ Retirée du périmètre (2026-11-02).** L'utilisateur a décidé de ne pas
> implémenter d'authentification : ni compte, ni session, ni rôles. L'application
> est locale et mono-utilisateur, le seul cloisonnement étant le serveur lié à
> `127.0.0.1`. Les besoins de cette section (navigation, tableau de bord,
> internationalisation) sont répartis entre les phases 5 à 7.

- Implémenter la connexion, les sessions, les comptes, les rôles et permissions.
- Vérifier les droits côté Laravel pour toute opération protégée.
- Construire la navigation, le tableau de bord et l'internationalisation FR/MG/EN.
- Ajouter les journaux des opérations administratives.

**Critère de sortie :** les droits des quatre rôles sont appliqués côté backend.

---

## 5. Espace de travail et bibliothèque de chants

Construire l'interface de travail autour de panneaux redimensionnables et mémorisables par utilisateur :

- **Bibliothèque et recherche** : recueils, catégories, langues, filtres instantanés et tris.
- **Programme / agenda** : ajout et réorganisation des chants, passages bibliques, annonces et médias.
- **Diapositives** : vignettes numérotées, réorganisation et repère de la diapositive LIVE.
- **Éditeur** : sections structurées, modification des paroles, annuler/rétablir et indication des changements non enregistrés.
- **Prévisualisation** : rendu avec thème, fond, police et ratio d'écran, séparé de l'affichage public.
- **Barre d'outils** : création, enregistrement, import, duplication, suppression, découpage et mise en forme.

Implémenter les deux modes :

- **Visionneuse / Projection** : recherche, agenda, vignettes, aperçu et commandes LIVE, avec moins d'outils d'édition.
- **Édition** : outils complets pour les chants, sections, styles et mises en forme. Le retour en mode Projection conserve le contexte.

Ajouter le découpage automatique avec aperçu avant validation, la protection des chants utilisés dans un programme et l'édition rapide en direct avec prévisualisation et application contrôlée.

**Critère de sortie :** l'utilisateur peut préparer et modifier des chants depuis l'espace de travail, puis retrouver le même contexte en mode Projection.

---

## 6. Bible et programmes de culte

- Importer les traductions bibliques autorisées avec leurs métadonnées de provenance et de licence.
- Implémenter la navigation, la recherche plein texte SQLite FTS5 et la sélection de passages.
- Créer, modifier, dupliquer, archiver et ordonner les programmes.
- Enregistrer des instantanés des contenus utilisés pour préserver les programmes passés.

**Critère de sortie :** un programme combine différents types de contenus et peut être projeté en conservant ses instantanés.

---

## 7. Projection LIVE, thèmes et médias

- Relier les commandes de la console à l'état centralisé dans Electron Main.
- Afficher l'aperçu de la diapositive actuelle et des suivantes, l'état de connexion et les raccourcis configurables.
- Implémenter les thèmes, arrière-plans et options de lisibilité.
- Gérer les annonces, images et vidéos locales, avec prévisualisation et messages d'erreur compréhensibles.

**Critère de sortie :** l'opérateur pilote le programme sans exposer les commandes à l'écran public.

---

## 8. Sauvegarde, robustesse et livraison Windows

- Sauvegarder et restaurer la base, les médias et les paramètres, avec vérification d'intégrité.
- Prévoir une sauvegarde de précaution avant les migrations de base de données.
- Embarquer le runtime PHP portable et les extensions nécessaires.
- Créer l'installateur Windows `.exe` avec NSIS.
- Vérifier l'installation sur un Windows propre, le fonctionnement hors ligne, les mises à jour et la conservation des données à la désinstallation.
- Documenter l'installation, l'utilisation, la projection, l'architecture, l'API et les limitations connues.

**Critère de sortie :** l'application installée fonctionne sans dépendances de développement et sait sauvegarder puis restaurer les données.

---

## Ordre de réalisation (corrigé)

Le plan v2 listait la Phase 2 (prototype Electron) **avant** la Phase 3 (initialisation du
monorepo) alors qu'elle en dépend. L'ordre ci-dessous fait foi :

1. **Phase 1** — Cadrage _(livrable : `docs/phase-1-cadrage.md`)_
2. **Phase 3** — Initialisation du monorepo et socle technique
3. **Phase 2** — Prototype des fenêtres et projection multi-écrans
4. ~~**Phase 4** — Authentification et permissions~~ _(retirée : pas d'authentification)_
5. **Phase 5** — Tableau de bord, langues, espace de travail en panneaux et bibliothèque de chants
6. **Phase 6** — Bible et programmes
7. **Phase 7** — Projection LIVE, thèmes et médias
8. **Phase 8** — Sauvegarde, robustesse et packaging

_(Les numéros de phase conservent la numérotation du cahier des charges v2 ; seul l'ordre
d'exécution est corrigé.)_

**Séquençage critique :** la projection multi-écrans reste à valider en premier après le socle.
Les licences bibliques, la protection des données et le fonctionnement hors ligne sont des
contraintes transversales à suivre à chaque phase.

---

## Contraintes transversales

- **Hors ligne** : aucune fonctionnalité ne doit exiger de connexion réseau après l'installation.
- **Aucune authentification** : ni compte, ni session, ni rôle (décision du 2026-11-02) ; le serveur reste lié à `127.0.0.1` et refuse les origines distantes.
- **Données utilisateur** : jamais dans le répertoire d'installation (voir Phase 1, §4).
- **Licences bibliques** : seule une traduction dont la licence est confirmée entre dans le produit (voir Phase 1, §3).
- **Historique git** : le dépôt est connecté à Lovable — ne jamais réécrire l'historique publié (force push, rebase, amend sur les commits poussés).
- **Droits** : toute opération protégée est vérifiée côté serveur, jamais seulement dans l'UI.
