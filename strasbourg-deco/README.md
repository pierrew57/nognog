# Maisons Décorées - Strasbourg

Un site web pour découvrir, noter et ajouter les maisons décorées à Strasbourg pendant la période des fêtes.

## Fonctionnalités

- **Recherche** : Trouvez des maisons par adresse ou quartier
- **Carte interactive** : Visualisez les maisons décorées sur une carte (Leaflet + OpenStreetMap)
- **Notation** : Donnez une note (1-5 étoiles) et ajoutez des commentaires
- **Contribution** : Ajoutez de nouvelles maisons à la liste
- **Filtrage** : Filtrez par quartier
- **Design responsive** : Adapté mobile et desktop

## Prérequis

- Node.js (version 14 ou supérieure)
- npm ou yarn

## Installation

```bash
# Aller dans le dossier du projet
cd strasbourg-deco

# Installer les dépendances du backend
cd backend
npm install

# Revenir à la racine
cd ..
```

## Démarrage

### Mode développement
```bash
cd backend
npm run dev
```
Le serveur démarrera sur `http://localhost:3000` avec rechargement automatique.

### Mode production
```bash
cd backend
npm start
```
Le serveur démarrera sur `http://localhost:3000`.

## Structure du projet

```
strasbourg-deco/
├── backend/
│   ├── server.js          # Serveur Express avec API REST
│   ├── package.json
│   └── .gitignore
├── frontend/
│   ├── index.html          # Page principale
│   ├── styles.css          # Styles CSS
│   └── app.js              # Logique frontend
├── package.json
└── README.md
```

## API REST

### Maisons
- `GET /api/maisons` - Liste toutes les maisons (avec pagination: `limit`, `offset`)
- `GET /api/maisons/:id` - Détails d'une maison
- `POST /api/maisons` - Ajouter une maison
- `DELETE /api/maisons/:id` - Supprimer une maison

### Notes
- `GET /api/maisons/:id/notes` - Liste des notes pour une maison
- `POST /api/maisons/:id/notes` - Ajouter une note (note: 1-5, commentaire: optionnel)
- `GET /api/maisons/:id/note-moyenne` - Note moyenne et nombre d'avis

### Recherche
- `GET /api/recherche?q=terme` - Rechercher des maisons
- `GET /api/quartiers` - Liste des quartiers avec compte

## Base de données

La base de données SQLite (`strasbourg_deco.db`) est créée automatiquement au premier démarrage avec deux tables :
- `maisons` : Adresse, quartier, description, coordonnées, image
- `notes` : Note (1-5), commentaire, date, lien vers la maison

## Déploiement

### Sur Heroku
```bash
heroku create
 git push heroku main
```

### Avec Docker
```dockerfile
FROM node:18
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend ./
EXPOSE 3000
CMD ["node", "server.js"]
```

### Sur un VPS (avec PM2)
```bash
npm install -g pm2
pm2 start backend/server.js --name strasbourg-deco
pm2 save
pm2 startup
```

## Quartiers par défaut
Les quartiers de Strasbourg sont prédéfinis dans le formulaire :
- Centre-Ville
- Petite France
- Krutenau
- Neustadt
- Saint-Jean
- Montagne Verte
- Orangerie
- Contades
- Koenigshoffen
- Cronenbourg
- Hohberg
- Autre

## Technologies utilisées
- **Backend**: Node.js, Express, SQLite3
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Carte**: Leaflet.js + OpenStreetMap
- **Design**: Font Awesome, Google Fonts (Roboto)

## Contribution
Les contributions sont les bienvenues ! Ouvrez une issue ou soumettez une pull request.

## Licence
MIT
