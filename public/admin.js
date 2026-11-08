/* ============================================
   WattsMyBuild: admin page
   Needs shared.js and auth-ui.js loaded first.
   The server checks admin rights on every request (see /api/admin in server.js).
   ============================================ */
(() => {
    'use strict';
    const WMB = window.WMB;
    const { money, esc } = WMB;
    const $ = (id) => document.getElementById(id);

    $('year').textContent = new Date().getFullYear();

    const STATUSES = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    const PAYMENTS = ['unpaid', 'paid', 'refunded'];
    const loginEl = $('admin-login'), deniedEl = $('admin-denied'), appEl = $('admin-app');
    const errEl = $('admin-error'), ordersEl = $('admin-orders'), custEl = $('admin-customers');
    let tab = 'orders';

    async function api(path, { method = 'GET', body } = {}) {
        let res;
        try {
            res = await fetch('/api/admin' + path, {
                method, credentials: 'same-origin',
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined
            });
        } catch { throw new Error('Could not reach the server.'); }
        let data = null;
        try { data = await res.json(); } catch { /* no body */ }
        if (!res.ok) throw new Error((data && data.error) || 'Something went wrong.');
        return data;
    }

    const showError = (t) => { errEl.textContent = t; errEl.hidden = !t; };
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const fmt = (iso) => { try { return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
    const opts = (list, cur) => list.map((v) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(cap(v))}</option>`).join('');

    /* ---------- stats ---------- */
    async function loadStats() {
        const s = await api('/stats');
        const tiles = [['Orders', s.orders], ['Today', s.today], ['Revenue (not cancelled)', money(s.revenue)], ['Marked paid', money(s.paid)], ['Customers', s.customers]];
        $('stats').innerHTML = tiles.map(([k, v]) => `<div class="stat"><span class="muted">${k}</span><strong>${esc(v)}</strong></div>`).join('')
            + `<p class="stat-line muted">${STATUSES.map((x) => `${x}: ${s.byStatus[x] || 0}`).join('  |  ')}</p>`;
    }

    /* ---------- orders ---------- */
    function orderHTML(o) {
        const c = o.customer;
        return `
        <article class="panel order" data-id="${esc(o.id)}">
            <div class="order-head">
                <div><strong class="mono">${esc(o.id)}</strong> <span class="muted">${esc(fmt(o.createdAt))}</span></div>
                <strong class="mono">${money(o.total)}</strong>
            </div>
            <p class="muted">${esc(c.name)}, ${esc(c.city)}. ${esc(o.payment)}</p>
            <div class="admin-controls">
                <label class="inline">Order status <select data-field="status">${opts(STATUSES, o.status)}</select></label>
                <label class="inline">Payment <select data-field="paymentStatus">${opts(PAYMENTS, o.paymentStatus)}</select></label>
                <span class="saved muted" role="status"></span>
            </div>
            <details>
                <summary>Customer and parts</summary>
                <p class="muted">${esc(c.name)}<br>${esc(c.email)} | ${esc(c.phone)}<br>${esc(c.address)}, ${esc(c.city)} ${esc(c.zip)}</p>
                <ul class="summary-items">${o.items.map((i) => `
                    <li class="summary-item"><div><strong>${esc(i.name)}</strong> <span class="muted">x ${i.qty}</span>
                        <ul class="summary-parts">${i.parts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>
                        <span class="mono">${money(i.price * i.qty)}</span></li>`).join('')}
                </ul>
            </details>
        </article>`;
    }

    async function loadOrders() {
        const q = new URLSearchParams({ status: $('f-status').value, q: $('f-search').value.trim() });
        const data = await api('/orders?' + q);
        ordersEl.innerHTML = data.orders.length ? data.orders.map(orderHTML).join('') : '<p class="panel muted">No orders match.</p>';
    }

    ordersEl.addEventListener('change', async (e) => {
        const sel = e.target.closest('select[data-field]');
        if (!sel) return;
        const card = sel.closest('.order');
        const note = card.querySelector('.saved');
        sel.disabled = true;
        note.textContent = 'Saving...';
        try {
            await api('/orders/' + encodeURIComponent(card.dataset.id), { method: 'PATCH', body: { [sel.dataset.field]: sel.value } });
            note.textContent = 'Saved';
            showError('');
            loadStats().catch(() => {});
        } catch (err) {
            note.textContent = '';
            showError(err.message);
            loadOrders().catch(() => {}); // put the old value back
        } finally {
            sel.disabled = false;
        }
    });

    /* ---------- customers ---------- */
    async function loadCustomers() {
        const { customers } = await api('/customers');
        custEl.innerHTML = customers.length ? `
            <table class="table">
                <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Orders</th><th>Spent</th></tr></thead>
                <tbody>${customers.map((u) => `<tr>
                    <td>${esc(u.name)}${u.isAdmin ? ' <span class="edited-tag">Admin</span>' : ''}</td>
                    <td>${esc(u.email)}</td><td>${esc(fmt(u.createdAt))}</td>
                    <td class="mono">${u.orders}</td><td class="mono">${money(u.spent)}</td></tr>`).join('')}
                </tbody>
            </table>` : '<p class="muted">No accounts yet.</p>';
    }

    /* ---------- wiring ---------- */
    async function refresh() {
        showError('');
        try { await Promise.all([loadStats(), tab === 'orders' ? loadOrders() : loadCustomers()]); }
        catch (err) { showError(err.message); }
    }

    document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
        tab = b.dataset.tab;
        document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
        ordersEl.hidden = tab !== 'orders';
        custEl.hidden = tab !== 'customers';
        $('order-filters').hidden = tab !== 'orders';
        refresh();
    }));
    $('refresh').addEventListener('click', refresh);
    $('f-status').addEventListener('change', refresh);
    let timer;
    $('f-search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 300); });
    window.addEventListener('focus', () => { if (!appEl.hidden) refresh(); });
    $('admin-login-btn').addEventListener('click', () => WMB.openAuth('login'));

    function init() {
        const u = WMB.getUser();
        const isAdmin = !!(u && u.isAdmin);
        loginEl.hidden = !!u;
        deniedEl.hidden = !u || isAdmin;
        appEl.hidden = !isAdmin;
        if (isAdmin) refresh();
    }
    window.addEventListener('wmb:auth', init);
    WMB.ready.then(init);
})();
