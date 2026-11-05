/* ============================================
   WattsMyBuild: shared helpers (loaded on every page)
   Exposes one object: window.WMB

   Accounts and orders now live on the SERVER (see server.js).
   Only the shopping cart stays in this browser's localStorage.
   Pages that need to know who is logged in should wait for WMB.ready first.
   ============================================ */
(() => {
    'use strict';

    const CONFIG = {
        symbol: '₱',          // prices in parts.js are already in pesos, so rate stays 1
        rate: 1,
        locale: 'en-PH',
        cartKey: 'wmb-cart-v2'
    };

    const money = (amount) => CONFIG.symbol + Math.round(amount * CONFIG.rate).toLocaleString(CONFIG.locale);
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- talking to the server ---------- */
    async function api(path, { method = 'GET', body } = {}) {
        let res;
        try {
            res = await fetch('/api' + path, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
                credentials: 'same-origin'
            });
        } catch {
            throw new Error('Could not reach the server. Please check your connection and try again.');
        }
        let data = null;
        try { data = await res.json(); } catch { /* no JSON body */ }
        if (!res.ok) throw new Error((data && data.error) || 'Something went wrong. Please try again.');
        return data;
    }

    /* ---------- cart (stays in the browser) ---------- */
    function getCart() {
        try {
            const c = JSON.parse(localStorage.getItem(CONFIG.cartKey));
            return Array.isArray(c) ? c : [];
        } catch { return []; }
    }
    function setCart(cart) {
        try { localStorage.setItem(CONFIG.cartKey, JSON.stringify(cart)); return true; } catch { return false; }
    }

    /* ---------- who is logged in ---------- */
    let currentUser = null;
    const notifyAuthChange = () => window.dispatchEvent(new CustomEvent('wmb:auth'));

    // Asks the server "who am I?" once when the page loads.
    const ready = api('/me')
        .then((data) => { currentUser = data.user || null; })
        .catch(() => { currentUser = null; });

    const getUser = () => currentUser; // same as before: instant, no await needed (after `ready`)

    async function register({ name, email, password }) {
        const data = await api('/register', { method: 'POST', body: { name, email, password } });
        currentUser = data.user;
        notifyAuthChange();
        return currentUser;
    }

    async function login({ email, password }) {
        const data = await api('/login', { method: 'POST', body: { email, password } });
        currentUser = data.user;
        notifyAuthChange();
        return currentUser;
    }

    async function logout() {
        try { await api('/logout', { method: 'POST' }); } catch { /* clear the screen anyway */ }
        currentUser = null;
        notifyAuthChange();
    }

    /* ---------- orders ---------- */
    // `order` = { customer, payment, items: [{ id, qty }] }. The server works out prices.
    async function saveOrder(order) {
        const data = await api('/orders', { method: 'POST', body: order });
        return data.order;
    }

    async function getOrders() {
        const data = await api('/orders');
        return data.orders;
    }

    /* ---------- login dialog hook (auth-ui.js fills this in) ---------- */
    let authOpener = null;

    window.WMB = {
        CONFIG, money, esc, ready,
        getCart, setCart,
        getUser, register, login, logout,
        saveOrder, getOrders,
        registerAuthOpener: (fn) => { authOpener = fn; },
        openAuth: (mode) => { if (authOpener) authOpener(mode || 'login'); }
    };
})();
