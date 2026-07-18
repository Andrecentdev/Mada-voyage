require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Connexion PostgreSQL (Supabase en production)
function buildPoolConfig(url) {
  if (!url) return {};
  const isRemote = !/localhost|127\.0\.0\.1/.test(url);
  return {
    connectionString: url,
    ssl: isRemote ? { rejectUnauthorized: false } : false
  };
}
const db = new Pool(buildPoolConfig(process.env.DATABASE_URL));
db.connect()
  .then(client => { client.release(); console.log('PostgreSQL connecté'); })
  .catch(err => { console.error('⚠️  Connexion DB échouée :', err.message); });

// Dossiers d'images
const DRIVERS_DIR = path.join(__dirname, 'public', 'images', 'drivers');
const DESTINATIONS_DIR = path.join(__dirname, 'public', 'images', 'destinations');
const TRIPS_DIR = path.join(__dirname, 'public', 'images', 'trips');
fs.mkdirSync(DRIVERS_DIR, { recursive: true });
fs.mkdirSync(DESTINATIONS_DIR, { recursive: true });
fs.mkdirSync(TRIPS_DIR, { recursive: true });

function makeUploader(destDir, prefix) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, destDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${prefix}-${Date.now()}${ext}`);
      }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
  });
}
const uploadDriver = makeUploader(DRIVERS_DIR, 'driver');
const uploadTrip = makeUploader(TRIPS_DIR, 'trip');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Convertit les colonnes NUMERIC en nombres JS
function toNumbers(row, keys) {
  const copy = { ...row };
  keys.forEach(k => { if (copy[k] !== null && copy[k] !== undefined) copy[k] = Number(copy[k]); });
  return copy;
}

// ---------- Authentification admin ----------
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12h

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DURATION_MS);
  return db.query(
    'INSERT INTO admin_sessions (token, admin_username, expires_at) VALUES ($1, $2, $3)',
    [token, username, expires]
  ).then(() => token);
}

async function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification admin requise' });
  try {
    const { rows } = await db.query(
      'SELECT * FROM admin_sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Session admin invalide ou expirée' });
    req.adminUsername = rows[0].admin_username;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function publicReservationView(row) {
  const r = toNumbers(row, ['total']);
  return {
    id: r.id, trip_id: r.trip_id, seats_count: r.seats_count, luggage: r.luggage,
    selected_seats: r.selected_seats, payment_method: r.payment_method, total: r.total,
    status: r.status, insurance: r.insurance, promo_code: r.promo_code, review: r.review,
    created_at: r.created_at, validated_at: r.validated_at,
    customer_name: r.customer_name, customer_phone: r.customer_phone, customer_email: r.customer_email
  };
}

// ---------- API publique ----------
app.get('/api/trips', (req, res) => {
  db.query('SELECT * FROM trips WHERE active = true ORDER BY departure_time')
    .then(({ rows }) => res.json(rows.map(r => toNumbers(r, ['price']))))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/occupied-seats/:tripId', (req, res) => {
  db.query('SELECT seat_number FROM occupied_seats WHERE trip_id = $1', [req.params.tripId])
    .then(({ rows }) => res.json(rows.map(r => r.seat_number)))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/reservations', async (req, res) => {
  const { trip_id, customer_name, customer_phone, customer_email, seats_count, luggage, selected_seats, payment_method, total, insurance, promo_code } = req.body;
  if (!trip_id || !customer_name || !seats_count || !selected_seats || !total) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  const id = 'MB-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO reservations (id, trip_id, customer_name, customer_phone, customer_email, seats_count, luggage, selected_seats, payment_method, total, status, insurance, promo_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'en_attente', $11, $12)`,
      [id, trip_id, customer_name, customer_phone, customer_email, seats_count, luggage, selected_seats, payment_method, total, !!insurance, promo_code]
    );
    const seats = selected_seats.split(',').map(Number);
    for (const seat of seats) {
      await client.query('INSERT INTO occupied_seats (trip_id, seat_number) VALUES ($1, $2)', [trip_id, seat]);
    }
    await client.query('COMMIT');
    res.json({ id, status: 'en_attente' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Recherche de SES PROPRES réservations
app.get('/api/reservations/lookup', (req, res) => {
  const query = String(req.query.query || '').trim();
  if (!query) return res.status(400).json({ error: 'Numéro de réservation ou email requis' });
  const isId = /^MB-/i.test(query);
  const sql = isId
    ? 'SELECT * FROM reservations WHERE id = $1'
    : 'SELECT * FROM reservations WHERE LOWER(customer_email) = LOWER($1) ORDER BY created_at DESC';
  db.query(sql, [query])
    .then(({ rows }) => res.json(rows.map(publicReservationView)))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.put('/api/reservations/:id/cancel', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT status FROM reservations WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Réservation introuvable' });
    if (['annulee', 'rejetee'].includes(rows[0].status)) {
      return res.status(400).json({ error: 'Cette réservation ne peut plus être annulée' });
    }
    await db.query('UPDATE reservations SET status = $1 WHERE id = $2', ['annulee', req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Changement de trajet (reschedule)
app.put('/api/reservations/:id/reschedule', async (req, res) => {
  const { new_trip_id } = req.body;
  if (!new_trip_id) return res.status(400).json({ error: 'Nouveau trajet requis' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: resRows } = await client.query('SELECT * FROM reservations WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (resRows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Réservation introuvable' }); }
    const reservation = resRows[0];
    if (!['en_attente', 'confirmee'].includes(reservation.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cette réservation ne peut plus être modifiée' });
    }
    const { rows: tripRows } = await client.query('SELECT * FROM trips WHERE id = $1 AND active = true', [new_trip_id]);
    if (tripRows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Trajet introuvable' }); }
    const newTrip = tripRows[0];

    const oldSeats = reservation.selected_seats.split(',').map(Number);
    await client.query('DELETE FROM occupied_seats WHERE trip_id = $1 AND seat_number = ANY($2::int[])', [reservation.trip_id, oldSeats]);

    const { rows: occRows } = await client.query('SELECT seat_number FROM occupied_seats WHERE trip_id = $1', [new_trip_id]);
    const takenOnNewTrip = new Set(occRows.map(r => r.seat_number));
    let newSeats = oldSeats.filter(s => !takenOnNewTrip.has(s));
    if (newSeats.length < oldSeats.length) {
      const needed = oldSeats.length - newSeats.length;
      const freeCandidates = [];
      for (let s = 1; s <= 22 && freeCandidates.length < needed; s++) {
        if (!takenOnNewTrip.has(s) && !newSeats.includes(s)) freeCandidates.push(s);
      }
      if (freeCandidates.length < needed) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Pas assez de sièges disponibles sur ce trajet' });
      }
      newSeats = newSeats.concat(freeCandidates);
    }
    for (const seat of newSeats) {
      await client.query('INSERT INTO occupied_seats (trip_id, seat_number) VALUES ($1, $2)', [new_trip_id, seat]);
    }

    const newTotal = Number(newTrip.price) * reservation.seats_count;
    const { rows: updated } = await client.query(
      `UPDATE reservations SET trip_id = $1, selected_seats = $2, total = $3, status = 'en_attente', validated_at = NULL
       WHERE id = $4 RETURNING *`,
      [new_trip_id, newSeats.join(','), newTotal, req.params.id]
    );
    await client.query('COMMIT');
    res.json(publicReservationView(updated[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await db.query('SELECT * FROM admins WHERE username = $1 AND password = $2', [username, password]);
    if (rows.length === 0) return res.status(401).json({ error: 'Identifiants incorrects' });
    const token = await createSession(username);
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/logout', requireAdmin, async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.slice(7);
  db.query('DELETE FROM admin_sessions WHERE token = $1', [token])
    .then(() => res.json({ success: true }))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/promos', (req, res) => {
  db.query('SELECT * FROM promos WHERE active = true')
    .then(({ rows }) => res.json(rows.map(r => toNumbers(r, ['value']))))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/drivers', (req, res) => {
  db.query('SELECT * FROM drivers ORDER BY created_at DESC')
    .then(({ rows }) => res.json(rows.map(r => toNumbers(r, ['rating', 'trips_completed']))))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/destination-images', (req, res) => {
  fs.readdir(DESTINATIONS_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });
    const images = files
      .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
      .map(f => ({ name: path.parse(f).name, url: `/images/destinations/${f}` }));
    res.json(images);
  });
});

// ---------- API admin ----------
app.get('/api/admin/reservations', requireAdmin, (req, res) => {
  db.query('SELECT * FROM reservations ORDER BY created_at DESC')
    .then(({ rows }) => res.json(rows.map(r => toNumbers(r, ['total']))))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.put('/api/admin/reservations/:id/validate', requireAdmin, (req, res) => {
  db.query(
    `UPDATE reservations SET status = 'confirmee', validated_at = NOW() WHERE id = $1 AND status = 'en_attente' RETURNING *`,
    [req.params.id]
  )
    .then(({ rows }) => {
      if (rows.length === 0) return res.status(400).json({ error: 'Réservation introuvable ou déjà traitée' });
      res.json({ success: true });
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

app.put('/api/admin/reservations/:id/reject', async (req, res) => {
  await requireAdmin(req, res, async () => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE reservations SET status = 'rejetee' WHERE id = $1 AND status = 'en_attente' RETURNING *`,
        [req.params.id]
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Réservation introuvable ou déjà traitée' });
      }
      const seats = rows[0].selected_seats.split(',').map(Number);
      for (const seat of seats) {
        await client.query('DELETE FROM occupied_seats WHERE trip_id = $1 AND seat_number = $2', [rows[0].trip_id, seat]);
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });
});

app.post('/api/admin/trips', requireAdmin, uploadTrip.single('photo'), (req, res) => {
  const { departure, destination, departure_time, duration, driver, price, image_url } = req.body;
  if (!departure || !destination || !departure_time || !price) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  const photo_url = req.file ? `/images/trips/${req.file.filename}` : (image_url || null);
  const id = 'T-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  db.query(
    `INSERT INTO trips (id, departure, destination, departure_time, duration, driver, price, image_url, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
    [id, departure, destination, departure_time, duration || '', driver || '', price, photo_url]
  )
    .then(({ rows }) => res.json(toNumbers(rows[0], ['price'])))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.put('/api/admin/trips/:id/deactivate', requireAdmin, (req, res) => {
  db.query('UPDATE trips SET active = false WHERE id = $1', [req.params.id])
    .then(() => res.json({ success: true }))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/admin/drivers', requireAdmin, uploadDriver.single('photo'), (req, res) => {
  const { name, phone, usual_route } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom est requis' });
  const photo_url = req.file ? `/images/drivers/${req.file.filename}` : null;
  db.query(
    `INSERT INTO drivers (name, phone, usual_route, photo_url) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, phone || null, usual_route || null, photo_url]
  )
    .then(({ rows }) => res.json(toNumbers(rows[0], ['rating', 'trips_completed'])))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/admin/customers', requireAdmin, (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Nom et téléphone requis' });
  db.query('INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING *', [name, phone])
    .then(({ rows }) => res.json(rows[0]))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/admin/customers', requireAdmin, (req, res) => {
  db.query('SELECT * FROM customers ORDER BY created_at DESC')
    .then(({ rows }) => res.json(rows))
    .catch(err => res.status(500).json({ error: err.message }));
});

// ---------- Routes des pages ----------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/reservation', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reservation.html')));
app.get('/sieges', (req, res) => res.sendFile(path.join(__dirname, 'public', 'seats.html')));
app.get('/paiement', (req, res) => res.sendFile(path.join(__dirname, 'public', 'payment.html')));
app.get('/confirmation', (req, res) => res.sendFile(path.join(__dirname, 'public', 'confirmation.html')));
app.get('/mes-reservations', (req, res) => res.sendFile(path.join(__dirname, 'public', 'my-reservations.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// 404
app.use((req, res) => res.status(404).send('<h1>Page introuvable</h1><a href="/">Retour à l\'accueil</a>'));

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));