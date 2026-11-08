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
const { pool, query } = require('./db');
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
query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]).catch((err) => console.error('Session cleanup failed:', err.message));

async function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const maxAge = SESSION_DAYS * 24 * 60 * 60 * 1000;
    await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
        [sha256(token), userId, Date.now() + maxAge]);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge });
}

// Runs before every /api route: works out who is logged in (if anyone).
app.use('/api', wrap(async (req, res, next) => {
    req.user = null;
    const token = req.cookies[COOKIE_NAME];
    if (token) {
        const rows = await query(`
            SELECT u.id, u.name, u.email, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = $1 AND s.expires_at > $2`, [sha256(token), Date.now()]);
        req.user = rows[0] || null;
    }
    next();
}));

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

    const taken = 'An account with that email already exists. Try logging in.';
    if ((await query('SELECT 1 FROM users WHERE email = $1', [email])).length) throw fail(409, taken);
    const hash = await bcrypt.hash(password, 12);
    let id;
    try {
        id = (await query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id', [name, email, hash]))[0].id;
    } catch (err) {
        if (err.code === '23505') throw fail(409, taken); // two sign-ups with the same email at the same moment
        throw err;
    }
    await startSession(res, id);
    res.status(201).json({ user: { id, name, email, isAdmin: false } });
}));

app.post('/api/login', authLimiter, wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = (await query('SELECT * FROM users WHERE email = $1', [email]))[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw fail(401, 'Wrong email or password.');
    await startSession(res, user.id);
    res.json({ user: publicUser(user) });
}));

app.post('/api/logout', wrap(async (req, res) => {
    const token = req.cookies[COOKIE_NAME];
    if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
}));

app.get('/api/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

/* ---------- orders ---------- */
// Saves the order and its items in one transaction: either everything is stored or nothing is.
async function saveOrder(order, items) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            INSERT INTO orders (id, user_id, created_at, status, payment_method, payment_status, total,
                                customer_name, customer_email, customer_phone, customer_address, customer_city, customer_zip)
            VALUES ($1, $2, $3, 'Placed', $4, 'unpaid', $5, $6, $7, $8, $9, $10, $11)`,
            [order.id, order.user_id, order.created_at, order.payment, order.total,
                order.name, order.email, order.phone, order.address, order.city, order.zip]);
        for (const i of items) {
            await client.query('INSERT INTO order_items (order_id, build_id, name, price, qty, parts_json) VALUES ($1, $2, $3, $4, $5, $6)',
                [order.id, i.buildId, i.name, i.price, i.qty, JSON.stringify(i.parts)]);
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

// Turns database rows into the same shape the website already expects.
// Loads the items for several orders with ONE query, then builds the objects the website expects.
async function formatOrders(rows) {
    if (!rows.length) return [];
    const itemRows = await query(
        'SELECT order_id, name, price, qty, parts_json FROM order_items WHERE order_id = ANY($1) ORDER BY id',
        [rows.map((o) => o.id)]);
    const byOrder = {};
    for (const i of itemRows) {
        (byOrder[i.order_id] ||= []).push({ name: i.name, price: i.price, qty: i.qty, parts: JSON.parse(i.parts_json) });
    }
    return rows.map((o) => formatOrder(o, byOrder[o.id] || []));
}

function formatOrder(o, items) {
    return {
        id: o.id, createdAt: new Date(o.created_at).toISOString(), status: o.status,
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

    await saveOrder({
        id, user_id: req.user ? req.user.id : null, created_at: createdAt, payment: body.payment, total, ...customer
    }, items);

    const saved = await formatOrders(await query('SELECT * FROM orders WHERE id = $1', [id]));
    res.status(201).json({ order: saved[0] });
}));

app.get('/api/orders', wrap(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Log in to see your orders.' });
    const rows = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ orders: await formatOrders(rows) });
}));

/* ---------- admin ---------- */
// An admin is a normal account with is_admin = true. Make one with:  node --env-file=.env make-admin.js you@example.com
const ORDER_STATUSES = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];

function requireAdmin(req, res, next) {
    res.set('Cache-Control', 'no-store');
    if (!req.user) return next(fail(401, 'Log in to use the admin page.'));
    if (!req.user.is_admin) return next(fail(403, 'This account is not an admin.'));
    next();
}

app.get('/api/admin/stats', requireAdmin, wrap(async (req, res) => {
    const manila = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); // "today" in Philippine time
    const since = new Date(manila + 'T00:00:00+08:00').toISOString();
    // ::int because Postgres returns COUNT/SUM as text unless we cast them
    const [totals] = await query(`
        SELECT COUNT(*)::int AS orders,
               COUNT(*) FILTER (WHERE created_at >= $1)::int AS today,
               COALESCE(SUM(total) FILTER (WHERE status != 'Cancelled'), 0)::int AS revenue,
               COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0)::int AS paid
        FROM orders`, [since]);
    const [{ n: customers }] = await query('SELECT COUNT(*)::int AS n FROM users');
    const byStatus = await query('SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status');
    res.json({ ...totals, customers, byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])) });
}));

app.get('/api/admin/orders', requireAdmin, wrap(async (req, res) => {
    const status = String(req.query.status || '');
    const q = String(req.query.q || '').trim().toLowerCase().replace(/[%_\\]/g, '');
    const where = [];
    const params = [];
    if (ORDER_STATUSES.includes(status)) { params.push(status); where.push(`status = $${params.length}`); }
    if (q) {
        params.push(`%${q}%`);
        const p = `$${params.length}`;
        where.push(`(lower(id) LIKE ${p} OR lower(customer_name) LIKE ${p} OR lower(customer_email) LIKE ${p})`);
    }
    const rows = await query(`SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                              ORDER BY created_at DESC LIMIT 200`, params);
    res.json({ orders: await formatOrders(rows) });
}));

app.patch('/api/admin/orders/:id', requireAdmin, wrap(async (req, res) => {
    const { status, paymentStatus } = req.body || {};
    if (status !== undefined && !ORDER_STATUSES.includes(status)) throw fail(400, 'Unknown order status.');
    if (paymentStatus !== undefined && !PAYMENT_STATUSES.includes(paymentStatus)) throw fail(400, 'Unknown payment status.');
    const rows = await query('UPDATE orders SET status = COALESCE($1, status), payment_status = COALESCE($2, payment_status) WHERE id = $3 RETURNING *',
        [status ?? null, paymentStatus ?? null, req.params.id]);
    if (!rows.length) throw fail(404, 'Order not found.');
    res.json({ order: (await formatOrders(rows))[0] });
}));

app.get('/api/admin/customers', requireAdmin, wrap(async (req, res) => {
    res.json({ customers: await query(`
            SELECT u.id, u.name, u.email, u.created_at AS "createdAt", u.is_admin AS "isAdmin", COUNT(o.id)::int AS orders,
                   COALESCE(SUM(CASE WHEN o.status != 'Cancelled' THEN o.total END), 0)::int AS spent
            FROM users u LEFT JOIN orders o ON o.user_id = u.id
            GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`) });
}));

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

// Vercel runs the app as a function (no listen). Locally, start a normal server.
if (require.main === module) {
    app.listen(PORT, () => console.log(`WattsMyBudget running at http://localhost:${PORT}`));
}
module.exports = app;