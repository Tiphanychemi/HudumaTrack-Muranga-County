
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('./db');

if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  throw new Error('Configure JWT_SECRET and DATABASE_URL in the backend environment.');
}

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '1mb' }));

const categories = [
  'Power Outage',
  'Street Lighting',
  'Water and Sanitation',
  'Garbage Collection',
  'Electricity',
  'Road Maintenance',
  'Drainage',
  'Other'
];

const statuses = ['Pending', 'In Progress', 'Resolved'];

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const extensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!extensions[file.mimetype]) {
      return callback(new Error('Only JPEG, PNG and WebP images are supported'));
    }
    callback(null, true);
  }
});

const wrap = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      message: 'Please sign in again.'
    });
  }
}

function admin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      message: 'Administrator access required.'
    });
  }
  next();
}

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Register
app.post('/api/auth/register', authLimit, wrap(async (req, res) => {
  const { full_name, email, password } = req.body || {};

  if (
    typeof full_name !== 'string' ||
    !full_name.trim() ||
    full_name.length > 120 ||
    typeof email !== 'string' ||
    email.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 72
  ) {
    return res.status(400).json({
      message: 'Provide a name, valid email and password (8–72 characters).'
    });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users(full_name, email, password_hash)
       VALUES($1, $2, $3)
       RETURNING id, full_name, email, role`,
      [full_name.trim(), email.trim().toLowerCase(), hash]
    );

    res.status(201).json({ user: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'Email already registered.'
      });
    }
    throw error;
  }
}));

// Login
app.post('/api/auth/login', authLimit, wrap(async (req, res) => {
  const { email, password } = req.body || {};

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    password.length > 72
  ) {
    return res.status(400).json({ message: 'Invalid login.' });
  }

  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email=$1',
    [email.trim().toLowerCase()]
  );

  const user = rows[0];

  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({
      message: 'Incorrect email or password.'
    });
  }

  res.json({
    token: jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    ),
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role
    }
  });
}));

// Citizen requests
app.get('/api/requests', auth, wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM service_requests WHERE user_id=$1 ORDER BY created_at DESC',
    [req.user.id]
  );

  res.json(rows);
}));

// Submit a new service request
app.post('/api/requests', auth, upload.single('image'), wrap(async (req, res) => {
  const {
    category,
    location,
    description,
    outage_started_at
  } = req.body;

  if (
    !categories.includes(category) ||
    typeof location !== 'string' ||
    !location.trim() ||
    location.length > 500 ||
    typeof description !== 'string' ||
    !description.trim() ||
    description.length > 5000
  ) {
    return res.status(400).json({
      message: 'Provide a valid category, location and description.'
    });
  }

  if (
    outage_started_at &&
    (
      category !== 'Power Outage' ||
      !Number.isFinite(Date.parse(outage_started_at))
    )
  ) {
    return res.status(400).json({
      message: 'Invalid outage date.'
    });
  }

  if (req.file) {
    const buffer = req.file.buffer;
    const mime = req.file.mimetype;

    const valid =
      (mime === 'image/jpeg' &&
        buffer[0] === 255 &&
        buffer[1] === 216 &&
        buffer[2] === 255) ||
      (mime === 'image/png' &&
        buffer.subarray(0, 8).equals(
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        )) ||
      (mime === 'image/webp' &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP');

    if (!valid) {
      return res.status(400).json({
        message: 'Invalid image file.'
      });
    }
  }

  const client = await pool.connect();
  let filename = null;

  try {
    await client.query('BEGIN');

    const reference =
      'PSR-' +
      crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();

    if (req.file) {
      filename = crypto.randomUUID() + extensions[req.file.mimetype];

      await fs.promises.writeFile(
        path.join(uploadDir, filename),
        req.file.buffer
      );
    }

    const { rows } = await client.query(
      `INSERT INTO service_requests
       (reference_number, user_id, category, location, description, image_path, outage_started_at)
       VALUES($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        reference,
        req.user.id,
        category,
        location.trim(),
        description.trim(),
        filename,
        outage_started_at || null
      ]
    );

    await client.query(
      `INSERT INTO request_status_history
       (request_id, new_status, changed_by)
       VALUES($1, 'Pending', $2)`,
      [rows[0].id, req.user.id]
    );

    await client.query('COMMIT');

    res.status(201).json({ request: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');

    if (filename) {
      await fs.promises.unlink(
        path.join(uploadDir, filename)
      ).catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}));

// Retrieve a request image
app.get('/api/requests/:id/image', auth, wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT user_id, image_path FROM service_requests WHERE id=$1',
    [req.params.id]
  );

  const request = rows[0];

  if (
    !request ||
    !request.image_path ||
    (req.user.role !== 'admin' && request.user_id !== req.user.id)
  ) {
    return res.sendStatus(404);
  }

  res.sendFile(
    path.join(uploadDir, path.basename(request.image_path))
  );
}));

