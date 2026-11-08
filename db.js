/* ============================================
   WattsMyBuild: database connection (Postgres)
   The connection link comes from the DATABASE_URL environment variable
   (a local .env file on your computer, Environment Variables on Vercel).
   Create the tables once with:  npm run setup-db

   query(sql, params) -> the full result ({ rows, rowCount })
   many(sql, params)  -> an array of rows
   one(sql, params)   -> the first row, or null
   ============================================ */
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Keep the pool small: on Vercel every running copy of the app opens its own connections.
const pool = new Pool({ connectionString: connectionString || undefined, max: 5 });
pool.on('error', (err) => console.error('Database connection error:', err.message));

// A missing link must not crash the whole site on start-up. It is reported clearly
// (in the logs and as a normal error) the first time the database is needed.
function requireLink() {
    if (!connectionString) {
        throw new Error('No database link found. Set DATABASE_URL (see README.md).');
    }
}

const query = async (text, params) => { requireLink(); return pool.query(text, params); };
const many = async (text, params) => (await query(text, params)).rows;
const one = async (text, params) => (await query(text, params)).rows[0] || null;

// Runs several queries as one all-or-nothing step.
async function transaction(fn) {
    requireLink();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, query, many, one, transaction };