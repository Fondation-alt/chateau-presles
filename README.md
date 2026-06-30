# Château de Presles

Application web progressive pour la résidence artistique de la MNA Taylor.

## Déploiement Netlify

Le site est statique pour les visiteurs. L'administration publie les modifications dans GitHub, puis Netlify redéploie automatiquement.

Réglages Netlify :

- Build command : laisser vide
- Publish directory : `.`

Variables d'environnement Netlify recommandées :

- `ADMIN_PIN` : code de l'administration générale
- `KITCHEN_PIN` : code de l'espace cuisine
- `GITHUB_TOKEN` : token GitHub avec accès au dépôt
- `GITHUB_OWNER` : nom du compte ou de l'organisation GitHub
- `GITHUB_REPO` : nom du dépôt
- `GITHUB_BRANCH` : branche à modifier, souvent `main`
- `GITHUB_CONTENT_PATH` : optionnel, par défaut `content.json`

- `GITHUB_OWNER=votre-compte`
- `GITHUB_REPO=chateau-presles`
- `GITHUB_BRANCH=main`

## Pages

- `index.html` : site public
- `admin.html` : administration générale
- `cuisine.html` : espace cuisine

## Contenu

`content.json` est le contenu public du site. L'administration le met à jour dans GitHub.

Les images peuvent être placées dans `images/`.
Les vidéos peuvent être placées dans `assets/`.
Les PDF peuvent être placés dans `pdf/`.

## Codes

Les codes admin et cuisine se définissent uniquement dans Netlify avec `ADMIN_PIN` et `KITCHEN_PIN`.

Ne les écrivez jamais dans les fichiers du dépôt GitHub.
