/* ============================================
   WattsMyBudget: small script for the About, Shipping, Returns and Contact pages
   Needs shared.js and auth-ui.js loaded first.
   ============================================ */
(() => {
    'use strict';

    // CHANGE THIS to your real email address. It is the only place you need to edit it.
    const CONTACT_EMAIL = 'hello@wattsmybudget.com';

    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    document.querySelectorAll('[data-contact-email]').forEach((el) => {
        el.textContent = CONTACT_EMAIL;
        if (el.tagName === 'A') el.href = 'mailto:' + CONTACT_EMAIL;
    });

    /* ---------- contact form: opens the visitor's email app ---------- */
    const form = document.getElementById('contact-form');
    if (!form) return;

    const nameEl = document.getElementById('c-name');
    const emailEl = document.getElementById('c-email');
    const messageEl = document.getElementById('c-message');
    const errorEl = document.getElementById('contact-error');

    function showError(text, field) {
        errorEl.textContent = text;
        errorEl.hidden = !text;
        if (field) field.focus();
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameEl.value.trim();
        const email = emailEl.value.trim();
        const message = messageEl.value.trim();

        if (!name) return showError('Enter your name.', nameEl);
        if (!/^\S+@\S+\.\S+$/.test(email)) return showError('Enter a valid email address.', emailEl);
        if (message.length < 5) return showError('Write a short message.', messageEl);
        showError('');

        const subject = 'WattsMyBudget message from ' + name;
        const body = message + '\n\n' + name + '\n' + email;
        window.location.href = 'mailto:' + CONTACT_EMAIL +
            '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });
})();