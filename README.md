# Mada-Brousse 2.0 🚌

Site de reservation de taxi-brousse (projet de demonstration, donnees en localStorage).

## Lancer en local

```bash
npm install
npm start
```

Puis ouvrez http://localhost:3000

## Dépendances front-end

Le site utilise désormais **Bootstrap 5.3.8** et **Font Awesome 6.5.1** en
local, chargés depuis `public/vendor/` (aucun CDN) sur toutes les pages, en
plus de la feuille de style maison (`public/css/style.css`) qui définit
l'identité visuelle du site (vert nature + rouge laterite) par-dessus la
base Bootstrap. **Chart.js** reste chargé via CDN dans `admin.html`.

## Fonctionnalités ajoutées

- **Photos par trajet** : l'admin peut importer sa propre photo pour un
  trajet (onglet "Trajets"), en plus des photos de destination pré-chargées.
- **Protection des informations des visiteurs** : chaque client ne voit que
  ses propres réservations (`/mes-reservations`) ; la liste complète avec
  les coordonnées de tous les clients n'est accessible qu'à l'admin, via une
  authentification par jeton de session.
- **Validation des réservations par l'admin** : toute réservation reste
  "en attente" après paiement jusqu'à ce que l'admin la valide ou la
  rejette. Impression et téléchargement du billet sont bloqués côté client
  tant que la réservation n'est pas validée.

Voir `DEPLOY.md` pour le détail de ces changements côté déploiement.

## Deploiement sur Render

1. Poussez ce dossier sur un depot GitHub :
   ```bash
   git init
   git add .
   git commit -m "Mada-Brousse 2.0"
   git branch -M main
   git remote add origin https://github.com/<votre-compte>/mada-brousse.git
   git push -u origin main
   ```
2. Sur [render.com](https://render.com), cliquez **New +** → **Web Service**.
3. Connectez votre depot GitHub `mada-brousse`.
4. Renseignez :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Environment** : Node
   - Render definit automatiquement `PORT`, deja gere par `server.js`.
5. Cliquez **Create Web Service**. Au bout de quelques minutes votre site est
   en ligne a une URL du type `https://mada-brousse.onrender.com`.

## Deploiement sur Vercel (alternative)

Vercel est pense pour du serverless ; pour un serveur Express classique comme
celui-ci, Render ou Railway sont plus directs. Si vous preferez Vercel,
ajoutez un fichier `vercel.json` a la racine :

```json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "server.js" }]
}
```

puis lancez `vercel` depuis le dossier du projet (necessite le CLI Vercel et
un compte).

## Identifiants admin (demo)

- Identifiant : `admin`
- Mot de passe : `mada2025`

## Codes promo (demo)

- `MADA10` : -10 %
- `BROUSSE2025` : -5000 Ar
