/* ============================================
   WattsMyBudget: login / sign-up dialog and the nav buttons
   Needs shared.js first, and an empty <span id="auth-slot"></span> in the nav.
   ============================================ */
(() => {
    'use strict';
    const { esc, getUser, register, login, logout } = window.WMB;

    const slot = document.getElementById('auth-slot');

    /* ---------- the dialog (built here so every page gets the same one) ---------- */
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    dialog.setAttribute('aria-labelledby', 'auth-title');
    dialog.innerHTML = `
        <div class="dialog-body">
            <div class="dialog-head">
                <h2 id="auth-title">Log in</h2>
                <button type="button" class="dialog-close" id="auth-close" aria-label="Close">&times;</button>
            </div>
            <div class="tabs" role="group" aria-label="Log in or sign up">
                <button type="button" class="tab" data-mode="login">Log in</button>
                <button type="button" class="tab" data-mode="register">Create account</button>
            </div>
            <form id="auth-form" novalidate>
                <label class="field" id="auth-name-row">Name
                    <input id="auth-name" type="text" autocomplete="name">
                </label>
                <label class="field">Email
                    <input id="auth-email" type="email" autocomplete="email">
                </label>
                <label class="field">Password
                    <input id="auth-password" type="password" autocomplete="current-password">
                </label>
                <p class="hint" id="auth-hint"></p>
                <button type="submit" class="btn" id="auth-submit">Log in</button>
                <p class="message" id="auth-error" role="alert" hidden></p>
                <p class="demo-note">School project demo: please don't use a password you use anywhere else.</p>
            </form>
        </div>`;
    document.body.appendChild(dialog);

    const $ = (id) => dialog.querySelector('#' + id);
    const form = $('auth-form');
    const title = $('auth-title');
    const nameRow = $('auth-name-row');
    const nameInput = $('auth-name');
    const emailInput = $('auth-email');
    const passInput = $('auth-password');
    const hint = $('auth-hint');
    const submitBtn = $('auth-submit');
    const errorEl = $('auth-error');
    let mode = 'login';

    function showError(text) {
        errorEl.textContent = text;
        errorEl.hidden = !text;
    }

    function setMode(next) {
        mode = next;
        const isRegister = mode === 'register';
        title.textContent = isRegister ? 'Create account' : 'Log in';
        submitBtn.textContent = isRegister ? 'Create account' : 'Log in';
        nameRow.hidden = !isRegister;
        passInput.autocomplete = isRegister ? 'new-password' : 'current-password';
        hint.textContent = isRegister ? 'Use at least 8 characters for your password.' : '';
        hint.hidden = !isRegister;
        dialog.querySelectorAll('.tab').forEach((t) => {
            const active = t.dataset.mode === mode;
            t.classList.toggle('active', active);
            t.setAttribute('aria-pressed', String(active));
        });
        showError('');
    }

    function openDialog(nextMode) {
        setMode(nextMode || 'login');
        form.reset();
        if (!dialog.open) dialog.showModal();
        (mode === 'register' ? nameInput : emailInput).focus();
    }

    dialog.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    $('auth-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // click on the dark backdrop

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError('');
        submitBtn.disabled = true;
        try {
            const details = { name: nameInput.value, email: emailInput.value, password: passInput.value };
            if (mode === 'register') await register(details); else await login(details);
            form.reset();
            dialog.close();
        } catch (err) {
            showError(err.message);
        } finally {
            submitBtn.disabled = false;
        }
    });

    /* ---------- nav buttons ---------- */
    function renderSlot() {
        if (!slot) return;
        const user = getUser();
        slot.innerHTML = user
            ? `<a href="orders.html" class="btn btn-small btn-ghost">My orders</a>
               <button type="button" class="btn btn-small btn-ghost" id="logout-btn" title="Signed in as ${esc(user.email)}">Log out (${esc(user.name.split(' ')[0])})</button>`
            : `<button type="button" class="btn btn-small btn-ghost" id="login-open">Log in</button>`;
    }

    if (slot) {
        slot.addEventListener('click', (e) => {
            if (e.target.closest('#login-open')) openDialog('login');
            if (e.target.closest('#logout-btn')) logout();
        });
    }
    window.addEventListener('wmb:auth', renderSlot);

    window.WMB.registerAuthOpener(openDialog);
    window.WMB.ready.then(renderSlot); // wait until the server says who is logged in
})();
