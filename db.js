/* ============================================
   WattsMyBudget: database (PostgreSQL)
   Set DATABASE_URL in .env (local) or in the Vercel project settings (online).
   Create the tables once with:  npm run setup-db
   ============================================ */
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: local ? false : { rejectUnauthorized: false }, // hosted databases (Neon, Supabase...) need SSL
    max: process.env.VERCEL ? 3 : 10                    // serverless: keep few connections per instance
});

// Used everywhere: await query('SELECT ... WHERE id = $1', [id]) -> rows
const query = (text, params) => pool.query(text, params).then((r) => r.rows);

module.exports = { pool, query };