# Avis de provenance et de licence — `bible-ls1910.json`

> Règle d'entrée en vigueur (cadrage `docs/phase-1-cadrage.md` §3.1) :
> **aucune traduction n'est embarquée sans licence documentée.** Ce fichier est
> l'avis de provenance du fichier JSON livré avec le projet ; l'import
> `php artisan bible:import` refuse tout fichier dont le côté
> `<nom>.meta.json` ne porte pas les six métadonnées exigées.

## Métadonnées

| Champ          | Valeur                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `translation`  | **Louis Segond 1910** (`ls1910`)                                                                                                                                                     |
| `source`       | Fichier JSON livré avec le dépôt (`public/bible-ls1910.json`), ajouté au commit `e7e9627` du **2026-11-02**. **Provenance numérique initiale non documentée — décision D2 ouverte.** |
| `edition`      | 1910                                                                                                                                                                                 |
| `retrieved_at` | 2026-11-02 (date d'entrée du fichier dans le dépôt)                                                                                                                                  |
| `license`      | **Domaine public** — traducteur Louis Segond (1810-1873), traduction publiée en 1910                                                                                                 |
| `license_url`  | `null` : pas d'URL d'éditeur. Le texte est dans le domaine public et la source numérique utilisée n'est pas tracée (D2), il serait malhonnête d'en citer une.                        |

## Vérification

- Auteur/traducteur : Louis Segond, né en 1810, décédé en **1873** → au-delà du
  délai de protection sur les traductions de son époque ; le texte de 1910 est
  diffusé librement depuis plus d'un siècle.
- Aucune **traduction protégée** (NIV, ESV, NLT, …) n'est livrée : la grille du
  cadrage §3.3 les exclut de la V1.
- La Bible malagase (D3) n'est **pas** livrée dans la V1 : licence à vérifier
  avant toute intégration.
- Contrôle automatique : `backend/tests/Feature/BibleTest.php` vérifie que
  l'import refuse un fichier sans métadonnées, à métadonnées incomplètes, ou
  dont la `translation` ne correspond pas au JSON.

## Reproduire l'import

```bash
cd backend
../tools/php.sh artisan bible:import ../public/bible-ls1910.json
../tools/php.sh artisan bible:import ../public/bible-ls1910.json --force   # remplacer
```

Le programme de bureau lance la même commande avec `--if-missing` au démarrage,
après `artisan migrate`.
