/* ==================== ALMACENAMIENTO Y NAVEGACIÓN ==================== */
const QUOTES_STORAGE = 'quotes:list';
const COUNTER_KEY = 'quotes:counter';
const STOCK_STORAGE = 'stock:items';
const COMPAT_STORAGE = 'compat:items';
const POS_SALES_STORAGE = 'pos:sales';
const CASH_STORAGE = 'cash:register';

let quotes = [];
let stockItems = [];
let compatItems = [];
let posSales = [];
let posCart = [];
let cashData = {
  isOpen: false,
  initialAmount: 0,
  movements: []
};

let currentQuoteId = null;
let itemIdCounter = 0;
let currentAccessType = 'pattern';
let currentPattern = [];
let currentCashAction = null;

const patternPositions = [
  {x:30,y:30}, {x:90,y:30}, {x:150,y:30},
  {x:30,y:90}, {x:90,y:90}, {x:150,y:90},
  {x:30,y:150}, {x:90,y:150}, {x:150,y:150}
];

function switchMainTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(nt => nt.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  btn.classList.add('active');
  if (tabId === 'clientes') renderClients();
  if (tabId === 'stock') renderStock();
  if (tabId === 'compatibilidades') renderCompat();
  if (tabId === 'ventas') renderPOS();
  if (tabId === 'caja') renderCashRegister();
  if (tabId === 'finanzas') renderFinance();
}

