/* ============================================
   WattsMyBudget: home page logic
   Needs shared.js and parts.js loaded first.
   Sections:
   1. SETUP         (shared helpers, parts)
   2. BUILD ENGINE  (turns budget + use case into builds)
   3. RENDERING     (draws the build cards)
   4. SWAP DIALOG   (change one part of a build)
   5. FORM          (budget input, slider, validation)
   6. CART          (add, remove, quantity, saved in localStorage)
   ============================================ */
(() => {
    'use strict';

    /* ---------- 1. SETUP ---------- */
    const { money, esc, getCart, setCart } = window.WMB;
    const $ = (id) => document.getElementById(id);

    const PARTS = window.PARTS_DATA;
    if (!PARTS) throw new Error('parts.js did not load. Check that it is in the same folder and linked before script.js.');

    /* ---------- 2. BUILD ENGINE ---------- */
    const CATS = ['cpu', 'gpu', 'ram', 'storage', 'board', 'case', 'cooler'];

    // How much each use case cares about each part. Bigger number = gets upgraded sooner.
    const WEIGHTS = {
        gaming:  { cpu: 0.18, gpu: 0.45, ram: 0.06, storage: 0.07, board: 0.10, case: 0.06, cooler: 0.04 },
        work:    { cpu: 0.30, gpu: 0.10, ram: 0.15, storage: 0.12, board: 0.13, case: 0.10, cooler: 0.06 },
        editing: { cpu: 0.27, gpu: 0.28, ram: 0.14, storage: 0.12, board: 0.09, case: 0.06, cooler: 0.04 }
    };
    const USE_LABELS = { gaming: 'Gaming', work: 'Work & study', editing: 'Video editing' };

    // factor = how much of the budget this tier is allowed to spend
    const TIERS = [
        { key: 'value',    label: 'Value',    factor: 0.80, badge: 'Spends 80%' },
        { key: 'balanced', label: 'Balanced', factor: 0.92, badge: 'Spends 92%', featured: true },
        { key: 'max',      label: 'Max',      factor: 1.00, badge: 'Spends 100%' }
    ];

    const partOf = (cat, sel) => PARTS[cat].items[sel[cat]];

    function psuIndexFor(sel) {
        const need = partOf('cpu', sel).watts + partOf('gpu', sel).watts + 150; // 150 W headroom
        const i = PARTS.psu.items.findIndex((p) => p.watts >= need);
        return i === -1 ? PARTS.psu.items.length - 1 : i;
    }

    function totalOf(sel) {
        const parts = CATS.reduce((sum, c) => sum + partOf(c, sel).price, 0);
        return parts + PARTS.psu.items[psuIndexFor(sel)].price;
    }

    // Start with the cheapest parts, then upgrade the most under-funded part until the target is used.
    function makeSelection(budget, usecase, factor) {
        const sel = Object.fromEntries(CATS.map((c) => [c, 0]));
        if (totalOf(sel) > budget) return null; // budget is below the cheapest possible build

        const target = Math.min(budget, Math.max(totalOf(sel), budget * factor));
        const weights = WEIGHTS[usecase];

        while (true) {
            let best = null;
            for (const c of CATS) {
                if (sel[c] >= PARTS[c].items.length - 1) continue;
                const next = { ...sel, [c]: sel[c] + 1 };
                if (c === 'cpu') next.cooler = Math.max(next.cooler, partOf('cpu', next).minCooler);
                if (totalOf(next) > target) continue;
                const score = partOf(c, sel).price / weights[c]; // lower = needs money more
                if (!best || score < best.score) best = { next, score };
            }
            if (!best) break;
            Object.assign(sel, best.next);
        }
        return sel;
    }

    // A build keeps `origSel` (what we suggested) and `sel` (what it is now, after swaps).
    function generateBuilds(budget, usecase) {
        const seen = new Set();
        const builds = [];
        for (const tier of TIERS) {
            const sel = makeSelection(budget, usecase, tier.factor);
            if (!sel) return [];
            const signature = CATS.map((c) => sel[c]).join('-');
            if (seen.has(signature)) continue; // skip tiers that ended up identical
            seen.add(signature);
            builds.push({ key: tier.key, tier, usecase, origSel: { ...sel }, sel: { ...sel }, notice: '' });
        }
        return builds;
    }

    const isEdited = (b) => CATS.some((c) => b.sel[c] !== b.origSel[c]);

    // Everything the card and the cart need, worked out from the current selection.
    function view(b) {
        const parts = [...CATS, 'psu'].map((c) => {
            const item = c === 'psu' ? PARTS.psu.items[psuIndexFor(b.sel)] : partOf(c, b.sel);
            return { ...item, cat: c, label: PARTS[c].label };
        });
        const signature = CATS.map((c) => b.sel[c]).join('-');
        return {
            parts,
            total: totalOf(b.sel),
            id: `${b.usecase}-${b.key}-${signature}`,
            name: `${b.tier.label} ${USE_LABELS[b.usecase]} build${isEdited(b) ? ' (edited)' : ''}`
        };
    }

    // What happens if part `cat` is changed to item number `i`? Returns the new selection and any notes.
    function trySwap(sel, cat, i) {
        const next = { ...sel, [cat]: i };
        const result = { sel: next, blocked: '', notes: [] };

        if (cat === 'cooler' && i < partOf('cpu', next).minCooler) {
            result.blocked = 'Too weak for this CPU';
            return result;
        }
        if (cat === 'cpu') {
            const min = partOf('cpu', next).minCooler;
            if (next.cooler < min) {
                next.cooler = min;
                result.notes.push(`Cooler changed to ${PARTS.cooler.items[min].name} to keep the new CPU cool.`);
            }
        }
        if (psuIndexFor(next) !== psuIndexFor(sel)) {
            result.notes.push(`Power supply changed to ${PARTS.psu.items[psuIndexFor(next)].name} to match the new power draw.`);
        }
        return result;
    }

    /* ---------- 3. RENDERING ---------- */
    const resultsSection = $('results');
    const resultsTitle = $('results-title');
    const buildsEl = $('builds');
    let currentBuilds = [];
    let currentBudget = 0;

    function buildCardHTML(b) {
        const v = view(b);
        const edited = isEdited(b);
        const pct = Math.min(100, (v.total / currentBudget) * 100);
        const left = currentBudget - v.total;

        const partsHTML = v.parts.map((p) => `
            <li class="part">
                <span class="part-cat">${esc(p.label)}${p.cat === 'psu' ? ' (auto-matched)' : ''}</span>
                ${p.cat === 'psu' ? '' : `<button type="button" class="swap-btn" data-key="${esc(b.key)}" data-cat="${p.cat}" aria-label="Swap ${esc(p.label)}: ${esc(p.name)}">Swap</button>`}
                <span class="part-name">${esc(p.name)}</span>
                <span class="part-spec">${esc(p.spec)}</span>
                <span class="part-price">${money(p.price)}</span>
            </li>`).join('');

        return `
        <article class="build${b.tier.featured ? ' featured' : ''}">
            <span class="badge">${esc(b.tier.badge)}</span>
            <h3>${esc(b.tier.label)} build${edited ? ' <span class="edited-tag">Edited</span>' : ''}</h3>
            <div class="total">${money(v.total)}</div>
            <p class="remaining">${left >= 0 ? `${money(left)} unspent` : `<span class="over">${money(-left)} over budget</span>`}</p>
            <div class="meter${left < 0 ? ' meter-over' : ''}" aria-hidden="true"><div class="meter-fill" style="width:${pct.toFixed(1)}%"></div></div>
            <ul class="parts">${partsHTML}</ul>
            ${b.notice ? `<p class="notice" role="status">${esc(b.notice)}</p>` : ''}
            ${edited ? `<button type="button" class="reset-btn" data-key="${esc(b.key)}">Reset to suggested parts</button>` : ''}
            <button type="button" class="btn add-to-cart" data-key="${esc(b.key)}">Add to cart</button>
        </article>`;
    }

    function renderBuilds() {
        buildsEl.innerHTML = currentBuilds.map(buildCardHTML).join('');
    }

    function showBuilds(budget, usecase) {
        currentBudget = budget;
        currentBuilds = generateBuilds(budget, usecase);
        resultsSection.hidden = false;

        if (!currentBuilds.length) {
            resultsTitle.textContent = 'Budget too low for a full build';
            buildsEl.innerHTML = '<p>The cheapest complete build costs more than that. Raise the budget and run it again.</p>';
            return;
        }
        resultsTitle.textContent = `${USE_LABELS[usecase]} builds, ${money(budget)} budget`;
        renderBuilds();
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ---------- 4. SWAP DIALOG ---------- */
    const swapDialog = $('swap-dialog');
    const swapTitle = $('swap-title');
    const swapSub = $('swap-sub');
    const swapList = $('swap-list');
    let swapCtx = null; // { key, cat }

    function renderSwapList() {
        const b = currentBuilds.find((x) => x.key === swapCtx.key);
        const cat = swapCtx.cat;
        const baseTotal = totalOf(b.sel);

        swapTitle.textContent = `Swap ${PARTS[cat].label.toLowerCase()}`;
        swapSub.textContent = `Budget: ${money(currentBudget)}. The right column shows how the build total changes.`;

        swapList.innerHTML = PARTS[cat].items.map((item, i) => {
            const t = trySwap(b.sel, cat, i);
            const isCurrent = i === b.sel[cat];
            const newTotal = totalOf(t.sel);
            const diff = newTotal - baseTotal;
            const diffText = isCurrent ? 'Current' : diff === 0 ? 'Same total' : `${diff > 0 ? '+' : '−'}${money(Math.abs(diff))}`;
            const flags = [];
            if (t.blocked) flags.push(t.blocked);
            else if (!isCurrent && newTotal > currentBudget) flags.push('Over budget');
            t.notes.forEach((n) => flags.push(n));
            return `
            <li>
                <button type="button" class="swap-option${isCurrent ? ' current' : ''}" data-i="${i}" ${isCurrent || t.blocked ? 'disabled' : ''}>
                    <span class="swap-main">
                        <strong>${esc(item.name)}</strong>
                        <span class="swap-spec">${esc(item.spec)}</span>
                        ${flags.length ? `<span class="swap-flag">${esc(flags.join(' '))}</span>` : ''}
                    </span>
                    <span class="swap-price">
                        <span>${money(item.price)}</span>
                        <span class="swap-diff${!isCurrent && diff > 0 ? ' up' : ''}${!isCurrent && diff < 0 ? ' down' : ''}">${diffText}</span>
                    </span>
                </button>
            </li>`;
        }).join('');
    }

    function openSwap(key, cat) {
        swapCtx = { key, cat };
        renderSwapList();
        swapDialog.showModal();
    }

    swapList.addEventListener('click', (e) => {
        const btn = e.target.closest('.swap-option');
        if (!btn || btn.disabled) return;
        const b = currentBuilds.find((x) => x.key === swapCtx.key);
        const t = trySwap(b.sel, swapCtx.cat, Number(btn.dataset.i));
        if (t.blocked) return;
        b.sel = t.sel;
        b.notice = t.notes.join(' ');
        const { key, cat } = swapCtx;
        swapDialog.close();
        renderBuilds();
        const again = buildsEl.querySelector(`.swap-btn[data-key="${key}"][data-cat="${cat}"]`);
        if (again) again.focus();
    });
    $('swap-close').addEventListener('click', () => swapDialog.close());
    swapDialog.addEventListener('click', (e) => { if (e.target === swapDialog) swapDialog.close(); });

    /* ---------- 5. FORM ---------- */
    const form = $('builder');
    const numberInput = $('budget-number');
    const rangeInput = $('budget-range');
    const message = $('form-message');
    const MIN = Number(numberInput.min);
    const MAX = Number(numberInput.max);

    $('currency-symbol').textContent = window.WMB.CONFIG.symbol;
    $('range-min').textContent = money(MIN);
    $('range-max').textContent = money(MAX);
    $('year').textContent = new Date().getFullYear();

    function showMessage(text) {
        message.textContent = text;
        message.hidden = !text;
    }

    rangeInput.addEventListener('input', () => {
        numberInput.value = rangeInput.value;
        showMessage('');
    });
    numberInput.addEventListener('input', () => {
        const v = Number(numberInput.value);
        if (v >= MIN && v <= MAX) rangeInput.value = v;
        showMessage('');
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const budget = Number(numberInput.value);
        if (!Number.isFinite(budget) || budget < MIN || budget > MAX) {
            showMessage(`Enter a budget between ${money(MIN)} and ${money(MAX)}.`);
            numberInput.focus();
            return;
        }
        showMessage('');
        showBuilds(budget, form.elements.usecase.value);
    });

    /* ---------- 6. CART ---------- */
    const drawer = $('cart-drawer');
    const overlay = $('cart-overlay');
    const cartList = $('cart-items');
    const cartTotal = $('cart-total');
    const cartCount = $('cart-count');
    const cartEmpty = $('cart-empty');
    const cartOpenBtn = $('cart-open');
    const checkoutBtn = $('checkout-btn');

    let cart = getCart();
    const saveCart = () => setCart(cart);

    function addToCart(b) {
        const v = view(b);
        const existing = cart.find((i) => i.id === v.id);
        if (existing) {
            existing.qty += 1;
        } else {
            cart.push({ id: v.id, name: v.name, price: v.total, qty: 1, parts: v.parts.map((p) => p.name) });
        }
        saveCart();
        renderCart();
    }

    function changeQty(id, delta) {
        const item = cart.find((i) => i.id === id);
        if (!item) return;
        item.qty += delta;
        if (item.qty <= 0) cart = cart.filter((i) => i.id !== id);
        saveCart();
        renderCart();
    }

    function removeItem(id) {
        cart = cart.filter((i) => i.id !== id);
        saveCart();
        renderCart();
    }

    function renderCart() {
        const count = cart.reduce((n, i) => n + i.qty, 0);
        const total = cart.reduce((n, i) => n + i.price * i.qty, 0);
        cartCount.textContent = count;
        cartCount.hidden = count === 0;
        cartTotal.textContent = money(total);
        cartEmpty.hidden = count > 0;
        checkoutBtn.disabled = count === 0;

        cartList.innerHTML = cart.map((i) => `
            <li class="cart-item">
                <div class="cart-item-info">
                    <strong>${esc(i.name)}</strong>
                    <span class="cart-item-parts">${esc(i.parts.slice(0, 2).join(', '))} +${i.parts.length - 2} more</span>
                    <span class="cart-item-price">${money(i.price)} each</span>
                </div>
                <div class="qty" role="group" aria-label="Quantity for ${esc(i.name)}">
                    <button type="button" data-act="dec" data-id="${esc(i.id)}" aria-label="Decrease quantity">&minus;</button>
                    <span>${i.qty}</span>
                    <button type="button" data-act="inc" data-id="${esc(i.id)}" aria-label="Increase quantity">+</button>
                </div>
                <button type="button" class="cart-remove" data-act="remove" data-id="${esc(i.id)}" aria-label="Remove ${esc(i.name)}">Remove</button>
            </li>`).join('');
    }

    function openCart() {
        cart = getCart(); // pick up changes made on other pages
        renderCart();
        drawer.classList.add('open');
        overlay.hidden = false;
        drawer.setAttribute('aria-hidden', 'false');
        $('cart-close').focus();
    }
    function closeCart() {
        drawer.classList.remove('open');
        overlay.hidden = true;
        drawer.setAttribute('aria-hidden', 'true');
        cartOpenBtn.focus();
    }

    buildsEl.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-to-cart');
        const swapBtn = e.target.closest('.swap-btn');
        const resetBtn = e.target.closest('.reset-btn');

        if (swapBtn) { openSwap(swapBtn.dataset.key, swapBtn.dataset.cat); return; }

        if (resetBtn) {
            const b = currentBuilds.find((x) => x.key === resetBtn.dataset.key);
            if (b) { b.sel = { ...b.origSel }; b.notice = ''; renderBuilds(); }
            return;
        }

        if (addBtn) {
            const b = currentBuilds.find((x) => x.key === addBtn.dataset.key);
            if (!b) return;
            addToCart(b);
            addBtn.textContent = 'Added to cart';
            setTimeout(() => { addBtn.textContent = 'Add to cart'; }, 1200);
        }
    });

    cartList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const { act, id } = btn.dataset;
        if (act === 'inc') changeQty(id, 1);
        if (act === 'dec') changeQty(id, -1);
        if (act === 'remove') removeItem(id);
    });

    cartOpenBtn.addEventListener('click', openCart);
    $('cart-close').addEventListener('click', closeCart);
    overlay.addEventListener('click', closeCart);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('open')) closeCart();
    });
    checkoutBtn.addEventListener('click', () => { window.location.href = 'checkout.html'; });

    renderCart();
})();