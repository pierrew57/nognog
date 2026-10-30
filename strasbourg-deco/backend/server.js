const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialisation de la base de données
const db = new sqlite3.Database('./strasbourg_deco.db', (err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    // Table des maisons
    db.run(`
      CREATE TABLE IF NOT EXISTS maisons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adresse TEXT NOT NULL,
        quartier TEXT NOT NULL,
        description TEXT,
        latitude REAL,
        longitude REAL,
        image_url TEXT,
        date_ajout TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des notes
    db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        maison_id INTEGER NOT NULL,
        note INTEGER NOT NULL CHECK (note >= 1 AND note <= 5),
        commentaire TEXT,
        date_note TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (maison_id) REFERENCES maisons(id) ON DELETE CASCADE
      )
    `);

    // Index pour les recherches
    db.run(`CREATE INDEX IF NOT EXISTS idx_maisons_quartier ON maisons(quartier)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notes_maison ON notes(maison_id)`);
  });
}

// Routes pour les maisons
app.get('/api/maisons', (req, res) => {
  const { quartier, limit = 50, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM maisons';
  const params = [];
  
  if (quartier) {
    query += ' WHERE quartier = ?';
    params.push(quartier);
  }
  
  query += ' ORDER BY date_ajout DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/maisons/:id', (req, res) => {
  const id = req.params.id;
  
  db.get('SELECT * FROM maisons WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Maison non trouvée' });
    }
    res.json(row);
  });
});

app.post('/api/maisons', (req, res) => {
  const { adresse, quartier, description, latitude, longitude, image_url } = req.body;
  
  if (!adresse || !quartier) {
    return res.status(400).json({ error: 'Adresse et quartier sont requis' });
  }
  
  const stmt = db.prepare(`
    INSERT INTO maisons (adresse, quartier, description, latitude, longitude, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run([adresse, quartier, description || '', latitude || null, longitude || null, image_url || null], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, ...req.body });
  });
  
  stmt.finalize();
});

app.delete('/api/maisons/:id', (req, res) => {
  const id = req.params.id;
  
  db.run('DELETE FROM maisons WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Maison non trouvée' });
    }
    res.json({ message: 'Maison supprimée avec succès' });
  });
});

// Routes pour les notes
app.get('/api/maisons/:id/notes', (req, res) => {
  const maisonId = req.params.id;
  
  db.all('SELECT * FROM notes WHERE maison_id = ? ORDER BY date_note DESC', [maisonId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/maisons/:id/note-moyenne', (req, res) => {
  const maisonId = req.params.id;
  
  db.get(`
    SELECT 
      COUNT(*) as count,
      AVG(note) as moyenne
    FROM notes 
    WHERE maison_id = ?
  `, [maisonId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      count: row.count || 0,
      moyenne: row.moyenne ? parseFloat(row.moyenne.toFixed(2)) : 0
    });
  });
});

app.post('/api/maisons/:id/notes', (req, res) => {
  const maisonId = req.params.id;
  const { note, commentaire } = req.body;
  
  if (!note || note < 1 || note > 5) {
    return res.status(400).json({ error: 'La note doit être entre 1 et 5' });
  }
  
  // Vérifier que la maison existe
  db.get('SELECT id FROM maisons WHERE id = ?', [maisonId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Maison non trouvée' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO notes (maison_id, note, commentaire)
      VALUES (?, ?, ?)
    `);
    
    stmt.run([maisonId, note, commentaire || ''], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, maison_id: maisonId, note, commentaire });
    });
    
    stmt.finalize();
  });
});

// Route pour les quartiers
app.get('/api/quartiers', (req, res) => {
  db.all(`
    SELECT quartier, COUNT(*) as count 
    FROM maisons 
    GROUP BY quartier 
    ORDER BY count DESC, quartier
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Route pour la recherche
app.get('/api/recherche', (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.json([]);
  }
  
  const searchTerm = `%${q}%`;
  
  db.all(`
    SELECT * FROM maisons 
    WHERE adresse LIKE ? OR quartier LIKE ? OR description LIKE ?
    ORDER BY date_ajout DESC
    LIMIT 20
  `, [searchTerm, searchTerm, searchTerm], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Servir le frontend pour toutes les autres routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

// Gestion de la fermeture
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Erreur lors de la fermeture de la base de données:', err.message);
    } else {
      console.log('Base de données fermée.');
    }
    process.exit(0);
  });
});

module.exports = app;
