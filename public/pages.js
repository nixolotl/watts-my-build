/* ============================================
   WattsMyBuild: small script for the About, Shipping, Returns and Contact pages
   Needs shared.js and auth-ui.js loaded first.
   ============================================ */
(() => {
    'use strict';

    // CHANGE THIS to your real email address. It is shown on the Contact page.
    const CONTACT_EMAIL = 'hello@wattsmybuild.com';

    // Your Formspree form endpoint (from the Formspree dashboard).
    const FORMSPREE_URL = 'https://formspree.io/f/meaawwza';

    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    document.querySelectorAll('[data-contact-email]').forEach((el) => {
        el.textContent = CONTACT_EMAIL;
        if (el.tagName === 'A') el.href = 'mailto:' + CONTACT_EMAIL;
    });

    /* ---------- contact form: sends the message through Formspree ---------- */
    const form = document.getElementById('contact-form');
    if (!form) return;

    const nameEl = document.getElementById('c-name');
    const emailEl = document.getElementById('c-email');
    const messageEl = document.getElementById('c-message');
    const trapEl = document.getElementById('c-gotcha');       // hidden field that only bots fill in
    const sendBtn = document.getElementById('contact-send');
    const errorEl = document.getElementById('contact-error');
    const successEl = document.getElementById('contact-success');

    function showError(text, field) {
        errorEl.textContent = text;
        errorEl.hidden = !text;
        if (field) field.focus();
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        successEl.hidden = true;

        const name = nameEl.value.trim();
        const email = emailEl.value.trim();
        const message = messageEl.value.trim();

        if (!name) return showError('Enter your name.', nameEl);
        if (!/^\S+@\S+\.\S+$/.test(email)) return showError('Enter a valid email address.', emailEl);
        if (message.length < 5) return showError('Write a short message.', messageEl);
        if (message.length > 5000) return showError('Your message is too long.', messageEl);
        if (trapEl && trapEl.value) return; // a bot filled the hidden field: quietly ignore it
        if (!FORMSPREE_URL || FORMSPREE_URL.includes('YOUR_FORM_ID')) {
            return showError('The contact form is not set up yet. Please email us at ' + CONTACT_EMAIL + '.');
        }
        showError('');

        sendBtn.disabled = true; // Formspree asks that the button stays off until it answers
        const originalLabel = sendBtn.textContent;
        sendBtn.textContent = 'Sending...';
        try {
            const res = await fetch(FORMSPREE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    name, email, message,
                    _subject: 'WattsMyBuild message from ' + name
                })
            });
            if (res.ok) {
                form.reset();
                successEl.textContent = 'Thank you! Your message was sent. We will reply to ' + email + '.';
                successEl.hidden = false;
            } else if (res.status === 429) {
                showError('Too many messages right now. Please wait a minute and try again.');
            } else {
                let detail = '';
                try {
                    const data = await res.json();
                    detail = (data.errors || []).map((x) => x.message).join(' ');
                } catch { /* no details */ }
                showError(detail || 'Your message could not be sent. Please email us at ' + CONTACT_EMAIL + '.');
            }
        } catch {
            showError('Could not reach the server. Please check your connection or email us at ' + CONTACT_EMAIL + '.');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = originalLabel;
        }
    });
})();