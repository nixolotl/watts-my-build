/* Usage:  node --env-file=.env make-admin.js you@example.com [--remove]
   The account must already exist (create it on the website first). */
const { pool } = require('./db');

const email = String(process.argv[2] || '').trim().toLowerCase();
const flag = !process.argv.includes('--remove');
if (!email) {
    console.log('Usage: node --env-file=.env make-admin.js you@example.com [--remove]');
    process.exit(1);
}
pool.query('UPDATE users SET is_admin = $1 WHERE email = $2', [flag, email])
    .then((r) => console.log(r.rowCount
        ? `${email} is ${flag ? 'now' : 'no longer'} an admin.`
        : `No account with the email ${email}. Create it on the website first, then run this again.`))
    .catch((err) => { console.error(err.message); process.exitCode = 1; })
    .finally(() => pool.end());