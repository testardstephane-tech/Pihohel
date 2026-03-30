# ✨ Pihohel — Guide de déploiement (version simple)

App privée pour La Fluidité & La Krystalité.
Premade of Love 💜🩷

---

## Ce qu'il faut faire (dans l'ordre)

### ÉTAPE 1 — Créer les comptes gratuits et récupérer les clés (20 min)

#### Supabase (ta base de données)
1. Va sur https://supabase.com → "Start your project" → crée un compte
2. "New project" → nom : `pihohel` → choisis un mot de passe → région : `West EU (Ireland)`
3. Attends 1-2 min que le projet se crée
4. Va dans **Settings → API**
5. Copie :
   - "Project URL" → c'est VITE_SUPABASE_URL
   - "anon / public" key → c'est VITE_SUPABASE_ANON_KEY

#### TMDB (séries & acteurs) — gratuit
1. https://www.themoviedb.org/signup → crée un compte
2. https://www.themoviedb.org/settings/api → "Create" → "Developer"
3. Remplis le formulaire (mets "Personal use" partout)
4. Copie la **clé API (v3)** → c'est VITE_TMDB_API_KEY

#### RAWG (jeux vidéo) — gratuit
1. https://rawg.io/apidocs → "Get API Key"
2. Crée un compte, donne un nom d'app
3. Copie ta clé → c'est VITE_RAWG_API_KEY

#### Giphy (GIFs câlins K-pop) — gratuit
1. https://developers.giphy.com → "Create an App" → "API"
2. Donne un nom → copie ta clé → c'est VITE_GIPHY_API_KEY

#### Unsplash (recherche d'images Photo-Recap) — gratuit
1. https://unsplash.com/developers → "New Application"
2. Accepte les conditions → donne un nom → copie la "Access Key"
3. C'est VITE_UNSPLASH_API_KEY

---

### ÉTAPE 2 — Configurer Supabase (5 min)

1. Dans ton projet Supabase → **SQL Editor** → "New query"
2. Copie-colle TOUT le contenu du fichier `supabase_schema.sql`
3. Clique **RUN** ✓ (tu devrais voir "Success")

4. Va dans **Storage** → "New bucket"
   - Nom : `photo-recaps`
   - Public : **Non**
   - Crée le bucket
   - Dans "Policies" du bucket, ajoute ces 3 règles :
     - SELECT : `(auth.role() = 'authenticated')`  
     - INSERT : `(auth.role() = 'authenticated')`
     - DELETE : `(auth.role() = 'authenticated')`

5. Va dans **Authentication → Settings** :
   - "Site URL" : mets `http://localhost:5173` pour l'instant
   - Tu le changeras par l'URL Vercel après

---

### ÉTAPE 3 — Préparer les fichiers (2 min)

1. Télécharge et décompresse le ZIP de Pihohel
2. Dans le dossier, trouve le fichier `.env.example`
3. Copie-le et renomme la copie `.env`
4. Ouvre `.env` avec le Bloc-notes et remplis toutes les valeurs avec tes clés

---

### ÉTAPE 4 — Déployer sur Vercel (5 min)

#### Option la plus simple : via GitHub
1. Crée un compte sur https://github.com si tu n'en as pas
2. Crée un "New repository" → nom `pihohel` → Private
3. Glisse ton dossier Pihohel dans l'interface GitHub (ou utilise GitHub Desktop)
4. Va sur https://vercel.com → "New Project" → importe ton repo GitHub `pihohel`
5. Dans **Environment Variables**, ajoute une par une toutes ces variables :
   ```
   VITE_SUPABASE_URL          → ta valeur
   VITE_SUPABASE_ANON_KEY     → ta valeur
   VITE_TMDB_API_KEY          → ta valeur
   VITE_RAWG_API_KEY          → ta valeur
   VITE_GIPHY_API_KEY         → ta valeur
   VITE_UNSPLASH_API_KEY      → ta valeur
   ```
6. Clique **Deploy** → dans 2 minutes tu as une URL ! 🎉

#### Mettre à jour l'URL dans Supabase
- Retourne dans Supabase → Authentication → Settings
- Remplace l'URL par ton URL Vercel (ex: `https://pihohel.vercel.app`)

---

### ÉTAPE 5 — Installer l'app sur vos téléphones (2 min chacun)

#### iPhone (La Krystalité & La Fluidité) :
1. Ouvre l'URL dans **Safari** (pas Chrome !)
2. Appuie sur l'icône "Partager" (carré avec flèche vers le haut)
3. Défile vers le bas → **"Sur l'écran d'accueil"**
4. Appuie **"Ajouter"**
5. Pihohel apparaît comme une vraie app ! ✨

#### Android :
1. Ouvre l'URL dans **Chrome**
2. Menu ⋮ en haut à droite → **"Ajouter à l'écran d'accueil"**

---

## Pour les mises à jour

Quand tu veux modifier quelque chose :
1. Tu me dis ce que tu veux changer ici dans le chat
2. Je te génère le ou les fichiers modifiés
3. Tu remplaces le fichier dans ton dossier
4. Tu le mets sur GitHub (glisser-déposer)
5. Vercel redéploie automatiquement en 1 minute
6. La Krystalité voit la mise à jour automatiquement sur son téléphone ✓

---

## Structure du projet

```
pihohel/
├── src/
│   ├── App.jsx                    # Routeur + gestion utilisateur
│   ├── hooks/
│   │   └── useUser.jsx            # Qui est connecté (La Fluidité / La Krystalité)
│   ├── lib/
│   │   ├── supabase.js            # Base de données
│   │   ├── api.js                 # TMDB, RAWG, Giphy
│   │   └── trophies.js            # Logique des badges
│   ├── pages/
│   │   ├── LoginPage.jsx          # 2 boutons de connexion
│   │   ├── HomePage.jsx           # Accueil — ce qu'on regarde
│   │   ├── SearchPage.jsx         # Recherche séries/jeux/acteurs
│   │   ├── WatchlistPage.jsx      # Notre liste avec progression
│   │   ├── DetailPage.jsx         # Notes + Photos + Capsule + Citations
│   │   ├── LegendsPage.jsx        # GOAT & VIP
│   │   ├── FunPage.jsx            # Roue + Je pense à toi + Trophées + Dates
│   │   └── StatsPage.jsx          # Nos statistiques
│   └── components/
│       └── layout/Layout.jsx      # Navigation bas de page
├── supabase_schema.sql            # ← À coller dans Supabase SQL Editor
├── .env.example                   # ← À copier en .env et remplir
└── README.md                      # Ce fichier
```

---

## Questions fréquentes

**L'app ne s'ouvre pas ?**
→ Vérifie que toutes les variables dans `.env` sont bien remplies (pas d'espace autour du `=`)

**Les séries ne s'affichent pas dans la recherche ?**
→ Ta clé TMDB est peut-être incorrecte. Vérifie sur themoviedb.org

**Les GIFs ne fonctionnent pas ?**
→ Vérifie ta clé Giphy sur developers.giphy.com

**Je veux ajouter une fonctionnalité ?**
→ Dis-le à Claude dans le chat, il génère le code, tu remplaces le fichier et tu mets à jour GitHub.
