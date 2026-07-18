# Déployer Mada-Brousse 2.0 sur Render + Supabase

## 1. Base de données (Supabase)
1. Créez un projet Supabase, récupérez la chaîne de connexion Postgres (Project Settings → Database → Connection string, mode **"Session"**).
   - Elle ressemble à : `postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres`
2. Ouvrez le SQL editor de Supabase et exécutez, dans l'ordre :
   - `sql/schema.sql` (crée les tables, y compris `admin_sessions` pour l'authentification admin par jeton)
   - `sql/seed.sql` (données de démo : trajets + images, chauffeurs, promos, compte admin `admin` / `mada2025`)

## 2. Service web (Render)
1. Créez un "Web Service" Render à partir du dépôt Git contenant ce code.
2. Build command : `npm install`
3. Start command : `npm start`
4. Variable d'environnement à définir sur Render :
   - `DATABASE_URL` = la chaîne de connexion Supabase de l'étape 1
   (`PORT` est fourni automatiquement par Render.)
5. Déployez. Le site sera disponible sur l'URL fournie par Render.

## 3. Nouveautés de cette version — à connaître avant la mise en production

### Authentification admin par jeton
Les routes `/api/admin/*` et `/api/admin/reservations` exigent désormais un
en-tête `Authorization: Bearer <token>`. Le jeton est généré à la connexion
(`/api/admin/login`) et stocké dans la table `admin_sessions` (valable 12h).
**Changez le mot de passe admin par défaut** (`admin` / `mada2025`) directement
dans la table `admins` sur Supabase avant la mise en production.

### Validation des réservations (avant/après paiement)
Une réservation est créée avec le statut `en_attente` juste après le paiement
(simulé) côté client. Tant que l'administrateur ne l'a pas validée depuis
l'onglet "Réservations" du tableau de bord admin :
- le client ne peut **ni imprimer, ni télécharger** son billet (boutons
  désactivés sur `/confirmation` et `/mes-reservations`) ;
- son statut affiché reste "En attente de validation".

L'admin peut **Valider** (statut `confirmee`, débloque le billet) ou
**Rejeter** (statut `rejetee`, libère automatiquement les sièges réservés).

### Protection des données des visiteurs
`/mes-reservations` n'affiche plus la liste de toutes les réservations : le
navigateur du client garde en mémoire (localStorage) uniquement les
identifiants de SES réservations, et le nouvel endpoint public
`/api/reservations/mine?ids=...` ne renvoie que celles-ci. La liste complète
avec les coordonnées de tous les clients n'est accessible que via
`/api/admin/reservations`, protégée par jeton admin.

### Photos par trajet
L'admin peut désormais **importer sa propre photo** pour un trajet (en plus
du choix parmi les photos de destination pré-chargées) depuis l'onglet
"Trajets". La photo importée est prioritaire si les deux sont renseignées.

## ⚠️ Problèmes fréquents en production

### Images de trajets absentes
Les images des trajets viennent de la colonne `image_url` dans la table `trips` de Supabase.
Si vous voyez des cartes sans image, c'est que le `seed.sql` n'a pas été exécuté **ou** que les trajets ont été ajoutés sans sélectionner/importer de photo depuis l'admin.
→ Ré-exécutez `sql/seed.sql` dans le SQL editor Supabase, ou ajoutez les trajets depuis la page Admin.

### Sélection des sièges : "erreur de chargement"
Cause la plus probable : la connexion à Supabase échoue (SSL manquant ou `DATABASE_URL` incorrecte).
Supabase exige **SSL**. Le code le gère automatiquement pour toute base distante (non-localhost), mais vérifiez que :
- `DATABASE_URL` est bien définie dans les variables d'environnement Render (pas d'espace, pas de guillemets autour).
- Vous utilisez la chaîne mode **"Session"** (port 5432), pas le mode "Transaction" (port 6543 / pgBouncer) qui a des limitations.

### Photos (chauffeurs / trajets) disparaissent après redéploiement
Normal : le disque Render n'est pas persistant. Pour conserver les photos uploadées, ajoutez un **"Persistent Disk"** Render monté sur `/public/images` (couvre `drivers/` et `trips/`), ou migrez vers Supabase Storage.

### Session admin expirée
Les jetons admin expirent après 12h (table `admin_sessions`). C'est normal :
reconnectez-vous simplement depuis `/admin-login`.

## Sécurité
- Changez le mot de passe admin par défaut (`admin` / `mada2025`) avant la mise en production.
- Envisagez de hasher les mots de passe admin (actuellement en clair dans `admins.password`) si plusieurs comptes admin sont créés.

