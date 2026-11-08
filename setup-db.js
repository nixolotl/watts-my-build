/* Creates the tables. Safe to run more than once.
   Usage:  npm run setup-db        (or: node --env-file=.env setup-db.js) */
const { pool, query } = require('./db');

const SQL = `
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only a hash of the session token is stored, so a leaked database can't be used to log in.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id               TEXT PRIMARY KEY,
    user_id          INTEGER REFERENCES users(id),   -- NULL for guest orders
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    status           TEXT NOT NULL DEFAULT 'Placed',
    payment_method   TEXT NOT NULL,
    payment_status   TEXT NOT NULL DEFAULT 'unpaid',
    total            INTEGER NOT NULL,
    customer_name    TEXT NOT NULL,
    customer_email   TEXT NOT NULL,
    customer_phone   TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    customer_city    TEXT NOT NULL,
    customer_zip     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    build_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    price      INTEGER NOT NULL,   -- price at the time of purchase
    qty        INTEGER NOT NULL,
    parts_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user      ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created   ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`;

query(SQL)
    .then(() => console.log('Tables are ready.'))
    .catch((err) => { console.error('Could not create the tables:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());