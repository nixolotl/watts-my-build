/* ============================================
   WattsMyBudget: database (SQLite, one file: data.sqlite)
   The tables are created automatically the first time the server starts.
   ============================================ */
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Only a hash of the session token is stored, so a leaked database can't be used to log in.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id               TEXT PRIMARY KEY,
    user_id          INTEGER REFERENCES users(id),   -- NULL for guest orders
    created_at       TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'Placed',
    payment_method   TEXT NOT NULL,
    payment_status   TEXT NOT NULL DEFAULT 'unpaid',  -- PayMongo will update this later
    total            INTEGER NOT NULL,
    customer_name    TEXT NOT NULL,
    customer_email   TEXT NOT NULL,
    customer_phone   TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    customer_city    TEXT NOT NULL,
    customer_zip     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    build_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    price      INTEGER NOT NULL,   -- price at the time of purchase
    qty        INTEGER NOT NULL,
    parts_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
`);

module.exports = db;
