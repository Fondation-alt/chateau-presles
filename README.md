# Château de Presles

Application web progressive pour la résidence artistique de la MNA Taylor.

## Déploiement Netlify

Le site utilise Netlify pour publier le contenu directement depuis l'administration.

Réglages Netlify :

- Build command : laisser vide
- Publish directory : `.`

Variables d'environnement Netlify recommandées :

- `ADMIN_PIN` : code de l'administration générale
- `KITCHEN_PIN` : code de l'espace cuisine
- `NETLIFY_BLOBS_SITE_ID` : identifiant du site Netlify
- `NETLIFY_BLOBS_TOKEN` : token personnel Netlify permettant à la fonction de sauvegarder le contenu

Exemple :

- `ADMIN_PIN=presles2026`
- `KITCHEN_PIN=cuisine2026`

Le Site ID se trouve dans Netlify :

`Site configuration` → `Site details` → `Site information`

Le token se crée dans Netlify :

`User settings` → `Applications` → `Personal access tokens`

## Pages

- `index.html` : site public
- `admin.html` : administration générale
- `cuisine.html` : espace cuisine

## Contenu

`content.json` sert de contenu de secours.

Après la première publication depuis l'administration, le contenu est sauvegardé en ligne par Netlify.

Les images peuvent être placées dans `images/`.
Les vidéos peuvent être placées dans `assets/`.
Les PDF peuvent être placés dans `pdf/`.

## Codes par défaut de secours

- Admin : `presles2026`
- Cuisine : `cuisine2026`

Ces codes sont modifiables dans l'administration.
