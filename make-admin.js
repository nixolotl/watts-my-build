/* Usage:  node make-admin.js you@example.com [--remove]
   The account must already exist (create it on the website first). */
const db = require('./db');

const email = String(process.argv[2] || '').trim().toLowerCase();
const flag = process.argv.includes('--remove') ? 0 : 1;
if (!email) {
    console.log('Usage: node make-admin.js you@example.com [--remove]');
    process.exit(1);
}
const info = db.prepare('UPDATE users SET is_admin = ? WHERE email = ?').run(flag, email);
console.log(info.changes
    ? `${email} is ${flag ? 'now' : 'no longer'} an admin.`
    : `No account with the email ${email}. Create it on the website first, then run this again.`);
