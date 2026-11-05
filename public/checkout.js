/* ============================================
   WattsMyBuild: checkout page
   Guests can check out. Creating an account is optional.
   Needs shared.js and auth-ui.js loaded first.
   ============================================ */
(() => {
    'use strict';
    const WMB = window.WMB;
    const { money, esc } = WMB;
    const $ = (id) => document.getElementById(id);

    $('year').textContent = new Date().getFullYear();

    const emptyState = $('empty-state');
    const confirmation = $('confirmation');
    const layout = $('checkout-layout');
    const form = $('checkout-form');
    const placeBtn = $('place-order');
    const formError = $('checkout-error');

    const fields = {
        name: $('f-name'), email: $('f-email'), phone: $('f-phone'),
        address: $('f-address'), city: $('f-city'), zip: $('f-zip'), password: $('f-password')
    };

    let cart = WMB.getCart();

    function show(which) {
        emptyState.hidden = which !== 'empty';
        layout.hidden = which !== 'form';
        confirmation.hidden = which !== 'done';
    }

    /* ---------- order summary ---------- */
    const cartTotal = () => cart.reduce((n, i) => n + i.price * i.qty, 0);

    function renderSummary() {
        $('summary-items').innerHTML = cart.map((i) => `
            <li class="summary-item">
                <div>
                    <strong>${esc(i.name)}</strong> <span class="muted">x ${i.qty}</span>
                    <details>
                        <summary>See parts</summary>
                        <ul class="summary-parts">${i.parts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
                    </details>
                </div>
                <span class="mono">${money(i.price * i.qty)}</span>
            </li>`).join('');
        $('summary-total').textContent = money(cartTotal());
    }

    /* ---------- account state ---------- */
    function syncAccountUI() {
        const user = WMB.getUser();
        $('login-banner').hidden = !!user;
        $('account-offer').hidden = !!user;
        if (user) {
            if (!fields.name.value) fields.name.value = user.name;
            if (!fields.email.value) fields.email.value = user.email;
        }
    }
    window.addEventListener('wmb:auth', syncAccountUI);
    $('banner-login').addEventListener('click', () => WMB.openAuth('login'));
    $('f-create').addEventListener('change', (e) => { $('pw-row').hidden = !e.target.checked; });

    /* ---------- validation ---------- */
    function setError(name, text) {
        const el = $('e-' + name);
        if (!el) return;
        el.textContent = text;
        el.hidden = !text;
        fields[name].setAttribute('aria-invalid', text ? 'true' : 'false');
    }

    function validate() {
        const user = WMB.getUser();
        const phone = fields.phone.value.replace(/[\s-]/g, '');
        const checks = [
            ['name',     fields.name.value.trim() ? '' : 'Enter your full name.'],
            ['email',    /^\S+@\S+\.\S+$/.test(fields.email.value.trim()) ? '' : 'Enter a valid email address.'],
            ['phone',    /^(\+?63|0)9\d{9}$/.test(phone) ? '' : 'Enter a Philippine mobile number, like 09171234567.'],
            ['address',  fields.address.value.trim() ? '' : 'Enter your street address and barangay.'],
            ['city',     fields.city.value.trim() ? '' : 'Enter your city or municipality.'],
            ['password', (!user && $('f-create').checked && fields.password.value.length < 8) ? 'Your password needs at least 8 characters.' : '']
        ];
        let firstBad = null;
        for (const [name, text] of checks) {
            setError(name, text);
            if (text && !firstBad) firstBad = fields[name];
        }
        return firstBad; // null means everything is fine
    }

    /* ---------- placing the order ---------- */
    function showFormError(text) {
        formError.textContent = text;
        formError.hidden = !text;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showFormError('');
        cart = WMB.getCart(); // in case the cart changed in another tab
        if (!cart.length) { show('empty'); return; }

        const bad = validate();
        if (bad) { bad.focus(); return; }

        placeBtn.disabled = true;
        try {
            let account = WMB.getUser();
            if (!account && $('f-create').checked) {
                account = await WMB.register({
                    name: fields.name.value, email: fields.email.value, password: fields.password.value
                });
            }

            // Only ids and quantities go to the server. It works out the real prices itself.
            const order = await WMB.saveOrder({
                customer: {
                    name: fields.name.value.trim(),
                    email: fields.email.value.trim().toLowerCase(),
                    phone: fields.phone.value.trim(),
                    address: fields.address.value.trim(),
                    city: fields.city.value.trim(),
                    zip: fields.zip.value.trim()
                },
                payment: form.elements.payment.value,
                items: cart.map((i) => ({ id: i.id, qty: i.qty }))
            });

            WMB.setCart([]);
            $('conf-name').textContent = order.customer.name.split(' ')[0];
            $('conf-id').textContent = order.id;
            $('conf-summary').innerHTML = `
                <ul class="summary-items">${order.items.map((i) => `
                    <li class="summary-item"><span>${esc(i.name)} <span class="muted">x ${i.qty}</span></span><span class="mono">${money(i.price * i.qty)}</span></li>`).join('')}
                </ul>
                <div class="summary-row summary-total"><span>Total</span><strong class="mono">${money(order.total)}</strong></div>
                <p class="muted">Payment: ${esc(order.payment)}</p>`;
            $('conf-orders').hidden = !account;
            show('done');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            showFormError(err.message);
        } finally {
            placeBtn.disabled = false;
        }
    });

    /* ---------- start ---------- */
    WMB.ready.then(() => {
        if (!cart.length) {
            show('empty');
        } else {
            renderSummary();
            syncAccountUI();
            show('form');
        }
    });
})();
