# github-pr-target-branch

Script [Tampermonkey](https://www.tampermonkey.net/) qui ajoute, sur la page [github.com/Dolibarr/dolibarr/pulls](https://github.com/Dolibarr/dolibarr/pulls), un tag indiquant la **branche cible** (base) de chaque Pull Request, avec un style identique aux labels natifs de GitHub.

![exemple](https://img.shields.io/badge/develop-vert-2ea44f) ![exemple](https://img.shields.io/badge/22.0-bleu-0969da)

## Fonctionnalités

- Ajoute un tag (icône branche + nom) juste après l'indicateur de statut des checks CI (coche verte / croix rouge) sur chaque ligne de PR
- Couleur du tag selon la branche cible :
  - **vert** : `develop`, `main`, `master`
  - **bleu** : motif de version (ex. `22.0`, `23.0`)
  - **gris** : toute autre branche
- Le tag est cliquable et renvoie vers l'arborescence de la branche cible
- Style natif GitHub (réutilise les classes CSS `IssueLabel` déjà chargées par la page), donc cohérent en thème clair et sombre
- Fonctionne avec la navigation Turbo de GitHub (pagination, changement de filtre) sans rechargement de page
- Repositionne automatiquement le tag si l'indicateur de statut CI apparaît après coup (chargement asynchrone)

## Installation

1. Installer l'extension [Tampermonkey](https://www.tampermonkey.net/) (Firefox, Chrome, Edge...)
2. Ouvrir le dashboard Tampermonkey → "Créer un script"
3. Remplacer le contenu par celui de [`dolibarr-pr-target-branch.user.js`](dolibarr-pr-target-branch.user.js)
4. Enregistrer (Ctrl+S)
5. Ouvrir https://github.com/Dolibarr/dolibarr/pulls

## Configuration (optionnel) : token GitHub

Le script interroge l'API publique GitHub (`GET /repos/Dolibarr/dolibarr/pulls/{number}`) pour connaître la branche cible de chaque PR. Sans authentification, cette API est limitée à ~60 requêtes/heure par IP, ce qui suffit pour une navigation normale grâce à un cache local (24h).

Pour lever cette limite (jusqu'à 5000 requêtes/heure) :

1. Créer un [Personal Access Token GitHub](https://github.com/settings/tokens) (le scope `public_repo` suffit)
2. Cliquer sur l'icône Tampermonkey → menu du script → **"Définir le token GitHub (API)"**
3. Coller le token dans la popup et valider

Le token est stocké localement via `GM_setValue` (jamais transmis ailleurs qu'à `api.github.com`). Laisser le champ vide et valider le supprime.

## Comment ça marche

- La branche cible n'est pas présente dans le HTML de la liste des PR, elle est donc récupérée via l'API GitHub, avec mise en cache par numéro de PR dans `localStorage`
- Le tag est positionné en s'ancrant sur l'élément `details.commit-build-statuses` (l'indicateur de checks CI), présent sur la ligne du titre de chaque PR
- Un `MutationObserver` détecte les changements du DOM (navigation Turbo, chargement différé des statuts CI) pour traiter les nouvelles lignes et repositionner les tags déjà créés

## Limitations connues

- Spécifique au dépôt `Dolibarr/dolibarr` (URL du script et nom du dépôt en dur)
- Sans token, la limite de 60 requêtes/heure peut être atteinte en cas de navigation intensive sur plusieurs pages non mises en cache
