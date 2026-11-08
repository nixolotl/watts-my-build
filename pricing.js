/* ============================================
   WattsMyBudget: server-side pricing
   The browser only sends build ids and quantities. Prices are worked out HERE
   from public/parts.js, so nobody can change a price in dev tools.

   A build id looks like:  gaming-value-0-1-2-0-1-0-0
                           use   tier  cpu gpu ram storage board case cooler
   ============================================ */
// Load the SAME parts.js the website uses, so there is only one price list to maintain.
// parts.js sets window.PARTS_DATA for the browser, so we give it a temporary `window`.
// (A plain require() is used so hosts like Vercel know to include the file.)
const hadWindow = 'window' in globalThis;
if (!hadWindow) globalThis.window = {};
require('./public/parts.js');
const PARTS = globalThis.window.PARTS_DATA;
if (!hadWindow) delete globalThis.window;
if (!PARTS) throw new Error('Could not load public/parts.js');

const CATS = ['cpu', 'gpu', 'ram', 'storage', 'board', 'case', 'cooler'];
const USE_LABELS = { gaming: 'Gaming', work: 'Work & study', editing: 'Video editing' };
const TIER_LABELS = { value: 'Value', balanced: 'Balanced', max: 'Max' };
const ID_PATTERN = /^(gaming|work|editing)-(value|balanced|max)-(\d+(?:-\d+){6})$/;
const MAX_QTY = 10;
const PART_PATTERN = /^part-(cpu|gpu|ram|storage|board|case|cooler|psu)-(\d+)$/; // a single part: part-<category>-<number>
const ALLOWED_PAYMENTS = ['Cash on delivery', 'GCash (demo)', 'Bank transfer (demo)'];

// An error that is safe to show to the customer.
class OrderError extends Error {
    constructor(message) { super(message); this.status = 400; }
}

function psuFor(sel) {
    const need = PARTS.cpu.items[sel.cpu].watts + PARTS.gpu.items[sel.gpu].watts + 150;
    const found = PARTS.psu.items.find((p) => p.watts >= need);
    return found || PARTS.psu.items[PARTS.psu.items.length - 1];
}

function priceCartItem(raw) {
    const m = ID_PATTERN.exec(String((raw && raw.id) || ''));
    const qty = Number(raw && raw.qty);
    const invalid = 'A build in your cart is no longer valid. Please remove it and add it again.';
    const single = PART_PATTERN.exec(String((raw && raw.id) || ''));
    if (single) {
        const item = PARTS[single[1]].items[Number(single[2])];
        if (!item) throw new OrderError(invalid);
        if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new OrderError(`Quantity must be between 1 and ${MAX_QTY}.`);
        return { buildId: single[0], name: item.name, price: item.price, qty, parts: [`${PARTS[single[1]].label}: ${item.spec}`] };
    }
    if (!m) throw new OrderError(invalid);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new OrderError(`Quantity must be between 1 and ${MAX_QTY}.`);

    const [, usecase, tier, signature] = m;
    const indexes = signature.split('-').map(Number);
    const sel = {};
    const parts = [];
    CATS.forEach((cat, n) => {
        const item = PARTS[cat].items[indexes[n]];
        if (!item) throw new OrderError(invalid);
        sel[cat] = indexes[n];
        parts.push(item);
    });
    if (sel.cooler < PARTS.cpu.items[sel.cpu].minCooler) throw new OrderError(invalid); // cooler too weak for the CPU
    parts.push(psuFor(sel));

    return {
        buildId: m[0],
        name: `${TIER_LABELS[tier]} ${USE_LABELS[usecase]} build`,
        price: parts.reduce((sum, p) => sum + p.price, 0),
        qty,
        parts: parts.map((p) => p.name)
    };
}

module.exports = { priceCartItem, OrderError, ALLOWED_PAYMENTS };