function uid() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function formatMoney(n) { return '$' + (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }
function escapeAttr(str) { return String(str || '').replace(/"/g, '&quot;'); }
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

/* ==================== PRESUPUESTOS Y REPARACIONES ==================== */
function loadQuotes() {
  try { quotes = JSON.parse(localStorage.getItem(QUOTES_STORAGE)) || []; } catch (e) { quotes = []; }
}
function saveQuotesToStorage() {
  localStorage.setItem(QUOTES_STORAGE, JSON.stringify(quotes));
}

function buildPatternGrid() {
  const grid = document.getElementById('patternGrid');
  if (!grid) return;
  grid.querySelectorAll('.pattern-dot').forEach(d => d.remove());
  patternPositions.forEach((pos, i) => {
    const dot = document.createElement('div');
    dot.className = 'pattern-dot';
    dot.style.left = pos.x + 'px';
    dot.style.top = pos.y + 'px';
    dot.dataset.index = i;
    dot.onclick = () => { if (!currentPattern.includes(i)) { currentPattern.push(i); redrawPattern(); } };
    grid.appendChild(dot);
  });
}
function clearPattern() { currentPattern = []; redrawPattern(); }
function redrawPattern() {
  document.querySelectorAll('#patternGrid .pattern-dot').forEach(d => {
    d.classList.toggle('active', currentPattern.includes(parseInt(d.dataset.index)));
  });
  const svg = document.getElementById('patternSvg');
  if (!svg) return;
  if (currentPattern.length < 2) { svg.innerHTML = ''; return; }
  const points = currentPattern.map(i => `${patternPositions[i].x},${patternPositions[i].y}`).join(' ');
  svg.innerHTML = `<polyline points="${points}" fill="none" stroke="#00d2ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" />`;
}
function setAccessType(type) {
  currentAccessType = type;
  document.querySelectorAll('#tab-presupuestos .type-tab').forEach(t => t.classList.toggle('active', t.dataset.type === type));
  document.getElementById('patternSection').style.display = type === 'pattern' ? 'block' : 'none';
  document.getElementById('pinSection').style.display = type === 'pin' ? 'block' : 'none';
  document.getElementById('passwordSection').style.display = type === 'password' ? 'block' : 'none';
}

function searchStockForQuote(query) {
  const resultsDiv = document.getElementById('quoteStockResults');
  if (!query || query.trim() === '') {
    resultsDiv.style.display = 'none';
    return;
  }
  const filtered = stockItems.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
  if (!filtered.length) {
    resultsDiv.style.display = 'none';
    return;
  }
  resultsDiv.innerHTML = filtered.map(item => `
    <div class="stock-search-item" onclick="selectStockForQuote('${escapeAttr(item.name)}', ${item.price || 0}, ${item.cost || 0}, '${item.id}')">
      <span><strong>${escapeHtml(item.name)}</strong> (${escapeHtml(item.category)}) - Stock: ${item.qty}</span>
      <span style="color: var(--accent-blue);">${item.price != null ? '$' + item.price.toLocaleString('es-AR') : 'Sin precio'}</span>
    </div>
  `).join('');
  resultsDiv.style.display = 'block';
}

function selectStockForQuote(name, price, cost, stockId) {
  addItemRow(name, 1, cost, price, stockId);
  document.getElementById('searchQuoteStock').value = '';
  document.getElementById('quoteStockResults').style.display = 'none';
}

function addItemRow(desc, qty, cost, price, stockId = null) {
  itemIdCounter++;
  const tr = document.createElement('tr');
  const rowId = 'row_' + itemIdCounter;
  tr.id = rowId;
  tr.dataset.stockId = stockId || '';
  tr.innerHTML = `
    <td data-label="Descripción"><input type="text" class="item-desc" placeholder="Ej: Cambio de pantalla" value="${desc ? escapeAttr(desc) : ''}" oninput="recalcTotal()"></td>
    <td data-label="Cant."><input type="number" class="item-qty" min="1" value="${qty || 1}" oninput="recalcTotal()"></td>
    <td data-label="Costo ($)"><input type="number" class="item-cost" min="0" placeholder="0" value="${cost != null ? cost : ''}" oninput="recalcTotal()"></td>
    <td data-label="Precio unit."><input type="number" class="item-price" min="0" placeholder="0" value="${price != null ? price : ''}" oninput="recalcTotal()"></td>
    <td class="item-subtotal" data-label="Subtotal">$0</td>
    <td class="item-profit" data-label="Ganancia" style="color: var(--green-success); font-weight: bold;">$0</td>
    <td><button class="btn-danger" onclick="document.getElementById('${rowId}').remove(); recalcTotal();">✕</button></td>
  `;
  document.getElementById('itemsBody').appendChild(tr);
  recalcTotal();
}

function recalcTotal() {
  let itemsSubtotal = 0;
  let itemsProfit = 0;

  document.querySelectorAll('#itemsBody tr').forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const cost = parseFloat(row.querySelector('.item-cost').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    
    const sub = qty * price;
    const profit = (price - cost) * qty;

    row.querySelector('.item-subtotal').textContent = formatMoney(sub);
    row.querySelector('.item-profit').textContent = formatMoney(profit);

    itemsSubtotal += sub;
    itemsProfit += profit;
  });

  const shippingCost = parseFloat(document.getElementById('shippingCost').value) || 0;
  const shippingExpense = parseFloat(document.getElementById('shippingExpense').value) || 0;

  const total = itemsSubtotal + shippingCost;
  const shippingProfit = shippingCost - shippingExpense;
  const totalProfit = itemsProfit + shippingProfit;

  document.getElementById('itemsSubtotalAmount').textContent = formatMoney(itemsSubtotal);
  document.getElementById('totalAmount').textContent = formatMoney(total);
  document.getElementById('totalProfitAmount').textContent = formatMoney(totalProfit);
  
  const paid = parseFloat(document.getElementById('paidAmount').value) || 0;
  const change = Math.max(0, paid - total);
  document.getElementById('changeAmount').textContent = formatMoney(change);

  return { total, totalProfit, itemsSubtotal, shippingCost, shippingExpense };
}

function collectItems() {
  const items = [];
  document.querySelectorAll('#itemsBody tr').forEach(row => {
    const desc = row.querySelector('.item-desc').value.trim();
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const cost = parseFloat(row.querySelector('.item-cost').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const stockId = row.dataset.stockId || null;
    if (desc) items.push({ desc, qty, cost, price, stockId });
  });
  return items;
}

function saveQuote() {
  const clientName = document.getElementById('clientName').value.trim();
  if (!clientName) return alert('Ingresá el nombre del cliente');
  const items = collectItems();
  if (!items.length) return alert('Agregá al menos un ítem');

  let quote = currentQuoteId ? quotes.find(q => q.id === currentQuoteId) : null;
  const isNew = !quote;
  
  if (isNew) {
    let counter = (parseInt(localStorage.getItem(COUNTER_KEY)) || 0) + 1;
    localStorage.setItem(COUNTER_KEY, counter);
    quote = { id: uid(), number: counter };
    quotes.push(quote);
    currentQuoteId = quote.id;
  }
  
  const previousStatus = quote.status;
  const calc = recalcTotal();

  quote.clientName = clientName;
  quote.clientPhone = document.getElementById('clientPhone').value.trim();
  quote.date = document.getElementById('quoteDate').value || new Date().toISOString().slice(0, 10);
  quote.deviceType = document.getElementById('deviceType').value;
  quote.deviceModel = document.getElementById('deviceModel').value.trim();
  quote.validityDays = parseInt(document.getElementById('validityDays').value) || 7;
  quote.status = document.getElementById('quoteStatus').value;
  quote.arrivalCondition = document.getElementById('arrivalCondition').value.trim();
  quote.issueDesc = document.getElementById('issueDesc').value.trim();
  quote.accessType = currentAccessType;
  quote.pattern = [...currentPattern];
  quote.pin = document.getElementById('accessPin').value;
  quote.password = document.getElementById('accessPassword').value;
  quote.items = items;
  quote.shippingCost = calc.shippingCost;
  quote.shippingExpense = calc.shippingExpense;
  quote.total = calc.total;
  quote.totalProfit = calc.totalProfit;
  quote.paidAmount = parseFloat(document.getElementById('paidAmount').value) || 0;
  quote.paymentMethod = document.getElementById('paymentMethod').value;

  if (quote.status === 'done' && previousStatus !== 'done') {
    registerCashMovement('income', quote.total, quote.paymentMethod, `Cobro Servicio Técnico - Orden #${quote.number}`);
    if (quote.shippingExpense > 0) {
      registerCashMovement('expense', quote.shippingExpense, 'Efectivo', `Gasto de Envío/Retiro - Orden #${quote.number}`);
    }
    quote.items.forEach(it => {
      if (it.stockId) {
        updateStockItemQty(it.stockId, -it.qty);
      }
    });
  }

  saveQuotesToStorage();
  document.getElementById('quoteStatusMsg').textContent = 'Presupuesto guardado correctamente.';
  setTimeout(() => document.getElementById('quoteStatusMsg').textContent = '', 3000);
  renderHistory();
}

function newQuote() {
  currentQuoteId = null;
  document.getElementById('clientName').value = '';
  document.getElementById('clientPhone').value = '';
  document.getElementById('quoteDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('deviceType').value = 'Celular';
  document.getElementById('deviceModel').value = '';
  document.getElementById('validityDays').value = '7';
  document.getElementById('quoteStatus').value = 'pending';
  document.getElementById('arrivalCondition').value = '';
  document.getElementById('issueDesc').value = '';
  document.getElementById('accessPin').value = '';
  document.getElementById('accessPassword').value = '';
  document.getElementById('shippingCost').value = '';
  document.getElementById('shippingExpense').value = '';
  document.getElementById('itemsBody').innerHTML = '';
  document.getElementById('paidAmount').value = '';
  document.getElementById('quoteNumberLabel').textContent = '';
  clearPattern();
  setAccessType('pattern');
  addItemRow();
  recalcTotal();
}

function editQuote(id) {
  const q = quotes.find(x => x.id === id);
  if (!q) return;
  currentQuoteId = q.id;
  document.getElementById('quoteNumberLabel').textContent = `#${q.number}`;
  document.getElementById('clientName').value = q.clientName || '';
  document.getElementById('clientPhone').value = q.clientPhone || '';
  document.getElementById('quoteDate').value = q.date || '';
  document.getElementById('deviceType').value = q.deviceType || 'Celular';
  document.getElementById('deviceModel').value = q.deviceModel || '';
  document.getElementById('validityDays').value = q.validityDays || 7;
  document.getElementById('quoteStatus').value = q.status || 'pending';
  document.getElementById('arrivalCondition').value = q.arrivalCondition || '';
  document.getElementById('issueDesc').value = q.issueDesc || '';
  document.getElementById('accessPin').value = q.pin || '';
  document.getElementById('accessPassword').value = q.password || '';
  document.getElementById('shippingCost').value = q.shippingCost || '';
  document.getElementById('shippingExpense').value = q.shippingExpense || '';
  document.getElementById('paidAmount').value = q.paidAmount || '';
  document.getElementById('paymentMethod').value = q.paymentMethod || 'Efectivo';
  
  setAccessType(q.accessType || 'none');
  currentPattern = q.pattern ? [...q.pattern] : [];
  redrawPattern();

  document.getElementById('itemsBody').innerHTML = '';
  if (q.items && q.items.length) {
    q.items.forEach(it => addItemRow(it.desc, it.qty, it.cost, it.price, it.stockId));
  } else {
    addItemRow();
  }
  recalcTotal();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteQuote(id) {
  if (!confirm('¿Seguro que querés eliminar este presupuesto?')) return;
  quotes = quotes.filter(x => x.id !== id);
  saveQuotesToStorage();
  if (currentQuoteId === id) newQuote();
  renderHistory();
  renderClients();
}

function renderHistory() {
  const search = document.getElementById('searchHistory').value.toLowerCase();
  const filterDev = document.getElementById('filterDevice').value;
  const filterSt = document.getElementById('filterStatus').value;
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');

  const filtered = quotes.filter(q => {
    const matchSearch = (q.clientName || '').toLowerCase().includes(search) || (q.deviceModel || '').toLowerCase().includes(search) || String(q.number).includes(search);
    const matchDev = !filterDev || q.deviceType === filterDev;
    const matchSt = !filterSt || q.status === filterSt;
    return matchSearch && matchDev && matchSt;
  });

  if (!filtered.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = filtered.map(q => {
    let stClass = 'status-pending', stText = 'Pendiente';
    if (q.status === 'done') { stClass = 'status-done'; stText = 'Terminado'; }
    if (q.status === 'failed') { stClass = 'status-failed'; stText = 'No realizado'; }

    return `
      <div class="history-item">
        <div>
          <strong>#${q.number} - ${escapeHtml(q.clientName)}</strong> <span class="cat-pill">${escapeHtml(q.deviceType)} ${escapeHtml(q.deviceModel)}</span>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            Fecha: ${q.date} | Total: ${formatMoney(q.total)} | Ganancia: <strong style="color:var(--green-success);">${formatMoney(q.totalProfit || 0)}</strong> | Pago: ${q.paymentMethod || 'Efectivo'} | Status: <span class="status-pill ${stClass}">${stText}</span>
          </div>
        </div>
        <div class="tarea-acciones">
          <button class="btn-secondary" onclick="editQuote('${q.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-ghost" onclick="previewTicket('${q.id}')"><i class="fa-solid fa-print"></i></button>
          <button class="btn-danger" onclick="deleteQuote('${q.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

/* ==================== VENTAS DIRECTAS DE STOCK (POS) ==================== */
function loadPOS() {
  try { posSales = JSON.parse(localStorage.getItem(POS_SALES_STORAGE)) || []; } catch (e) { posSales = []; }
}
function savePOS() { localStorage.setItem(POS_SALES_STORAGE, JSON.stringify(posSales)); }

function searchPOSProducts(query) {
  const resultsDiv = document.getElementById('posSearchResults');
  if (!query || query.trim() === '') {
    resultsDiv.style.display = 'none';
    return;
  }
  const filtered = stockItems.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
  if (!filtered.length) {
    resultsDiv.style.display = 'none';
    return;
  }
  resultsDiv.innerHTML = filtered.map(item => `
    <div class="stock-search-item" onclick="addToPOSCart('${item.id}')">
      <span><strong>${escapeHtml(item.name)}</strong> (${escapeHtml(item.category)}) - Disponible: ${item.qty}</span>
      <span style="color: var(--accent-blue);">${formatMoney(item.price)}</span>
    </div>
  `).join('');
  resultsDiv.style.display = 'block';
}

function addToPOSCart(stockId) {
  const item = stockItems.find(x => x.id === stockId);
  if (!item) return;
  if (item.qty <= 0) alert("Advertencia: El producto no tiene stock en el local.");

  const existing = posCart.find(x => x.stockId === stockId);
  if (existing) {
    existing.qty++;
  } else {
    posCart.push({
      stockId: item.id,
      name: item.name,
      price: item.price || 0,
      cost: item.cost || 0,
      qty: 1
    });
  }
  document.getElementById('searchPOS').value = '';
  document.getElementById('posSearchResults').style.display = 'none';
  renderPOSCart();
}

function renderPOSCart() {
  const tbody = document.getElementById('posCartBody');
  tbody.innerHTML = posCart.map((item, index) => {
    const sub = item.price * item.qty;
    const profit = (item.price - item.cost) * item.qty;
    return `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td><input type="number" min="1" value="${item.qty}" style="width:70px;" onchange="updatePOSCartQty(${index}, this.value)"></td>
        <td>${formatMoney(item.cost)}</td>
        <td>${formatMoney(item.price)}</td>
        <td>${formatMoney(sub)}</td>
        <td style="color: var(--green-success); font-weight: bold;">${formatMoney(profit)}</td>
        <td><button class="btn-danger" onclick="removePOSCartItem(${index})">✕</button></td>
      </tr>
    `;
  }).join('');
  recalcPOSTotal();
}

function updatePOSCartQty(index, val) {
  const q = parseInt(val) || 1;
  posCart[index].qty = Math.max(1, q);
  renderPOSCart();
}

function removePOSCartItem(index) {
  posCart.splice(index, 1);
  renderPOSCart();
}

function clearPOSCart() {
  posCart = [];
  renderPOSCart();
}

function recalcPOSTotal() {
  let total = 0;
  let totalProfit = 0;

  posCart.forEach(item => {
    total += item.price * item.qty;
    totalProfit += (item.price - item.cost) * item.qty;
  });

  document.getElementById('posTotalAmount').textContent = formatMoney(total);
  document.getElementById('posTotalProfitAmount').textContent = formatMoney(totalProfit);
  
  const paid = parseFloat(document.getElementById('posPaidAmount').value) || 0;
  const change = Math.max(0, paid - total);
  document.getElementById('posChangeAmount').textContent = formatMoney(change);

  return { total, totalProfit };
}

function confirmPOSSale() {
  if (!posCart.length) return alert("El carrito está vacío.");
  const calc = recalcPOSTotal();
  const method = document.getElementById('posPaymentMethod').value;

  const sale = {
    id: uid(),
    date: new Date().toISOString(),
    items: [...posCart],
    total: calc.total,
    totalProfit: calc.totalProfit,
    method: method
  };

  posCart.forEach(cartItem => {
    updateStockItemQty(cartItem.stockId, -cartItem.qty);
  });

  registerCashMovement('income', calc.total, method, `Venta Directa de Accesorios / Productos`);

  posSales.push(sale);
  savePOS();
  clearPOSCart();
  renderPOS();
  alert("Venta registrada con éxito y stock actualizado.");
}

function renderPOS() {
  renderPOSCart();
  const tbody = document.getElementById('posHistoryBody');
  tbody.innerHTML = posSales.slice().reverse().map(s => `
    <tr>
      <td><small>${new Date(s.date).toLocaleString('es-AR')}</small></td>
      <td>${s.items.map(i => `${escapeHtml(i.name)} (x${i.qty})`).join(', ')}</td>
      <td><span class="cat-pill">${s.method}</span></td>
      <td><strong>${formatMoney(s.total)}</strong></td>
      <td><strong style="color:var(--green-success);">${formatMoney(s.totalProfit || 0)}</strong></td>
      <td><button class="btn-danger" onclick="deletePOSSale('${s.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
}

function deletePOSSale(id) {
  if (!confirm("¿Eliminar esta venta del registro?")) return;
  posSales = posSales.filter(s => s.id !== id);
  savePOS();
  renderPOS();
}

/* ==================== CONTROL DE STOCK ==================== */
function loadStock() {
  try { stockItems = JSON.parse(localStorage.getItem(STOCK_STORAGE)) || []; } catch (e) { stockItems = []; }
}
function saveStock() {
  localStorage.setItem(STOCK_STORAGE, JSON.stringify(stockItems));
}

function toggleDescription() {
  const cat = document.getElementById('inputStockCategory').value;
  document.getElementById('descriptionRow').style.display = cat === 'Otros' ? 'block' : 'none';
}

function addStockItem() {
  const name = document.getElementById('inputStockName').value.trim();
  if (!name) return alert('Ingresa el nombre del producto');
  const category = document.getElementById('inputStockCategory').value;
  const price = parseFloat(document.getElementById('inputStockPrice').value) || null;
  const cost = parseFloat(document.getElementById('inputStockCost').value) || 0;
  const qty = parseInt(document.getElementById('inputStockQty').value) || 0;
  const deposit = parseInt(document.getElementById('inputStockDeposit').value) || 0;
  const desc = category === 'Otros' ? document.getElementById('inputStockDescription').value.trim() : '';

  stockItems.push({ id: uid(), name, category, price, cost, qty, deposit, desc });
  saveStock();
  renderStock();
  
  document.getElementById('inputStockName').value = '';
  document.getElementById('inputStockPrice').value = '';
  document.getElementById('inputStockCost').value = '';
  document.getElementById('inputStockQty').value = '1';
  document.getElementById('inputStockDeposit').value = '0';
  document.getElementById('inputStockDescription').value = '';
}

function updateQty(id, field, delta) {
  const item = stockItems.find(x => x.id === id);
  if (!item) return;
  item[field] = Math.max(0, (item[field] || 0) + delta);
  saveStock();
  renderStock();
}

function updateStockItemQty(id, delta) {
  const item = stockItems.find(x => x.id === id);
  if (item) {
    item.qty = Math.max(0, item.qty + delta);
    saveStock();
    renderStock();
  }
}

function deleteStockItem(id) {
  if (!confirm('¿Eliminar producto del stock?')) return;
  stockItems = stockItems.filter(x => x.id !== id);
  saveStock();
  renderStock();
}

function renderStock() {
  const search = document.getElementById('searchStock').value.toLowerCase();
  const filterCat = document.getElementById('filterStockCat').value;
  const tbody = document.getElementById('stockTbody');
  const empty = document.getElementById('stockEmptyMsg');

  const filtered = stockItems.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search) || (item.desc && item.desc.toLowerCase().includes(search));
    const matchCat = !filterCat || item.category === filterCat;
    return matchSearch && matchCat;
  });

  const totalItems = stockItems.reduce((acc, i) => acc + i.qty + i.deposit, 0);
  const totalLocal = stockItems.reduce((acc, i) => acc + i.qty, 0);
  const totalDep = stockItems.reduce((acc, i) => acc + i.deposit, 0);
  document.getElementById('stockSummary').innerHTML = `
    <div class="summary-item"><div class="num">${stockItems.length}</div><div class="label">Tipos de Productos</div></div>
    <div class="summary-item"><div class="num">${totalLocal}</div><div class="label">Unidades en Local</div></div>
    <div class="summary-item"><div class="num">${totalDep}</div><div class="label">Unidades en Depósito</div></div>
    <div class="summary-item"><div class="num">${totalItems}</div><div class="label">Total Stock</div></div>
  `;

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(item => {
    const unitProfit = item.price != null ? (item.price - (item.cost || 0)) : null;
    return `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong> ${item.desc ? `<br><small style="color:var(--text-muted);">${escapeHtml(item.desc)}</small>` : ''}</td>
        <td><span class="cat-pill">${escapeHtml(item.category)}</span></td>
        <td>
          <div class="qty-controls">
            <button onclick="updateQty('${item.id}', 'qty', -1)">-</button>
            <span class="qty-badge ${item.qty > 3 ? 'qty-ok' : (item.qty > 0 ? 'qty-low' : 'qty-zero')}">${item.qty}</span>
            <button onclick="updateQty('${item.id}', 'qty', 1)">+</button>
          </div>
        </td>
        <td>
          <div class="qty-controls">
            <button onclick="updateQty('${item.id}', 'deposit', -1)">-</button>
            <span class="qty-badge ${item.deposit > 3 ? 'qty-ok' : (item.deposit > 0 ? 'qty-low' : 'qty-zero')}">${item.deposit}</span>
            <button onclick="updateQty('${item.id}', 'deposit', 1)">+</button>
          </div>
        </td>
        <td>
          <small style="color:var(--text-muted);">Costo: ${formatMoney(item.cost || 0)}</small><br>
          <strong>P.Venta: ${item.price != null ? formatMoney(item.price) : '---'}</strong>
        </td>
        <td>
          <strong style="color: var(--green-success);">${unitProfit != null ? formatMoney(unitProfit) : '---'}</strong>
        </td>
        <td><button class="btn-danger" onclick="deleteStockItem('${item.id}')"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `;
  }).join('');
}

function exportCSV() {
  if (!stockItems.length) return alert('No hay items para exportar.');
  let csv = 'Producto,Categoria,Local,Deposito,Costo,Precio,GananciaUnitaria,Descripcion\n';
  stockItems.forEach(i => {
    const profit = i.price != null ? (i.price - (i.cost || 0)) : 0;
    csv += `"${i.name}","${i.category}",${i.qty},${i.deposit},${i.cost || 0},${i.price || 0},${profit},"${i.desc || ''}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'stock_qwerty_celufix.csv';
  link.click();
}

/* ==================== CAJA DIARIA Y ARQUEO ==================== */
function loadCash() {
  try { cashData = JSON.parse(localStorage.getItem(CASH_STORAGE)) || { isOpen: false, initialAmount: 0, movements: [] }; } 
  catch (e) { cashData = { isOpen: false, initialAmount: 0, movements: [] }; }
}
function saveCash() { localStorage.setItem(CASH_STORAGE, JSON.stringify(cashData)); }

function renderCashRegister() {
  document.getElementById('cashDateLabel').textContent = new Date().toLocaleDateString('es-AR');
  const badge = document.getElementById('cashBoxBadge');
  if (cashData.isOpen) {
    badge.textContent = 'Caja Abierta';
    badge.className = 'box-status box-open';
  } else {
    badge.textContent = 'Caja Cerrada';
    badge.className = 'box-status box-closed';
  }

  const initial = cashData.initialAmount || 0;
  let totalInc = 0;
  let totalExp = 0;
  
  const methods = { Efectivo: 0, Transferencia: 0, Tarjeta: 0, "Mercado Pago": 0 };

  (cashData.movements || []).forEach(m => {
    if (m.type === 'income') {
      totalInc += m.amount;
      if (methods[m.method] !== undefined) methods[m.method] += m.amount;
    } else if (m.type === 'expense') {
      totalExp += m.amount;
      if (methods[m.method] !== undefined) methods[m.method] -= m.amount;
    }
  });

  document.getElementById('boxInitialAmount').textContent = formatMoney(initial);
  document.getElementById('boxTotalIncome').textContent = formatMoney(totalInc);
  document.getElementById('boxTotalExpenses').textContent = formatMoney(totalExp);
  document.getElementById('boxCurrentBalance').textContent = formatMoney(initial + totalInc - totalExp);

  const breakDiv = document.getElementById('cashMethodsBreakdown');
  breakDiv.innerHTML = Object.keys(methods).map(m => `
    <div class="stat-card">
      <label>${m}</label>
      <div class="stat-val">${formatMoney(methods[m])}</div>
    </div>
  `).join('');

  const tbody = document.getElementById('cashMovementsBody');
  tbody.innerHTML = (cashData.movements || []).slice().reverse().map(m => `
    <tr>
      <td><small>${new Date(m.time).toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})}</small></td>
      <td>${escapeHtml(m.concept)}</td>
      <td><span class="cat-pill">${m.method}</span></td>
      <td style="color:${m.type === 'income' ? 'var(--green-success)' : '#ff5252'}; font-weight:bold;">
        ${m.type === 'income' ? '+' : '-'}${formatMoney(m.amount)}
      </td>
    </tr>
  `).join('');
}

function openCashModal(action) {
  currentCashAction = action;
  const modal = document.getElementById('modalCaja');
  const title = document.getElementById('modalCajaTitulo');
  const lblMonto = document.getElementById('lblCajaMonto');
  document.getElementById('fieldCajaMetodo').style.display = 'none';
  document.getElementById('fieldCajaConcepto').style.display = 'none';

  if (action === 'open') {
    title.textContent = "Apertura de Caja";
    lblMonto.textContent = "Monto Inicial en Efectivo";
  } else {
    title.textContent = "Cierre de Caja";
    lblMonto.textContent = "Monto Final Real Contado";
  }
  document.getElementById('inputCajaMonto').value = '';
  modal.style.display = 'flex';
}

function openCashMovementModal(type) {
  if (!cashData.isOpen) return alert("Debes abrir la caja antes de registrar movimientos.");
  currentCashAction = type;
  const modal = document.getElementById('modalCaja');
  const title = document.getElementById('modalCajaTitulo');
  const lblMonto = document.getElementById('lblCajaMonto');
  
  document.getElementById('fieldCajaMetodo').style.display = 'block';
  document.getElementById('fieldCajaConcepto').style.display = 'block';

  if (type === 'income') {
    title.textContent = "Ingreso Manual de Caja";
  } else {
    title.textContent = "Egreso / Gasto de Caja";
  }
  lblMonto.textContent = "Monto";
  document.getElementById('inputCajaMonto').value = '';
  document.getElementById('inputCajaConcepto').value = '';
  modal.style.display = 'flex';
}

function closeCashModal() {
  document.getElementById('modalCaja').style.display = 'none';
}

function confirmCashAction() {
  const monto = parseFloat(document.getElementById('inputCajaMonto').value) || 0;

  if (currentCashAction === 'open') {
    cashData.isOpen = true;
    cashData.initialAmount = monto;
    cashData.movements = [];
    saveCash();
  } else if (currentCashAction === 'close') {
    cashData.isOpen = false;
    saveCash();
  } else if (currentCashAction === 'income' || currentCashAction === 'expense') {
    const method = document.getElementById('selectCajaMetodo').value;
    const concept = document.getElementById('inputCajaConcepto').value.trim() || (currentCashAction === 'income' ? 'Ingreso vario' : 'Gasto vario');
    registerCashMovement(currentCashAction, monto, method, concept);
  }

  closeCashModal();
  renderCashRegister();
}

function registerCashMovement(type, amount, method, concept) {
  if (!cashData.movements) cashData.movements = [];
  cashData.movements.push({
    id: uid(),
    time: new Date().toISOString(),
    type: type,
    amount: amount,
    method: method || 'Efectivo',
    concept: concept
  });
  saveCash();
}

/* ==================== MÓDULO FINANCIERO ==================== */
function renderFinance() {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalExpenses = 0;

  let repairRevenue = 0;
  quotes.forEach(q => {
    if (q.status === 'done') {
      totalRevenue += (q.total || 0);
      repairRevenue += (q.total || 0);
      
      if (q.shippingExpense) {
        totalExpenses += q.shippingExpense;
      }

      if (q.items) {
        q.items.forEach(it => {
          totalCost += (it.cost || 0) * it.qty;
        });
      }
    }
  });

  let posRevenue = 0;
  posSales.forEach(s => {
    totalRevenue += (s.total || 0);
    posRevenue += (s.total || 0);
    s.items.forEach(it => {
      totalCost += (it.cost || 0) * it.qty;
    });
  });

  (cashData.movements || []).forEach(m => {
    if (m.type === 'expense') {
      totalExpenses += m.amount;
    }
  });

  const netProfit = totalRevenue - totalCost - totalExpenses;

  document.getElementById('finTotalRevenue').textContent = formatMoney(totalRevenue);
  document.getElementById('finTotalCost').textContent = formatMoney(totalCost);
  document.getElementById('finTotalExpenses').textContent = formatMoney(totalExpenses);
  document.getElementById('finNetProfit').textContent = formatMoney(netProfit);

  document.getElementById('financeSourceBreakdown').innerHTML = `
    <div style="margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span>Servicio Técnico / Reparaciones</span>
        <strong>${formatMoney(repairRevenue)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Ventas Directas de Stock</span>
        <strong>${formatMoney(posRevenue)}</strong>
      </div>
    </div>
  `;

  const methodsAcc = { Efectivo: 0, Transferencia: 0, Tarjeta: 0, "Mercado Pago": 0 };
  quotes.forEach(q => { if (q.status === 'done' && methodsAcc[q.paymentMethod] !== undefined) methodsAcc[q.paymentMethod] += (q.total || 0); });
  posSales.forEach(s => { if (methodsAcc[s.method] !== undefined) methodsAcc[s.method] += (s.total || 0); });

  document.getElementById('financeIncomeBreakdown').innerHTML = Object.keys(methodsAcc).map(m => `
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-color);">
      <span>${m}</span>
      <strong>${formatMoney(methodsAcc[m])}</strong>
    </div>
  `).join('');
}

/* ==================== MÓDULO DE CLIENTES ==================== */
function renderClients() {
  const search = document.getElementById('searchClients').value.toLowerCase();
  const list = document.getElementById('clientsList');
  const empty = document.getElementById('clientsEmpty');

  const clientMap = {};
  quotes.forEach(q => {
    const key = (q.clientName || 'Anónimo').trim();
    if (!clientMap[key]) {
      clientMap[key] = { name: key, phone: q.clientPhone, repairs: [] };
    }
    clientMap[key].repairs.push(q);
  });

  const clients = Object.values(clientMap).filter(c => 
    c.name.toLowerCase().includes(search) || (c.phone && c.phone.toLowerCase().includes(search))
  );

  if (!clients.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = clients.map(c => `
    <div class="client-card">
      <div class="client-header">
        <div class="client-name"><i class="fa-solid fa-user"></i> ${escapeHtml(c.name)} <span class="client-phone">${escapeHtml(c.phone ? ' - ' + c.phone : '')}</span></div>
        <div class="client-stats">Total Trabajos: ${c.repairs.length}</div>
      </div>
      <div class="client-repairs">
        ${c.repairs.map(r => {
          let stBadge = '<span class="status-pill status-pending">Pendiente</span>';
          if (r.status === 'done') stBadge = '<span class="status-pill status-done">Terminado</span>';
          if (r.status === 'failed') stBadge = '<span class="status-pill status-failed">No realizado</span>';

          return `
            <div class="repair-row">
              <div>
                <strong>#${r.number} -${escapeHtml(r.deviceType)} ${escapeHtml(r.deviceModel)}</strong> (${r.date})
                <div><small style="color:var(--text-muted);">${escapeHtml(r.issueDesc || 'Sin descripción de falla')}</small></div>
                ${r.unperformedReason ? `<div style="color:#ff5252; font-size:11px;">Razón: ${escapeHtml(r.unperformedReason)}</div>` : ''}
              </div>
              <div class="tarea-acciones">
                ${stBadge}
                <button class="btn-task-done" title="Marcar Terminado" onclick="marcarCompletado('${r.id}')"><i class="fa-solid fa-check"></i></button>
                <button class="btn-task-fail" title="Marcar No Realizado" onclick="abrirModal('${r.id}')"><i class="fa-solid fa-xmark"></i></button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

function marcarCompletado(quoteId) {
  if (quoteId) {
    const q = quotes.find(x => x.id === quoteId);
    if (q) {
      q.status = 'done';
      registerCashMovement('income', q.total, q.paymentMethod || 'Efectivo', `Cobro Servicio Técnico - Orden #${q.number}`);
      if (q.shippingExpense > 0) {
        registerCashMovement('expense', q.shippingExpense, 'Efectivo', `Gasto de Envío/Retiro - Orden #${q.number}`);
      }
      if (q.items) {
        q.items.forEach(it => { if (it.stockId) updateStockItemQty(it.stockId, -it.qty); });
      }
      saveQuotesToStorage();
      renderClients();
      renderHistory();
    }
  }
}

function abrirModal(quoteId) {
  selectedQuoteIdForModal = quoteId || null;
  document.getElementById('modalRazon').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modalRazon').style.display = 'none';
  document.getElementById('textoRazon').value = '';
  selectedQuoteIdForModal = null;
}

function guardarRazon() {
  const razon = document.getElementById('textoRazon').value;
  if (!razon.trim()) return alert("Por favor, ingresa el motivo.");

  if (selectedQuoteIdForModal) {
    const q = quotes.find(x => x.id === selectedQuoteIdForModal);
    if (q) {
      q.status = 'failed';
      q.unperformedReason = razon;
      saveQuotesToStorage();
      renderClients();
      renderHistory();
    }
  }
  cerrarModal();
}

/* ==================== MÓDULO COMPATIBILIDADES ==================== */
function loadCompat() {
  try { compatItems = JSON.parse(localStorage.getItem(COMPAT_STORAGE)) || []; } catch (e) { compatItems = []; }
  if (!compatItems.length) {
    compatItems = [
      { id: uid(), marca: 'Samsung', modelo: 'A12 / A02s / M12', tipo: 'Vidrio Templado', compatible: 'Vidrio Templado A12/A02s', notas: 'Estante A1' },
      { id: uid(), marca: 'Motorola', modelo: 'Moto G10 / G20 / G30', tipo: 'Funda', compatible: 'Funda G10/G20/G30 Universal', notas: 'Caja B2' }
    ];
    saveCompat();
  }
}
function saveCompat() { localStorage.setItem(COMPAT_STORAGE, JSON.stringify(compatItems)); }

function abrirModalCompat() { document.getElementById('modalAgregarCompat').style.display = 'flex'; }
function cerrarModalCompat() { document.getElementById('modalAgregarCompat').style.display = 'none'; }

function guardarNuevoCompat() {
  const marca = document.getElementById('newMarca').value;
  const modelo = document.getElementById('newModelo').value.trim();
  const tipo = document.getElementById('newTipo').value;
  const compatible = document.getElementById('newCompatible').value.trim();
  const notas = document.getElementById('newNotas').value.trim();

  if (!modelo || !compatible) return alert('Por favor completa los campos principales');

  compatItems.push({ id: uid(), marca, modelo, tipo, compatible, notas });
  saveCompat();
  renderCompat();
  cerrarModalCompat();
  
  document.getElementById('newModelo').value = '';
  document.getElementById('newCompatible').value = '';
  document.getElementById('newNotas').value = '';
}

function deleteCompat(id) {
  if (!confirm('¿Eliminar compatibilidad?')) return;
  compatItems = compatItems.filter(x => x.id !== id);
  saveCompat();
  renderCompat();
}

function filtrarCompat() { renderCompat(); }

function renderCompat() {
  const search = document.getElementById('searchCompat').value.toLowerCase();
  const filterBrand = document.getElementById('filterCompatBrand').value;
  const filterCat = document.getElementById('filterCompatCat').value;
  const tbody = document.getElementById('compatTbody');

  const filtered = compatItems.filter(item => {
    const matchSearch = item.modelo.toLowerCase().includes(search) || item.compatible.toLowerCase().includes(search);
    const matchBrand = !filterBrand || item.marca === filterBrand;
    const matchCat = !filterCat || item.tipo === filterCat;
    return matchSearch && matchBrand && matchCat;
  });

  tbody.innerHTML = filtered.map(item => {
    let catClass = 'cat-vidrio';
    if (item.tipo === 'Funda') catClass = 'cat-funda';
    if (item.tipo === 'Hydrogel') catClass = 'cat-hydrogel';

    return `
      <tr>
        <td><strong>${escapeHtml(item.marca)}</strong></td>
        <td>${escapeHtml(item.modelo)}</td>
        <td><span class="badge-cat ${catClass}">${escapeHtml(item.tipo)}</span></td>
        <td><strong style="color:var(--accent-blue);">${escapeHtml(item.compatible)}</strong></td>
        <td><small style="color:var(--text-muted);">${escapeHtml(item.notas || 'Sin notas')}</small></td>
        <td style="text-align: right;"><button class="btn-danger" onclick="deleteCompat('${item.id}')"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `;
  }).join('');
}

/* ==================== TICKET E IMPRESIÓN ==================== */
function previewTicket(quoteId) {
  const q = quoteId ? quotes.find(x => x.id === quoteId) : quotes.find(x => x.id === currentQuoteId);
  if (!q) return alert('Guarda el presupuesto primero para imprimir el ticket.');
  
  const content = generateTicketHtml(q);
  document.getElementById('ticketPreviewContent').innerHTML = content;
  document.getElementById('modalTicketPreview').style.display = 'flex';
}

function cerrarModalTicket() { document.getElementById('modalTicketPreview').style.display = 'none'; }

function ejecutarImpresion() {
  const content = document.getElementById('ticketPreviewContent').innerHTML;
  document.getElementById('printArea').innerHTML = content;
  cerrarModalTicket();
  window.print();
}

function printQuote() {
  if (!currentQuoteId) saveQuote();
  if (currentQuoteId) previewTicket(currentQuoteId);
}

function printProfessionalQuote(quoteId) {
  // Si el presupuesto todavía no fue guardado, lo guarda antes de generar el comprobante.
  if (!currentQuoteId) saveQuote();
  else saveQuote();
  if (!currentQuoteId) return;

  const q = quotes.find(x => x.id === (quoteId || currentQuoteId));
  if (!q) return alert('No se encontró el presupuesto.');

  const paid = Number(q.paidAmount) || 0;
  const total = Number(q.total) || 0;
  const balance = Math.max(0, total - paid);
  const itemsRows = (q.items || []).map((it, index) => `
    <tr>
      <td class="item-number">${index + 1}</td>
      <td>${escapeHtml(it.desc || '')}</td>
      <td class="center">${Number(it.qty) || 0}</td>
      <td class="money">${formatMoney(Number(it.price) || 0)}</td>
      <td class="money">${formatMoney((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
    </tr>
  `).join('');

  const statusLabels = { pending: 'Pendiente / No entregado', done: 'Terminado / Entregado', failed: 'No realizado' };
  const content = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boleta ${q.number} - QWERTY / CeluFix</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef2f7; color: #172033; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.45; }
  .toolbar { position: sticky; top: 0; padding: 12px; background: #172033; text-align: center; }
  .toolbar button { background: #08a9d7; border: 0; border-radius: 6px; color: white; padding: 10px 18px; font-size: 14px; font-weight: bold; cursor: pointer; margin: 0 5px; }
  .toolbar .close { background: #526071; }
  .page { width: 210mm; min-height: 297mm; margin: 18px auto; padding: 17mm 16mm; background: #fff; box-shadow: 0 4px 22px #0002; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 3px solid #08a9d7; padding-bottom: 18px; }
  .brand { font-size: 25px; font-weight: 900; letter-spacing: 1px; color: #172033; }
  .brand span { color: #08a9d7; }
  .subtitle { color: #64748b; margin-top: 4px; font-size: 12px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 19px; margin: 0; color: #172033; }
  .doc-title p { margin: 5px 0 0; color: #64748b; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
  .panel { border: 1px solid #dbe3ec; border-radius: 7px; padding: 12px 14px; }
  .panel h2 { color: #08a9d7; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px; }
  .fieldline { margin: 4px 0; }
  .fieldline strong { color: #273449; }
  .section-title { margin: 20px 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .8px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead { display: table-header-group; }
  th { background: #172033; color: #fff; font-size: 10px; text-align: left; padding: 10px 8px; }
  td { padding: 10px 8px; border-bottom: 1px solid #e5eaf0; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f7f9fc; }
  .item-number { width: 28px; color: #64748b; }
  .center { text-align: center; }
  .money { text-align: right; white-space: nowrap; }
  .description { min-height: 30px; white-space: pre-wrap; }
  .bottom { display: grid; grid-template-columns: 1fr 260px; gap: 22px; margin-top: 20px; align-items: start; }
  .totals { border: 1px solid #dbe3ec; border-radius: 8px; padding: 14px; }
  .total-line { display: flex; justify-content: space-between; gap: 12px; margin: 7px 0; }
  .total-line.grand { border-top: 1px solid #dbe3ec; padding-top: 12px; margin-top: 12px; font-size: 17px; font-weight: 800; }
  .total-line.deposit { color: #087f5b; }
  .total-line.balance { color: #b45309; font-size: 14px; font-weight: 800; border-top: 1px dashed #dbe3ec; padding-top: 10px; }
  .note-box { border-left: 3px solid #08a9d7; background: #f2faff; padding: 12px 14px; border-radius: 0 6px 6px 0; margin-top: 18px; }
  .footer { border-top: 1px solid #dbe3ec; margin-top: 34px; padding-top: 12px; display: flex; justify-content: space-between; color: #64748b; font-size: 10px; }
  .signature { margin-top: 46px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; }
  .signature div { border-top: 1px solid #aab5c3; text-align: center; padding-top: 7px; color: #64748b; }
  @page { size: A4; margin: 0; }
  @media print { body { background: #fff; } .toolbar { display: none; } .page { margin: 0; box-shadow: none; width: 210mm; min-height: 297mm; } }
  @media screen and (max-width: 800px) { .page { width: 100%; min-height: auto; margin: 0; padding: 20px; } .header { align-items: flex-start; flex-direction: column; } .doc-title { text-align: left; } .bottom { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button><button class="close" onclick="window.close()">Cerrar</button></div>
<main class="page">
  <header class="header">
    <div><div class="brand">QWERTY <span>/ CeluFix</span></div><div class="subtitle">Servicio Técnico Profesional</div></div>
    <div class="doc-title"><h1>BOLETA DE SERVICIO</h1><p>Comprobante de presupuesto y adelanto</p></div>
  </header>
  <section class="meta">
    <div class="panel"><h2>Datos del comprobante</h2>
      <div class="fieldline"><strong>N.º de orden:</strong> #${q.number}</div>
      <div class="fieldline"><strong>Fecha:</strong> ${escapeHtml(q.date || '')}</div>
      <div class="fieldline"><strong>Estado:</strong> ${escapeHtml(statusLabels[q.status] || 'Pendiente')}</div>
      <div class="fieldline"><strong>Validez del presupuesto:</strong> ${Number(q.validityDays) || 7} días</div>
    </div>
    <div class="panel"><h2>Datos del cliente</h2>
      <div class="fieldline"><strong>Cliente:</strong> ${escapeHtml(q.clientName || '')}</div>
      <div class="fieldline"><strong>Teléfono:</strong> ${escapeHtml(q.clientPhone || 'No informado')}</div>
      <div class="fieldline"><strong>Equipo:</strong> ${escapeHtml((q.deviceType || '') + ' ' + (q.deviceModel || ''))}</div>
      <div class="fieldline"><strong>Medio de pago:</strong> ${escapeHtml(q.paymentMethod || 'Efectivo')}</div>
    </div>
  </section>
  <div class="section-title">Detalle del trabajo / productos</div>
  <table><thead><tr><th style="width:30px">#</th><th>Descripción</th><th style="width:55px;text-align:center">Cant.</th><th style="width:100px;text-align:right">Precio unit.</th><th style="width:110px;text-align:right">Subtotal</th></tr></thead><tbody>${itemsRows}</tbody></table>
  ${q.shippingCost ? `<div class="total-line" style="margin-top:12px"><span>Envío / retiro</span><strong>${formatMoney(q.shippingCost)}</strong></div>` : ''}
  <section class="bottom">
    <div>
      <div class="section-title">Diagnóstico y observaciones</div>
      <div class="panel"><div class="fieldline"><strong>Falla / diagnóstico</strong></div><div class="description">${escapeHtml(q.issueDesc || 'Sin observaciones registradas')}</div>
      ${q.arrivalCondition ? `<div class="fieldline" style="margin-top:12px"><strong>Estado en que llegó el equipo</strong></div><div class="description">${escapeHtml(q.arrivalCondition)}</div>` : ''}</div>
      <div class="note-box">Este documento es un comprobante interno de servicio técnico y presupuesto; no reemplaza una factura fiscal. Conserve este comprobante para consultar el estado de la reparación.</div>
    </div>
    <div class="totals">
      <div class="total-line"><span>Subtotal de ítems</span><strong>${formatMoney((q.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0))}</strong></div>
      ${q.shippingCost ? `<div class="total-line"><span>Envío / retiro</span><strong>${formatMoney(q.shippingCost)}</strong></div>` : ''}
      <div class="total-line grand"><span>TOTAL</span><span>${formatMoney(total)}</span></div>
      <div class="total-line deposit"><span>Seña / adelanto</span><strong>${formatMoney(paid)}</strong></div>
      <div class="total-line balance"><span>Saldo pendiente</span><span>${formatMoney(balance)}</span></div>
    </div>
  </section>
  <div class="signature"><div>Firma del cliente</div><div>QWERTY / CeluFix</div></div>
  <footer class="footer"><span>QWERTY / CeluFix · Servicio Técnico Profesional</span><span>Orden #${q.number}</span></footer>
</main>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('El navegador bloqueó la ventana del comprobante. Permití las ventanas emergentes para este archivo e intentá nuevamente.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(content);
  printWindow.document.close();
}

function generateTicketHtml(q) {
  const paid = q.paidAmount || 0;
  const change = Math.max(0, paid - (q.total || 0));
  const itemsRows = (q.items || []).map(it => `
    <tr>
      <td>${escapeHtml(it.desc)}</td>
      <td style="text-align:center;">${it.qty}</td>
      <td style="text-align:right;">${formatMoney(it.price)}</td>
      <td style="text-align:right;">${formatMoney(it.qty * it.price)}</td>
    </tr>
  `).join('');

  return `
    <div class="ticket-container">
      <h1>QWERTY / CeluFix</h1>
      <h2>Servicio Técnico Profesional</h2>
      <div class="ticket-divider"></div>
      <div class="ticket-row"><span>Ticket #:</span><span>${q.number}</span></div>
      <div class="ticket-row"><span>Fecha:</span><span>${q.date}</span></div>
      <div class="ticket-row"><span>Cliente:</span><span>${escapeHtml(q.clientName)}</span></div>
      <div class="ticket-row"><span>Tel:</span><span>${escapeHtml(q.clientPhone || 'N/A')}</span></div>
      <div class="ticket-row"><span>Equipo:</span><span>${escapeHtml(q.deviceType)} ${escapeHtml(q.deviceModel)}</span></div>
      <div class="ticket-divider"></div>
      <table class="ticket-table">
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align:center;">Cant</th>
            <th style="text-align:right;">P.U.</th>
            <th style="text-align:right;">Subt.</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
      ${q.shippingCost ? `<div class="ticket-row"><span>Envío / Retiro:</span><span>${formatMoney(q.shippingCost)}</span></div>` : ''}
      <div class="ticket-divider"></div>
      <div class="ticket-totals">
        <div class="ticket-row bold"><span>TOTAL:</span><span>${formatMoney(q.total)}</span></div>
        <div class="ticket-row"><span>Medio Pago:</span><span>${q.paymentMethod || 'Efectivo'}</span></div>
        <div class="ticket-row"><span>Seña / Adelanto:</span><span>${formatMoney(paid)}</span></div>
        <div class="ticket-row"><span>Saldo pendiente:</span><span>${formatMoney(Math.max(0, (q.total || 0) - paid))}</span></div>
        ${change > 0 ? `<div class="ticket-row"><span>Excedente:</span><span>${formatMoney(change)}</span></div>` : ``}
      </div>
      <div class="ticket-divider"></div>
      <div class="ticket-footer">
        <p>Validez del presupuesto: ${q.validityDays} días</p>
        <p>¡Gracias por su preferencia!</p>
      </div>
    </div>
  `;
}

/* ==================== EXPORTAR / IMPORTAR DATOS ==================== */
function exportarDatos() {
  const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } };
  const datos = {
    compatibilidades: leer(COMPAT_STORAGE, []),
    clientes_presupuestos: leer(QUOTES_STORAGE, []),
    stock: leer(STOCK_STORAGE, []),
    ventas: leer(POS_SALES_STORAGE, []),
    caja: leer(CASH_STORAGE, null),
    contador_presupuestos: parseInt(localStorage.getItem(COUNTER_KEY)) || 0
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
  a.download = 'datos_celufix_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}

function importarDatos(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    let datos;
    try { datos = JSON.parse(reader.result); } catch (e) { input.value = ''; return alert('El archivo no es un JSON válido.'); }
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) { input.value = ''; return alert('El formato del archivo no es el esperado.'); }

    const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } };
    // Une listas sin duplicar por id
    const unir = (clave, entrantes) => {
      if (!Array.isArray(entrantes)) return 0;
      const actuales = leer(clave, []);
      const ids = new Set(actuales.map(x => x && x.id));
      let nuevos = 0;
      entrantes.forEach(x => { if (x && (!x.id || !ids.has(x.id))) { if (!x.id) x.id = uid(); actuales.push(x); nuevos++; } });
      localStorage.setItem(clave, JSON.stringify(actuales));
      return nuevos;
    };

    const resumen = [];
    const c = unir(COMPAT_STORAGE, datos.compatibilidades);
    if (datos.compatibilidades) resumen.push(c + ' compatibilidades');
    const q = unir(QUOTES_STORAGE, datos.clientes_presupuestos);
    if (datos.clientes_presupuestos) resumen.push(q + ' presupuestos/clientes');
    const st = unir(STOCK_STORAGE, datos.stock);
    if (datos.stock) resumen.push(st + ' items de stock');
    const v = unir(POS_SALES_STORAGE, datos.ventas);
    if (datos.ventas) resumen.push(v + ' ventas');

    if (datos.caja && typeof datos.caja === 'object' && !localStorage.getItem(CASH_STORAGE)) {
      localStorage.setItem(CASH_STORAGE, JSON.stringify(datos.caja));
      resumen.push('caja');
    }

    // Que el próximo presupuesto no repita número
    const todos = leer(QUOTES_STORAGE, []);
    const maxNum = todos.reduce((m, x) => Math.max(m, parseInt(x && x.number) || 0), 0);
    const contador = Math.max(parseInt(localStorage.getItem(COUNTER_KEY)) || 0, parseInt(datos.contador_presupuestos) || 0, maxNum);
    localStorage.setItem(COUNTER_KEY, contador);

    input.value = '';
    alert('Importación lista. Se agregaron: ' + (resumen.join(', ') || 'nada (no se encontraron datos reconocibles)') + '.');
    loadQuotes(); loadStock(); loadCompat(); loadPOS(); loadCash();
    renderHistory(); renderStock(); renderCompat(); renderPOS(); renderCashRegister(); renderFinance(); renderClients();
  };
  reader.readAsText(file);
}

/* ==================== INICIALIZACIÓN ==================== */
window.onload = function() {
  buildPatternGrid();
  loadQuotes();
  loadStock();
  loadCompat();
  loadPOS();
  loadCash();

  document.getElementById('quoteDate').value = new Date().toISOString().slice(0, 10);
  addItemRow();
  renderHistory();
  renderStock();
  renderCompat();
  renderPOS();
  renderCashRegister();
  renderFinance();
};