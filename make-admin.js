/* Usage:  node --env-file=.env make-admin.js you@example.com [--remove]
   The account must already exist (create it on the website first). */
const { pool, query } = require('./db');

const email = String(process.argv[2] || '').trim().toLowerCase();
const makeAdmin = !process.argv.includes('--remove');

async function main() {
    if (!email) {
        console.log('Usage: node --env-file=.env make-admin.js you@example.com [--remove]');
        process.exitCode = 1;
        return;
    }
    const result = await query('UPDATE users SET is_admin = $1 WHERE email = $2', [makeAdmin, email]);
    console.log(result.rowCount
        ? `${email} is ${makeAdmin ? 'now' : 'no longer'} an admin.`
        : `No account with the email ${email}. Create it on the website first, then run this again.`);
}

main()
    .catch((err) => { console.error('Failed:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());