// Retrieve request details and history
app.get('/api/requests/:id', auth, wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM service_requests
     WHERE id=$1 AND (user_id=$2 OR $3)`,
    [req.params.id, req.user.id, req.user.role === 'admin']
  );

  if (!rows.length) {
    return res.sendStatus(404);
  }

  const history = await pool.query(
    `SELECT old_status, new_status, changed_at
     FROM request_status_history
     WHERE request_id=$1
     ORDER BY changed_at`,
    [req.params.id]
  );

  res.json({
    request: rows[0],
    history: history.rows
  });
}));

// Admin: all requests
app.get('/api/admin/requests', auth, admin, wrap(async (req, res) => {
  const where = [];
  const values = [];

  if (statuses.includes(req.query.status)) {
    values.push(req.query.status);
    where.push('r.status=$' + values.length);
  }

  if (categories.includes(req.query.category)) {
    values.push(req.query.category);
    where.push('r.category=$' + values.length);
  }

  const { rows } = await pool.query(
    `SELECT r.*, u.full_name AS citizen_name, u.email AS citizen_email
     FROM service_requests r
     JOIN users u ON u.id=r.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY r.created_at DESC`,
    values
  );

  res.json(rows);
}));

// Admin: kuupdate request status
app.patch('/api/admin/requests/:id', auth, admin, wrap(async (req, res) => {
  const { status, power_restored } = req.body || {};

  if (status !== undefined && !statuses.includes(status)) {
    return res.status(400).json({
      message: 'Invalid status.'
    });
  }

  if (
    power_restored !== undefined &&
    typeof power_restored !== 'boolean'
  ) {
    return res.status(400).json({
      message: 'Invalid restoration value.'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT * FROM service_requests WHERE id=$1 FOR UPDATE',
      [req.params.id]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.sendStatus(404);
    }

    const request = rows[0];

    if (
      power_restored !== undefined &&
      request.category !== 'Power Outage'
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Restoration applies only to power outages.'
      });
    }

    const nextStatus = status ?? request.status;

    await client.query(
      `UPDATE service_requests
       SET status=$1, power_restored=$2, updated_at=NOW()
       WHERE id=$3`,
      [
        nextStatus,
        power_restored ?? request.power_restored,
        request.id
      ]
    );

    if (nextStatus !== request.status) {
      await client.query(
        `INSERT INTO request_status_history
         (request_id, old_status, new_status, changed_by)
         VALUES($1, $2, $3, $4)`,
        [
          request.id,
          request.status,
          nextStatus,
          req.user.id
        ]
      );
    }

    await client.query('COMMIT');

    res.json({ message: 'Request updated.' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Admin analytics
app.get('/api/admin/analytics', auth, admin, wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER(WHERE status='Pending')::int AS pending,
      COUNT(*) FILTER(WHERE status='In Progress')::int AS in_progress,
      COUNT(*) FILTER(WHERE status='Resolved')::int AS resolved,
      COUNT(*) FILTER(
        WHERE category='Power Outage' AND NOT power_restored
      )::int AS outages_unrestored
     FROM service_requests`
  );

  const stats = rows[0];

  res.json({
    ...stats,
    open: stats.pending + stats.in_progress,
    resolution_rate: stats.total
      ? Math.round(stats.resolved / stats.total * 100)
      : 0
  });
}));

// Error handling
app.use((error, req, res, next) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      message: 'Image exceeds 5 MB or upload is invalid.'
    });
  }

  if (error.code === '22P02') {
    return res.status(400).json({
      message: 'Invalid request ID.'
    });
  }

  if (error.message?.startsWith('Only JPEG')) {
    return res.status(400).json({
      message: error.message
    });
  }

  if (error.message === 'Origin not allowed by CORS') {
    return res.status(403).json({
      message: 'Origin not allowed.'
    });
  }

  res.status(500).json({
    message: 'Server error. Check backend logs.'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`HudumaTrack API running on port ${PORT}`);
});
