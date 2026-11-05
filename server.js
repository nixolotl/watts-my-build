/* ============================================
   WattsMyBudget: web server
   Run with:  node server.js   then open http://localhost:3000
   It serves the website (public/ folder) AND the API (/api/...).
   ============================================ */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { priceCartItem, OrderError, ALLOWED_PAYMENTS } = require('./pricing');

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_DAYS = 14;
const COOKIE_NAME = 'wmb_session';

const app = express();
app.set('trust proxy', 1); // hosts like Render/Railway sit behind a proxy
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, isAdmin: !!u.is_admin });
const fail = (status, message) => Object.assign(new Error(message), { status });

/* ---------- sessions ---------- */
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());

function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const maxAge = SESSION_DAYS * 24 * 60 * 60 * 1000;
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
        .run(sha256(token), userId, Date.now() + maxAge);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge });
}

// Runs before every /api route: works out who is logged in (if anyone).
app.use('/api', (req, res, next) => {
    req.user = null;
    const token = req.cookies[COOKIE_NAME];
    if (token) {
        req.user = db.prepare(`
            SELECT u.id, u.name, u.email, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(token), Date.now()) || null;
    }
    next();
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a few minutes and try again.' }
});

/* ---------- accounts ---------- */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // makes "unknown email" take as long as "wrong password"

app.post('/api/register', authLimiter, wrap(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || name.length > 100) throw fail(400, 'Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) throw fail(400, 'Enter a valid email address.');
    if (password.length < 8) throw fail(400, 'Your password needs at least 8 characters.');
    if (password.length > 72) throw fail(400, 'Your password is too long (72 characters max).');

    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
        throw fail(409, 'An account with that email already exists. Try logging in.');
    }
    const hash = await bcrypt.hash(password, 12);
    const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, hash);
    const id = Number(info.lastInsertRowid);
    startSession(res, id);
    res.status(201).json({ user: { id, name, email } });
}));

app.post('/api/login', authLimiter, wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw fail(401, 'Wrong email or password.');
    startSession(res, user.id);
    res.json({ user: publicUser(user) });
}));

app.post('/api/logout', (req, res) => {
    const token = req.cookies[COOKIE_NAME];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

/* ---------- orders ---------- */
const insertOrder = db.prepare(`
    INSERT INTO orders (id, user_id, created_at, status, payment_method, payment_status, total,
                        customer_name, customer_email, customer_phone, customer_address, customer_city, customer_zip)
    VALUES (@id, @user_id, @created_at, 'Placed', @payment, 'unpaid', @total,
            @name, @email, @phone, @address, @city, @zip)`);
const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, build_id, name, price, qty, parts_json) VALUES (?, ?, ?, ?, ?, ?)`);
const saveOrderTx = db.transaction((order, items) => {
    insertOrder.run(order);
    for (const i of items) insertItem.run(order.id, i.buildId, i.name, i.price, i.qty, JSON.stringify(i.parts));
});

// Turns database rows into the same shape the website already expects.
function formatOrder(o) {
    const items = db.prepare('SELECT name, price, qty, parts_json FROM order_items WHERE order_id = ? ORDER BY id').all(o.id)
        .map((i) => ({ name: i.name, price: i.price, qty: i.qty, parts: JSON.parse(i.parts_json) }));
    return {
        id: o.id, createdAt: o.created_at, status: o.status,
        payment: o.payment_method, paymentStatus: o.payment_status, total: o.total,
        customer: { name: o.customer_name, email: o.customer_email, phone: o.customer_phone, address: o.customer_address, city: o.customer_city, zip: o.customer_zip },
        items
    };
}

// The browser already checks these, but the server must check again: never trust the browser.
function cleanCustomer(c) {
    c = c || {};
    const out = {
        name: String(c.name || '').trim(), email: String(c.email || '').trim().toLowerCase(),
        phone: String(c.phone || '').trim(), address: String(c.address || '').trim(),
        city: String(c.city || '').trim(), zip: String(c.zip || '').trim()
    };
    const bad = (msg) => { throw new OrderError(msg); };
    if (!out.name) bad('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(out.email)) bad('Enter a valid email address.');
    if (!/^(\+?63|0)9\d{9}$/.test(out.phone.replace(/[\s-]/g, ''))) bad('Enter a Philippine mobile number, like 09171234567.');
    if (!out.address) bad('Enter your street address and barangay.');
    if (!out.city) bad('Enter your city or municipality.');
    if (Object.values(out).some((s) => s.length > 200)) bad('One of the fields is too long.');
    return out;
}

app.post('/api/orders', wrap(async (req, res) => {
    const body = req.body || {};
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) throw new OrderError('Your cart is empty.');
    if (!ALLOWED_PAYMENTS.includes(body.payment)) throw new OrderError('Choose a payment method.');
    const customer = cleanCustomer(body.customer);

    const items = body.items.map(priceCartItem);                       // prices come from the server
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);  // and so does the total
    const createdAt = new Date().toISOString();
    const id = 'WMB-' + createdAt.slice(2, 10).replace(/-/g, '') + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

    saveOrderTx({
        id, user_id: req.user ? req.user.id : null, created_at: createdAt, payment: body.payment, total, ...customer
    }, items);

    res.status(201).json({ order: formatOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(id)) });
}));

app.get('/api/orders', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Log in to see your orders.' });
    const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json({ orders: rows.map(formatOrder) });
});

