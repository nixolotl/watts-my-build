/* ============================================
   WattsMyBudget: My orders page
   Needs shared.js and auth-ui.js loaded first.
   ============================================ */
(() => {
    'use strict';
    const WMB = window.WMB;
    const { money, esc } = WMB;
    const $ = (id) => document.getElementById(id);

    $('year').textContent = new Date().getFullYear();

    const loginPanel = $('orders-login');
    const emptyPanel = $('orders-empty');
    const list = $('orders-list');

    function formatDate(iso) {
        try { return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }); }
        catch { return iso; }
    }

    function orderHTML(o) {
        const c = o.customer || {};
        return `
        <article class="panel order">
            <div class="order-head">
                <div>
                    <strong class="mono">${esc(o.id)}</strong>
                    <span class="muted">${esc(formatDate(o.createdAt))}</span>
                </div>
                <span class="status">${esc(o.status || 'Placed')}</span>
            </div>
            <ul class="summary-items">
                ${o.items.map((i) => `
                <li class="summary-item">
                    <div>
                        <strong>${esc(i.name)}</strong> <span class="muted">x ${i.qty}</span>
                        <details>
                            <summary>See parts</summary>
                            <ul class="summary-parts">${i.parts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
                        </details>
                    </div>
                    <span class="mono">${money(i.price * i.qty)}</span>
                </li>`).join('')}
            </ul>
            <div class="summary-row summary-total"><span>Total</span><strong class="mono">${money(o.total)}</strong></div>
            <p class="muted">Payment: ${esc(o.payment)}<br>
            Deliver to: ${esc(c.name || '')}, ${esc(c.address || '')}, ${esc(c.city || '')} ${esc(c.zip || '')}</p>
        </article>`;
    }

    async function render() {
        const user = WMB.getUser();
        loginPanel.hidden = !!user;
        emptyPanel.hidden = true;
        list.innerHTML = '';
        if (!user) return;

        let orders;
        try {
            orders = await WMB.getOrders();
        } catch (err) {
            list.innerHTML = `<p class="panel">${esc(err.message)}</p>`;
            return;
        }
        if (WMB.getUser() !== user) return; // logged out while loading
        if (!orders.length) { emptyPanel.hidden = false; return; }
        list.innerHTML = orders.map(orderHTML).join('');
    }

    $('orders-login-btn').addEventListener('click', () => WMB.openAuth('login'));
    window.addEventListener('wmb:auth', render);
    WMB.ready.then(render); // wait until the server says who is logged in
})();