/* ---------- admin ---------- */
// An admin is a normal account with is_admin = 1. Make one with:  node make-admin.js you@example.com
const ORDER_STATUSES = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];

function requireAdmin(req, res, next) {
    res.set('Cache-Control', 'no-store');
    if (!req.user) return next(fail(401, 'Log in to use the admin page.'));
    if (!req.user.is_admin) return next(fail(403, 'This account is not an admin.'));
    next();
}

app.get('/api/admin/stats', requireAdmin, (req, res) => {
    const n = (sql, ...p) => db.prepare(sql).get(...p).n;
    const manila = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); // "today" in Philippine time
    const since = new Date(manila + 'T00:00:00+08:00').toISOString();
    const byStatus = db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all();
    res.json({
        orders: n('SELECT COUNT(*) AS n FROM orders'),
        today: n('SELECT COUNT(*) AS n FROM orders WHERE created_at >= ?', since),
        revenue: n("SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE status != 'Cancelled'"),
        paid: n("SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE payment_status = 'paid'"),
        customers: n('SELECT COUNT(*) AS n FROM users'),
        byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n]))
    });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
    const status = String(req.query.status || '');
    const q = String(req.query.q || '').trim().toLowerCase().replace(/[%_]/g, '');
    const where = [];
    const params = [];
    if (ORDER_STATUSES.includes(status)) { where.push('status = ?'); params.push(status); }
    if (q) {
        where.push('(lower(id) LIKE ? OR lower(customer_name) LIKE ? OR lower(customer_email) LIKE ?)');
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const rows = db.prepare(`SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                             ORDER BY created_at DESC LIMIT 200`).all(...params);
    res.json({ orders: rows.map(formatOrder) });
});

app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
    const { status, paymentStatus } = req.body || {};
    if (status !== undefined && !ORDER_STATUSES.includes(status)) throw fail(400, 'Unknown order status.');
    if (paymentStatus !== undefined && !PAYMENT_STATUSES.includes(paymentStatus)) throw fail(400, 'Unknown payment status.');
    const info = db.prepare('UPDATE orders SET status = COALESCE(?, status), payment_status = COALESCE(?, payment_status) WHERE id = ?')
        .run(status ?? null, paymentStatus ?? null, req.params.id);
    if (!info.changes) throw fail(404, 'Order not found.');
    res.json({ order: formatOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)) });
});

app.get('/api/admin/customers', requireAdmin, (req, res) => {
    res.json({ customers: db.prepare(`
            SELECT u.id, u.name, u.email, u.created_at AS createdAt, u.is_admin AS isAdmin, COUNT(o.id) AS orders,
                   COALESCE(SUM(CASE WHEN o.status != 'Cancelled' THEN o.total END), 0) AS spent
            FROM users u LEFT JOIN orders o ON o.user_id = u.id
            GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`).all() });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

/* ---------- the website itself ---------- */
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- errors ---------- */
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request.' });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

app.listen(PORT, () => console.log(`WattsMyBudget running at http://localhost:${PORT}`));