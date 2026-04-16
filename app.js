const API_URL = "https://script.google.com/macros/s/AKfycbxtBvNJ-zjAAro3MRHrtpr90rKZ1I9OitxoqgF9wZqkMj8M8xtZbq2rLSAbh9HAwnY/exec";
const DELETED_MARK = "__deleted__";
const LEGACY_PRODUCT_IMAGES = {
  "cuaderno argollado": "Imagenes/cuaderno.png",
  "lapicero azul": "Imagenes/lapicero.jpg",
  "resaltador amarillo": "Imagenes/resaltador.jpg",
  "regla 30 cm": "Imagenes/regla.jpg",
  "borrador": "Imagenes/borrador.jpg",
  "lapiz": "Imagenes/lapiz.png",
  "marcador permanente": "Imagenes/marcador.png",
  "tijeras": "Imagenes/tijeras.jpg",
  "pegastick": "Imagenes/pegastick.jpg",
  "carpeta": "Imagenes/carpeta.jpg",
  "calculadora": "Imagenes/calculadora.jpg",
  "post-it": "Imagenes/postit.jpg",
  "post it": "Imagenes/postit.jpg",
};


function createEmptySale() {
  return {
    id: null,
    fecha: null,
    clientId: "",
    items: [],
    paymentMethod: "Efectivo",
    cashReceived: 0,
    change: 0,
    estado: "nueva",
  };
}

function createEmptyPurchase() {
  return {
    providerId: "",
    method: "Efectivo",
    items: [],
  };
}

const state = {
  products: [],
  categories: [],
  clients: [],
  providers: [],
  sales: [],
  purchases: [],
  currentSale: createEmptySale(),
  currentPurchase: createEmptyPurchase(),
  ui: {
    currentView: "saleView",
    lastSaleId: null,
    productModalEditingId: null,
    invoiceBackTo: "sales",
    clientEditingId: null,
    providerEditingId: null,
    categoryEditingId: null,
  },
};

function formatCOP(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(iso) {
  if (!iso) return "Sin fecha";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegative(value) {
  return Math.max(0, toNumber(value, 0));
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "si" || normalized === "sí" || normalized === "1";
}

function normalizeSalePaymentMethod(value) {
  const normalized = normalizeText(value, "Efectivo");
  return normalized === "Debito" ? "Debe" : (normalized || "Efectivo");
}

function parseItemsJson(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildId(prefix) {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${Date.now()}-${random}`;
}

function showPageStatus(text, type = "info") {
  const statusEl = document.querySelector("#pageStatus");
  statusEl.textContent = text;
  statusEl.classList.remove("hidden");
  statusEl.style.background = type === "error" ? "#fff1f2" : type === "success" ? "#ecfdf5" : "#eef4ff";
  statusEl.style.borderColor = type === "error" ? "#fecdd3" : type === "success" ? "#bbf7d0" : "#dbe7ff";
}

function hidePageStatus() {
  const statusEl = document.querySelector("#pageStatus");
  statusEl.textContent = "";
  statusEl.classList.add("hidden");
}

async function apiGet(resource) {
  const response = await fetch(`${API_URL}?resource=${resource}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || `No fue posible cargar ${resource}`);
  }
  return result.data || [];
}

async function apiPost(resource, payload) {
  const response = await fetch(`${API_URL}?resource=${resource}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || `No fue posible guardar en ${resource}`);
  }
  return result;
}

function normalizeCategory(raw) {
  return {
    id: normalizeText(raw.id),
    nombre: normalizeText(raw.nombre),
    color: normalizeText(raw.color, "#4F46E5") || "#4F46E5",
    icono: normalizeText(raw.icono),
  };
}

function normalizeClient(raw) {
  return {
    id: normalizeText(raw.id),
    nombre: normalizeText(raw.nombre),
    telefono: normalizeText(raw.telefono),
    correo: normalizeText(raw.correo),
  };
}

function normalizeProvider(raw) {
  return {
    id: normalizeText(raw.id),
    nombre: normalizeText(raw.nombre),
    nit: normalizeText(raw.nit),
    telefono: normalizeText(raw.telefono),
    correo: normalizeText(raw.correo),
  };
}

function normalizeProduct(raw) {
  return {
    id: normalizeText(raw.id),
    nombre: normalizeText(raw.nombre),
    categoriaId: normalizeText(raw.categoriaId),
    precio: nonNegative(raw.precio),
    costo: nonNegative(raw.costo),
    stock: nonNegative(raw.stock),
    seguimientoInventario: toBoolean(raw.seguimientoInventario),
    codigoInterno: normalizeText(raw.codigoInterno),
    codigoBarras: normalizeText(raw.codigoBarras),
    imagenUrl: normalizeText(raw.imagenUrl || raw.imagen || raw.foto || raw.imageUrl),
  };
}

function normalizeSale(raw) {
  const metodoPago = normalizeSalePaymentMethod(raw.metodoPago);
  const total = nonNegative(raw.total);
  return {
    id: normalizeText(raw.id),
    fecha: normalizeText(raw.fecha),
    clienteId: normalizeText(raw.clienteId),
    metodoPago,
    estado: normalizeText(raw.estado, "cerrada") || "cerrada",
    total,
    saldoPendiente: raw.saldoPendiente === undefined || raw.saldoPendiente === null || raw.saldoPendiente === ""
      ? (metodoPago === "Debe" ? total : 0)
      : nonNegative(raw.saldoPendiente),
    items: parseItemsJson(raw.itemsJson),
  };
}

function normalizePurchase(raw) {
  return {
    id: normalizeText(raw.id),
    fecha: normalizeText(raw.fecha),
    proveedorId: normalizeText(raw.proveedorId),
    metodoPago: normalizeText(raw.metodoPago, "Efectivo") || "Efectivo",
    total: nonNegative(raw.total),
    items: parseItemsJson(raw.itemsJson),
  };
}

function dedupeLatest(records, normalizeFn, isDeletedFn = null) {
  const map = new Map();
  records.forEach((record) => {
    const normalized = normalizeFn(record);
    if (!normalized.id) return;
    map.set(normalized.id, normalized);
  });
  let values = Array.from(map.values());
  if (isDeletedFn) {
    values = values.filter((item) => !isDeletedFn(item));
  }
  return values;
}

function sortByName(list) {
  return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function sortByDateDesc(list) {
  return [...list].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
}

function getCategoryName(categoryId) {
  const category = state.categories.find((item) => item.id === categoryId);
  return category ? category.nombre : "Sin categoría";
}

function findClientById(clientId) {
  return state.clients.find((item) => item.id === clientId);
}

function resolveProductImage(product) {
  const storedImage = normalizeText(product?.imagenUrl);
  if (storedImage) return storedImage;
  const byName = LEGACY_PRODUCT_IMAGES[normalizeKey(product?.nombre)];
  if (byName) return byName;
  const byCode = LEGACY_PRODUCT_IMAGES[normalizeKey(product?.codigoInterno)];
  if (byCode) return byCode;
  return "";
}

function renderProductImage(product, altText = "") {
  const imageUrl = resolveProductImage(product);
  if (!imageUrl) {
    return '<div class="product-card__image product-card__image--placeholder">Sin foto</div>';
  }
  return `<img class="product-card__image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText || product?.nombre || "Producto")}" loading="lazy" onerror="this.outerHTML='&lt;div class=&quot;product-card__image product-card__image--placeholder&quot;&gt;Sin foto&lt;/div&gt;'" />`;
}

function isGeneralClient(clientId) {
  const client = findClientById(clientId);
  return Boolean(client) && client.nombre.trim().toLowerCase() === "cliente general";
}

function getClientName(clientId) {
  if (!clientId) return "Sin cliente";
  const client = findClientById(clientId);
  return client ? client.nombre : clientId;
}

function getProviderName(providerId) {
  if (!providerId) return "Sin proveedor";
  const provider = state.providers.find((item) => item.id === providerId);
  return provider ? provider.nombre : providerId;
}

function findProductById(productId) {
  return state.products.find((product) => product.id === productId);
}

function findSaleById(saleId) {
  return state.sales.find((sale) => sale.id === saleId);
}

function getSaleTotal() {
  return state.currentSale.items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
}

function getPurchaseTotal() {
  return state.currentPurchase.items.reduce((acc, item) => acc + (item.costo * item.cantidad), 0);
}

function setMessage(element, text, type = "info") {
  element.textContent = text;
  element.classList.remove("hidden");
  element.style.background = type === "error" ? "#fff1f2" : type === "success" ? "#ecfdf5" : "#eef4ff";
  element.style.borderColor = type === "error" ? "#fecdd3" : type === "success" ? "#bbf7d0" : "#dbe7ff";
}

function clearMessage(element) {
  element.textContent = "";
  element.classList.add("hidden");
}

const refs = {
  goSaleBtn: document.querySelector("#goSaleBtn"),
  goSalesBtn: document.querySelector("#goSalesBtn"),
  goProductsBtn: document.querySelector("#goProductsBtn"),
  goPurchasesBtn: document.querySelector("#goPurchasesBtn"),
  goClientsBtn: document.querySelector("#goClientsBtn"),
  goProvidersBtn: document.querySelector("#goProvidersBtn"),
  goCategoriesBtn: document.querySelector("#goCategoriesBtn"),
  views: {
    saleView: document.querySelector("#saleView"),
    saleConfirmationView: document.querySelector("#saleConfirmationView"),
    salesView: document.querySelector("#salesView"),
    invoiceView: document.querySelector("#invoiceView"),
    productsView: document.querySelector("#productsView"),
    purchasesView: document.querySelector("#purchasesView"),
    clientsView: document.querySelector("#clientsView"),
    providersView: document.querySelector("#providersView"),
    categoriesView: document.querySelector("#categoriesView"),
  },
  headerSaleTotal: document.querySelector("#headerSaleTotal"),
  saleSearchInput: document.querySelector("#saleSearchInput"),
  saleProducts: document.querySelector("#saleProducts"),
  saleClientSelect: document.querySelector("#saleClientSelect"),
  openQuickClientBtn: document.querySelector("#openQuickClientBtn"),
  saleCart: document.querySelector("#saleCart"),
  emptySale: document.querySelector("#emptySale"),
  saleTotal: document.querySelector("#saleTotal"),
  paymentMethod: document.querySelector("#paymentMethod"),
  debtFields: document.querySelector("#debtFields"),
  debtPending: document.querySelector("#debtPending"),
  cashFields: document.querySelector("#cashFields"),
  cashReceived: document.querySelector("#cashReceived"),
  cashChange: document.querySelector("#cashChange"),
  saveOpenSaleBtn: document.querySelector("#saveOpenSaleBtn"),
  discardSaleBtn: document.querySelector("#discardSaleBtn"),
  confirmSaleBtn: document.querySelector("#confirmSaleBtn"),
  newSaleBtn: document.querySelector("#newSaleBtn"),
  saleMessage: document.querySelector("#saleMessage"),
  confirmationText: document.querySelector("#confirmationText"),
  confirmationNewSaleBtn: document.querySelector("#confirmationNewSaleBtn"),
  confirmationInvoiceBtn: document.querySelector("#confirmationInvoiceBtn"),
  confirmationHistoryBtn: document.querySelector("#confirmationHistoryBtn"),
  salesSearchInput: document.querySelector("#salesSearchInput"),
  salesStatusFilter: document.querySelector("#salesStatusFilter"),
  emptySales: document.querySelector("#emptySales"),
  salesList: document.querySelector("#salesList"),
  invoiceContainer: document.querySelector("#invoiceContainer"),
  invoiceBackBtn: document.querySelector("#invoiceBackBtn"),
  productSearchInput: document.querySelector("#productSearchInput"),
  productsList: document.querySelector("#productsList"),
  productsMessage: document.querySelector("#productsMessage"),
  openCreateProductBtn: document.querySelector("#openCreateProductBtn"),
  purchaseSearchInput: document.querySelector("#purchaseSearchInput"),
  purchaseProducts: document.querySelector("#purchaseProducts"),
  purchaseProviderSelect: document.querySelector("#purchaseProviderSelect"),
  purchaseMethodSelect: document.querySelector("#purchaseMethodSelect"),
  purchaseCart: document.querySelector("#purchaseCart"),
  emptyPurchase: document.querySelector("#emptyPurchase"),
  purchaseTotal: document.querySelector("#purchaseTotal"),
  savePurchaseBtn: document.querySelector("#savePurchaseBtn"),
  resetPurchaseBtn: document.querySelector("#resetPurchaseBtn"),
  purchaseMessage: document.querySelector("#purchaseMessage"),
  emptyPurchases: document.querySelector("#emptyPurchases"),
  purchasesList: document.querySelector("#purchasesList"),
  clientSearchInput: document.querySelector("#clientSearchInput"),
  clientsList: document.querySelector("#clientsList"),
  clientForm: document.querySelector("#clientForm"),
  clientFormTitle: document.querySelector("#clientFormTitle"),
  clientName: document.querySelector("#clientName"),
  clientPhone: document.querySelector("#clientPhone"),
  clientEmail: document.querySelector("#clientEmail"),
  cancelClientEditBtn: document.querySelector("#cancelClientEditBtn"),
  resetClientBtn: document.querySelector("#resetClientBtn"),
  clientMessage: document.querySelector("#clientMessage"),
  providerSearchInput: document.querySelector("#providerSearchInput"),
  providersList: document.querySelector("#providersList"),
  providerForm: document.querySelector("#providerForm"),
  providerFormTitle: document.querySelector("#providerFormTitle"),
  providerName: document.querySelector("#providerName"),
  providerNit: document.querySelector("#providerNit"),
  providerPhone: document.querySelector("#providerPhone"),
  providerEmail: document.querySelector("#providerEmail"),
  cancelProviderEditBtn: document.querySelector("#cancelProviderEditBtn"),
  resetProviderBtn: document.querySelector("#resetProviderBtn"),
  providerMessage: document.querySelector("#providerMessage"),
  categorySearchInput: document.querySelector("#categorySearchInput"),
  categoriesList: document.querySelector("#categoriesList"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryFormTitle: document.querySelector("#categoryFormTitle"),
  categoryName: document.querySelector("#categoryName"),
  categoryColor: document.querySelector("#categoryColor"),
  categoryIcon: document.querySelector("#categoryIcon"),
  cancelCategoryEditBtn: document.querySelector("#cancelCategoryEditBtn"),
  resetCategoryBtn: document.querySelector("#resetCategoryBtn"),
  categoryMessage: document.querySelector("#categoryMessage"),
  confirmModal: document.querySelector("#confirmModal"),
  confirmModalTitle: document.querySelector("#confirmModalTitle"),
  confirmModalMessage: document.querySelector("#confirmModalMessage"),
  closeConfirmModalBtn: document.querySelector("#closeConfirmModalBtn"),
  confirmModalCancelBtn: document.querySelector("#confirmModalCancelBtn"),
  confirmModalAcceptBtn: document.querySelector("#confirmModalAcceptBtn"),
  productModal: document.querySelector("#productModal"),
  productModalTitle: document.querySelector("#productModalTitle"),
  closeProductModalBtn: document.querySelector("#closeProductModalBtn"),
  productForm: document.querySelector("#productForm"),
  pName: document.querySelector("#pName"),
  pCategory: document.querySelector("#pCategory"),
  pPrice: document.querySelector("#pPrice"),
  pCost: document.querySelector("#pCost"),
  pCode: document.querySelector("#pCode"),
  pBarcode: document.querySelector("#pBarcode"),
  pImageUrl: document.querySelector("#pImageUrl"),
  pImageFile: document.querySelector("#pImageFile"),
  productImagePreview: document.querySelector("#productImagePreview"),
  pTrack: document.querySelector("#pTrack"),
  pStock: document.querySelector("#pStock"),
  stockRow: document.querySelector("#stockRow"),
  productMessage: document.querySelector("#productMessage"),
};


const confirmModalState = {
  resolve: null,
};

function askForConfirmation({
  title = "Confirmar acción",
  message = "¿Deseas continuar?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmClass = "btn-danger",
} = {}) {
  refs.confirmModalTitle.textContent = title;
  refs.confirmModalMessage.textContent = message;
  refs.confirmModalAcceptBtn.textContent = confirmText;
  refs.confirmModalCancelBtn.textContent = cancelText;
  refs.confirmModalAcceptBtn.className = confirmClass;
  refs.confirmModal.classList.remove("hidden");

  return new Promise((resolve) => {
    confirmModalState.resolve = resolve;
  });
}

function closeConfirmModal(answer = false) {
  refs.confirmModal.classList.add("hidden");
  if (confirmModalState.resolve) {
    const resolve = confirmModalState.resolve;
    confirmModalState.resolve = null;
    resolve(answer);
  }
}

function showView(viewName) {
  Object.entries(refs.views).forEach(([name, el]) => {
    el.classList.toggle("hidden", name !== viewName);
  });
  state.ui.currentView = viewName;
}

function goToSale() {
  showView("saleView");
  renderSaleView();
}

function goToSales() {
  showView("salesView");
  renderSalesView();
}

function goToProducts() {
  showView("productsView");
  renderProductsView();
}

function goToPurchases() {
  showView("purchasesView");
  renderPurchasesView();
}

function goToClients() {
  showView("clientsView");
  renderClientsView();
}

function goToProviders() {
  showView("providersView");
  renderProvidersView();
}

function goToCategories() {
  showView("categoriesView");
  renderCategoriesView();
}

async function loadAllData() {
  showPageStatus("Cargando información desde Google Sheets...");
  const [products, sales, purchases, clients, providers, categories] = await Promise.all([
    apiGet("productos"),
    apiGet("ventas"),
    apiGet("compras"),
    apiGet("clientes"),
    apiGet("proveedores"),
    apiGet("categorias"),
  ]);

  state.categories = sortByName(
    dedupeLatest(categories, normalizeCategory, (item) => item.nombre === DELETED_MARK || !item.nombre)
  );
  state.clients = sortByName(
    dedupeLatest(clients, normalizeClient, (item) => item.nombre === DELETED_MARK || !item.nombre)
  );
  state.providers = sortByName(
    dedupeLatest(providers, normalizeProvider, (item) => item.nombre === DELETED_MARK || !item.nombre)
  );
  state.products = sortByName(
    dedupeLatest(products, normalizeProduct, (item) => item.nombre === DELETED_MARK || !item.nombre)
  );
  state.sales = sortByDateDesc(dedupeLatest(sales, normalizeSale));
  state.purchases = sortByDateDesc(dedupeLatest(purchases, normalizePurchase));

  populateSaleClientOptions();
  populatePurchaseProviderOptions();
  populateProductCategoryOptions();

  hidePageStatus();
}

function populateSaleClientOptions() {
  const options = [
    `<option value="">Sin cliente</option>`,
    ...state.clients.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.nombre)}</option>`),
  ];
  refs.saleClientSelect.innerHTML = options.join("");
  refs.saleClientSelect.value = state.currentSale.clientId || "";
}

function populatePurchaseProviderOptions() {
  const options = [
    `<option value="">Selecciona un proveedor</option>`,
    ...state.providers.map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.nombre)}</option>`),
  ];
  refs.purchaseProviderSelect.innerHTML = options.join("");
  refs.purchaseProviderSelect.value = state.currentPurchase.providerId || "";
}

function populateProductCategoryOptions() {
  const options = [
    `<option value="">Selecciona una categoría</option>`,
    ...state.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.nombre)}</option>`),
  ];
  refs.pCategory.innerHTML = options.join("");
}

function renderSaleView() {
  renderSaleProducts();
  renderSaleCart();
  refs.saleClientSelect.value = state.currentSale.clientId || "";
  refs.paymentMethod.value = state.currentSale.paymentMethod;
  refs.cashReceived.value = state.currentSale.cashReceived || "";
  updateCashUI();
}

function renderSaleProducts() {
  const query = refs.saleSearchInput.value.toLowerCase().trim();
  const products = state.products.filter((product) => {
    const text = `${product.nombre} ${product.codigoInterno} ${product.codigoBarras}`.toLowerCase();
    return text.includes(query);
  });

  refs.saleProducts.innerHTML = products.length
    ? products.map((product) => buildSaleProductCard(product)).join("")
    : `<p class="muted">No se encontraron productos.</p>`;

  refs.saleProducts.querySelectorAll("[data-add-sale-product]").forEach((button) => {
    button.addEventListener("click", () => addProductToSale(button.dataset.addSaleProduct));
  });
  refs.saleProducts.querySelectorAll("[data-edit-sale-product]").forEach((button) => {
    button.addEventListener("click", () => openProductModal(button.dataset.editSaleProduct));
  });
}

function buildSaleProductCard(product) {
  const stockText = product.seguimientoInventario
    ? `Stock: <strong>${product.stock}</strong>`
    : `Sin inventario`;
  const disabled = product.seguimientoInventario && product.stock <= 0 ? "disabled" : "";
  return `
    <article class="product-card">
      <div class="product-card__meta">
        <h3>${escapeHtml(product.nombre)}</h3>
        <span class="muted">${escapeHtml(product.codigoInterno || product.id)} · ${escapeHtml(getCategoryName(product.categoriaId))}</span>
        <span>${formatCOP(product.precio)}</span>
        <span class="muted">${stockText}</span>
      </div>
      <div class="product-card__actions">
        <button type="button" data-add-sale-product="${escapeHtml(product.id)}" ${disabled}>Agregar</button>
        <button type="button" data-edit-sale-product="${escapeHtml(product.id)}" class="btn-secondary">Editar</button>
      </div>
    </article>
  `;
}

function addProductToSale(productId) {
  const product = findProductById(productId);
  if (!product) return;

  const existing = state.currentSale.items.find((item) => item.productId === productId);
  if (existing) {
    existing.cantidad += 1;
    existing.precio = product.precio;
    existing.nombre = product.nombre;
    existing.codigoInterno = product.codigoInterno;
  } else {
    state.currentSale.items.push({
      productId: product.id,
      nombre: product.nombre,
      codigoInterno: product.codigoInterno,
      categoriaId: product.categoriaId,
      cantidad: 1,
      precio: product.precio,
    });
  }
  renderSaleCart();
}

function removeSaleItem(productId) {
  state.currentSale.items = state.currentSale.items.filter((item) => item.productId !== productId);
  renderSaleCart();
}

function changeSaleItemQty(productId, delta) {
  const item = state.currentSale.items.find((entry) => entry.productId === productId);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    removeSaleItem(productId);
    return;
  }
  renderSaleCart();
}

function renderSaleCart() {
  clearMessage(refs.saleMessage);
  refs.emptySale.style.display = state.currentSale.items.length ? "none" : "block";

  refs.saleCart.innerHTML = state.currentSale.items.map((item) => {
    const subtotal = item.cantidad * item.precio;
    return `
      <article class="cart-item">
        <div class="cart-item__header">
          <div class="list-item__meta">
            <strong>${escapeHtml(item.nombre)}</strong>
            <span class="muted">${escapeHtml(item.codigoInterno || item.productId)}</span>
            <span>Subtotal: <strong>${formatCOP(subtotal)}</strong></span>
          </div>
          <div class="quantity-controls">
            <button type="button" data-sale-dec="${escapeHtml(item.productId)}">-</button>
            <span>${item.cantidad}</span>
            <button type="button" data-sale-inc="${escapeHtml(item.productId)}">+</button>
            <button type="button" data-sale-remove="${escapeHtml(item.productId)}" class="btn-danger">Eliminar</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  refs.saleCart.querySelectorAll("[data-sale-inc]").forEach((button) => {
    button.addEventListener("click", () => changeSaleItemQty(button.dataset.saleInc, 1));
  });
  refs.saleCart.querySelectorAll("[data-sale-dec]").forEach((button) => {
    button.addEventListener("click", () => changeSaleItemQty(button.dataset.saleDec, -1));
  });
  refs.saleCart.querySelectorAll("[data-sale-remove]").forEach((button) => {
    button.addEventListener("click", () => removeSaleItem(button.dataset.saleRemove));
  });

  const total = getSaleTotal();
  refs.saleTotal.textContent = formatCOP(total);
  refs.headerSaleTotal.textContent = formatCOP(total);
  updateCashUI();
}

function updateCashUI() {
  state.currentSale.paymentMethod = normalizeSalePaymentMethod(refs.paymentMethod.value);
  const isCash = state.currentSale.paymentMethod === "Efectivo";
  const isDebt = state.currentSale.paymentMethod === "Debe";

  if (isDebt && isGeneralClient(refs.saleClientSelect.value || state.currentSale.clientId)) {
    state.currentSale.clientId = "";
    refs.saleClientSelect.value = "";
    setMessage(refs.saleMessage, "Para ventas con método Debe debes seleccionar o crear un cliente diferente de Cliente General.", "info");
  }

  refs.cashFields.classList.toggle("hidden", !isCash);
  refs.debtFields.classList.toggle("hidden", !isDebt);
  updateCashChange();
}

function updateCashChange() {
  const total = getSaleTotal();
  const isCash = state.currentSale.paymentMethod === "Efectivo";
  const isDebt = state.currentSale.paymentMethod === "Debe";

  if (!isCash) {
    state.currentSale.cashReceived = 0;
    state.currentSale.change = 0;
    refs.cashChange.textContent = formatCOP(0);
  } else {
    state.currentSale.cashReceived = nonNegative(refs.cashReceived.value);
    state.currentSale.change = Math.max(0, state.currentSale.cashReceived - total);
    refs.cashChange.textContent = formatCOP(state.currentSale.change);
  }

  refs.debtPending.textContent = formatCOP(isDebt ? total : 0);
}

function buildSalePayload(status) {
  const saleId = state.currentSale.id || buildId("VENTA");
  const items = state.currentSale.items.map((item) => ({
    productId: item.productId,
    nombre: item.nombre,
    cantidad: item.cantidad,
    precio: item.precio,
    subtotal: item.cantidad * item.precio,
  }));
  const total = items.reduce((acc, item) => acc + item.subtotal, 0);
  const metodoPago = normalizeSalePaymentMethod(state.currentSale.paymentMethod);
  const saldoPendiente = status === "cerrada" && metodoPago === "Debe" ? total : 0;

  return {
    id: saleId,
    fecha: state.currentSale.fecha || new Date().toISOString(),
    clienteId: state.currentSale.clientId || "",
    metodoPago,
    estado: status,
    total,
    saldoPendiente,
    itemsJson: items,
  };
}

function validateSaleForClose() {
  if (!state.currentSale.items.length) {
    return "No puedes cerrar una venta sin productos.";
  }
  for (const item of state.currentSale.items) {
    const product = findProductById(item.productId);
    if (!product) {
      return `El producto ${item.nombre} ya no existe en el catálogo.`;
    }
    if (product.seguimientoInventario && product.stock < item.cantidad) {
      return `No hay stock suficiente para ${product.nombre}.`;
    }
  }
  if (state.currentSale.paymentMethod === "Efectivo" && state.currentSale.cashReceived < getSaleTotal()) {
    return "El efectivo recibido es insuficiente.";
  }
  if (state.currentSale.paymentMethod === "Debe" && !state.currentSale.clientId) {
    return "Si el método de pago es Debe, debes seleccionar o crear un cliente antes de cerrar la venta.";
  }
  if (state.currentSale.paymentMethod === "Debe" && isGeneralClient(state.currentSale.clientId)) {
    return "Si el método de pago es Debe, no puedes usar Cliente General. Debes seleccionar o crear un cliente específico.";
  }
  return null;
}

async function saveOpenSale() {
  clearMessage(refs.saleMessage);
  if (!state.currentSale.items.length) {
    setMessage(refs.saleMessage, "Agrega al menos un producto antes de guardar la venta abierta.", "error");
    return;
  }
  try {
    state.currentSale.clientId = refs.saleClientSelect.value;
    const payload = buildSalePayload("abierta");
    await apiPost("ventas", payload);
    state.currentSale.id = payload.id;
    state.currentSale.fecha = payload.fecha;
    state.currentSale.estado = "abierta";
    await refreshSales();
    setMessage(refs.saleMessage, `Venta ${payload.id} guardada como abierta.`, "success");
  } catch (error) {
    setMessage(refs.saleMessage, error.message, "error");
  }
}

async function confirmSale() {
  clearMessage(refs.saleMessage);
  state.currentSale.clientId = refs.saleClientSelect.value;
  const validationError = validateSaleForClose();
  if (validationError) {
    setMessage(refs.saleMessage, validationError, "error");
    return;
  }

  try {
    const payload = buildSalePayload("cerrada");
    await apiPost("ventas", payload);
    await applyInventoryFromSale(payload.itemsJson);
    await Promise.all([refreshSales(), refreshProducts()]);
    state.ui.lastSaleId = payload.id;
    const debtText = payload.saldoPendiente > 0 ? ` Saldo pendiente: ${formatCOP(payload.saldoPendiente)}.` : "";
    refs.confirmationText.textContent = `Venta ${payload.id} registrada por ${formatCOP(payload.total)} con pago ${payload.metodoPago}.${debtText}`;
    resetCurrentSale();
    showView("saleConfirmationView");
  } catch (error) {
    setMessage(refs.saleMessage, error.message, "error");
  }
}

async function applyInventoryFromSale(items) {
  const requests = [];
  items.forEach((item) => {
    const product = findProductById(item.productId);
    if (!product || !product.seguimientoInventario) return;
    const nextStock = Math.max(0, product.stock - item.cantidad);
    requests.push(apiPost("productos", {
      id: product.id,
      nombre: product.nombre,
      categoriaId: product.categoriaId,
      precio: product.precio,
      costo: product.costo,
      stock: nextStock,
      seguimientoInventario: product.seguimientoInventario,
      codigoInterno: product.codigoInterno,
      codigoBarras: product.codigoBarras,
      imagenUrl: product.imagenUrl,
    }));
  });
  if (requests.length) {
    await Promise.all(requests);
  }
}

function resetCurrentSale() {
  state.currentSale = createEmptySale();
  refs.saleSearchInput.value = "";
  refs.cashReceived.value = "";
  refs.saleClientSelect.value = "";
  refs.paymentMethod.value = "Efectivo";
  refs.debtPending.textContent = formatCOP(0);
  renderSaleView();
}

function loadSaleIntoEditor(saleId) {
  const sale = findSaleById(saleId);
  if (!sale) return;
  state.currentSale = {
    id: sale.id,
    fecha: sale.fecha,
    clientId: sale.clienteId,
    items: sale.items.map((item) => ({
      productId: normalizeText(item.productId),
      nombre: normalizeText(item.nombre),
      codigoInterno: normalizeText(item.codigoInterno || item.productId),
      categoriaId: normalizeText(item.categoriaId),
      cantidad: nonNegative(item.cantidad),
      precio: nonNegative(item.precio),
    })),
    paymentMethod: normalizeSalePaymentMethod(sale.metodoPago),
    cashReceived: 0,
    change: 0,
    estado: sale.estado,
  };
  goToSale();
  setMessage(refs.saleMessage, `Retomaste la venta ${sale.id}.`, "success");
}

function renderSalesView() {
  const query = refs.salesSearchInput.value.toLowerCase().trim();
  const status = refs.salesStatusFilter.value;
  const sales = state.sales.filter((sale) => {
    const matchesStatus = status === "todos" ? true : sale.estado === status;
    const matchesText = !query
      ? true
      : `${sale.id} ${getClientName(sale.clienteId)}`.toLowerCase().includes(query);
    return matchesStatus && matchesText;
  });

  refs.emptySales.style.display = sales.length ? "none" : "block";
  refs.salesList.innerHTML = sales.map((sale) => {
    const badgeClass = sale.estado === "cerrada" ? "badge badge--success" : "badge badge--warning";
    const actionButton = sale.estado === "abierta"
      ? `<button type="button" data-resume-sale="${escapeHtml(sale.id)}">Retomar</button>`
      : `<button type="button" data-open-invoice="${escapeHtml(sale.id)}" class="btn-secondary">Ver factura</button>`;

    return `
      <article class="list-item">
        <div class="list-item__meta">
          <strong>${escapeHtml(sale.id)}</strong>
          <span class="muted">${formatDateTime(sale.fecha)} · ${escapeHtml(getClientName(sale.clienteId))}</span>
          <span>${formatCOP(sale.total)} · ${escapeHtml(sale.metodoPago)}</span>
          <span class="muted">Saldo pendiente: ${formatCOP(sale.saldoPendiente || 0)}</span>
          <span class="${badgeClass}">${escapeHtml(sale.estado)}</span>
        </div>
        <div class="list-actions">${actionButton}</div>
      </article>
    `;
  }).join("");

  refs.salesList.querySelectorAll("[data-resume-sale]").forEach((button) => {
    button.addEventListener("click", () => loadSaleIntoEditor(button.dataset.resumeSale));
  });
  refs.salesList.querySelectorAll("[data-open-invoice]").forEach((button) => {
    button.addEventListener("click", () => openInvoice(button.dataset.openInvoice, "sales"));
  });
}

function openInvoice(saleId, backTo = "sales") {
  const sale = findSaleById(saleId);
  if (!sale) {
    goToSales();
    return;
  }
  state.ui.invoiceBackTo = backTo;
  refs.invoiceContainer.innerHTML = buildInvoiceHtml(sale);
  showView("invoiceView");
}

function buildInvoiceHtml(sale) {
  const rows = sale.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.productId || item.codigoInterno || "-")}</td>
      <td>${escapeHtml(item.nombre)}</td>
      <td>${nonNegative(item.cantidad)}</td>
      <td>${formatCOP(item.precio)}</td>
      <td><strong>${formatCOP(nonNegative(item.subtotal || item.cantidad * item.precio))}</strong></td>
    </tr>
  `).join("");

  return `
    <h2>Factura / Comprobante</h2>
    <p><strong>Papelería Papel y Luna</strong></p>
    <p class="muted">Documento de clase · POS MVP 2</p>
    <hr />
    <p><strong>Venta:</strong> ${escapeHtml(sale.id)}</p>
    <p><strong>Fecha:</strong> ${formatDateTime(sale.fecha)}</p>
    <p><strong>Cliente:</strong> ${escapeHtml(getClientName(sale.clienteId))}</p>
    <p><strong>Método de pago:</strong> ${escapeHtml(sale.metodoPago)}</p>
    <p><strong>Saldo pendiente:</strong> ${formatCOP(sale.saldoPendiente || 0)}</p>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Precio</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="totals__row">
        <span>Total</span>
        <strong>${formatCOP(sale.total)}</strong>
      </div>
    </div>
  `;
}

function renderProductsView() {
  clearMessage(refs.productsMessage);
  const query = refs.productSearchInput.value.toLowerCase().trim();
  const products = state.products.filter((product) => {
    const text = `${product.nombre} ${product.codigoInterno} ${product.codigoBarras}`.toLowerCase();
    return text.includes(query);
  });

  refs.productsList.innerHTML = products.length
    ? products.map((product) => `
      <article class="product-card">
        ${renderProductImage(product, product.nombre)}
        <div class="product-card__meta">
          <h3>${escapeHtml(product.nombre)}</h3>
          <span class="muted">${escapeHtml(product.codigoInterno || product.id)}</span>
          <span>Categoría: ${escapeHtml(getCategoryName(product.categoriaId))}</span>
          <span>Venta: ${formatCOP(product.precio)}</span>
          <span class="muted">Costo: ${formatCOP(product.costo)} · Stock: ${product.stock}</span>
        </div>
        <div class="product-card__actions">
          <button type="button" data-edit-product="${escapeHtml(product.id)}" class="btn-secondary">Editar</button>
          <button type="button" data-delete-product="${escapeHtml(product.id)}" class="btn-danger">Eliminar</button>
        </div>
      </article>
    `).join("")
    : `<p class="muted">No se encontraron productos.</p>`;

  refs.productsList.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.addEventListener("click", () => openProductModal(button.dataset.editProduct));
  });
  refs.productsList.querySelectorAll("[data-delete-product]").forEach((button) => {
    button.addEventListener("click", () => deleteProduct(button.dataset.deleteProduct));
  });
}

function openProductModal(productId = null) {
  populateProductCategoryOptions();
  state.ui.productModalEditingId = productId;
  clearMessage(refs.productMessage);
  refs.pImageFile.value = "";

  if (!productId) {
    refs.productModalTitle.textContent = "Crear producto";
    refs.pName.value = "";
    refs.pCategory.value = "";
    refs.pPrice.value = "";
    refs.pCost.value = "";
    refs.pCode.value = "";
    refs.pBarcode.value = "";
    refs.pImageUrl.value = "";
    refs.pTrack.checked = true;
    refs.pStock.value = "0";
    updateProductImagePreview("");
  } else {
    const product = findProductById(productId);
    if (!product) return;
    refs.productModalTitle.textContent = `Editar: ${product.nombre}`;
    refs.pName.value = product.nombre;
    refs.pCategory.value = product.categoriaId;
    refs.pPrice.value = String(product.precio);
    refs.pCost.value = String(product.costo);
    refs.pCode.value = product.codigoInterno;
    refs.pBarcode.value = product.codigoBarras;
    refs.pImageUrl.value = resolveProductImage(product);
    refs.pTrack.checked = product.seguimientoInventario;
    refs.pStock.value = String(product.stock);
    updateProductImagePreview(refs.pImageUrl.value);
  }

  toggleStockRow();
  refs.productModal.classList.remove("hidden");
}

function closeProductModal() {
  refs.productModal.classList.add("hidden");
}

function toggleStockRow() {
  refs.stockRow.classList.toggle("hidden", !refs.pTrack.checked);
}

function updateProductImagePreview(url) {
  const imageUrl = normalizeText(url);
  refs.productImagePreview.style.backgroundImage = imageUrl ? `url("${imageUrl.replace(/"/g, '\"')}")` : "";
  refs.productImagePreview.classList.toggle("has-image", Boolean(imageUrl));
  refs.productImagePreview.textContent = imageUrl ? "Foto del producto" : "Sin foto";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No fue posible leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });
}

async function handleProductImageFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const dataUrl = await readFileAsDataUrl(file);
    refs.pImageUrl.value = dataUrl;
    updateProductImagePreview(dataUrl);
    setMessage(refs.productMessage, "Foto cargada correctamente. Guarda el producto para aplicar el cambio.", "info");
  } catch (error) {
    setMessage(refs.productMessage, error.message, "error");
  }
}

function buildProductPayload() {
  const editingId = state.ui.productModalEditingId;
  return {
    id: editingId || buildId("PROD"),
    nombre: normalizeText(refs.pName.value),
    categoriaId: normalizeText(refs.pCategory.value),
    precio: nonNegative(refs.pPrice.value),
    costo: nonNegative(refs.pCost.value),
    stock: refs.pTrack.checked ? nonNegative(refs.pStock.value) : 0,
    seguimientoInventario: refs.pTrack.checked,
    codigoInterno: normalizeText(refs.pCode.value) || (editingId || buildId("COD")),
    codigoBarras: normalizeText(refs.pBarcode.value),
    imagenUrl: normalizeText(refs.pImageUrl.value),
  };
}

async function submitProductForm(event) {
  event.preventDefault();
  clearMessage(refs.productMessage);
  const payload = buildProductPayload();

  if (!payload.nombre) {
    setMessage(refs.productMessage, "El nombre es obligatorio.", "error");
    return;
  }
  if (!payload.categoriaId) {
    setMessage(refs.productMessage, "Selecciona una categoría.", "error");
    return;
  }

  try {
    await apiPost("productos", payload);
    await refreshProducts();
    renderSaleProducts();
    renderSaleCart();
    renderProductsView();
    closeProductModal();
    showPageStatus("Producto guardado correctamente.", "success");
    setTimeout(hidePageStatus, 2400);
  } catch (error) {
    setMessage(refs.productMessage, error.message, "error");
  }
}

async function deleteProduct(productId) {
  const product = findProductById(productId);
  if (!product) return;
  const ok = await askForConfirmation({
    title: "Eliminar producto",
    message: `¿Seguro que deseas eliminar ${product.nombre}?`,
    confirmText: "Eliminar",
  });
  if (!ok) return;

  try {
    await apiPost("productos", {
      id: product.id,
      nombre: DELETED_MARK,
      categoriaId: product.categoriaId,
      precio: product.precio,
      costo: product.costo,
      stock: product.stock,
      seguimientoInventario: product.seguimientoInventario,
      codigoInterno: product.codigoInterno,
      codigoBarras: product.codigoBarras,
      imagenUrl: product.imagenUrl,
    });
    await refreshProducts();
    state.currentSale.items = state.currentSale.items.filter((item) => item.productId !== productId);
    renderProductsView();
    renderSaleView();
    setMessage(refs.productsMessage, "Producto eliminado correctamente.", "success");
  } catch (error) {
    setMessage(refs.productsMessage, error.message, "error");
  }
}

function renderPurchasesView() {
  refs.purchaseProviderSelect.value = state.currentPurchase.providerId || "";
  refs.purchaseMethodSelect.value = state.currentPurchase.method;
  renderPurchaseProducts();
  renderPurchaseCart();
  renderPurchasesHistory();
}

function renderPurchaseProducts() {
  const query = refs.purchaseSearchInput.value.toLowerCase().trim();
  const products = state.products.filter((product) => {
    const text = `${product.nombre} ${product.codigoInterno}`.toLowerCase();
    return text.includes(query);
  });

  refs.purchaseProducts.innerHTML = products.length
    ? products.map((product) => `
      <article class="product-card">
        ${renderProductImage(product, product.nombre)}
        <div class="product-card__meta">
          <h3>${escapeHtml(product.nombre)}</h3>
          <span class="muted">${escapeHtml(product.codigoInterno || product.id)}</span>
          <span>Costo actual: ${formatCOP(product.costo)}</span>
          <span class="muted">Stock actual: ${product.stock}</span>
        </div>
        <div class="product-card__actions">
          <button type="button" data-add-purchase-product="${escapeHtml(product.id)}">Agregar a compra</button>
        </div>
      </article>
    `).join("")
    : `<p class="muted">No se encontraron productos.</p>`;

  refs.purchaseProducts.querySelectorAll("[data-add-purchase-product]").forEach((button) => {
    button.addEventListener("click", () => addProductToPurchase(button.dataset.addPurchaseProduct));
  });
}

function addProductToPurchase(productId) {
  const product = findProductById(productId);
  if (!product) return;
  const existing = state.currentPurchase.items.find((item) => item.productId === productId);
  if (existing) {
    existing.cantidad += 1;
  } else {
    state.currentPurchase.items.push({
      productId: product.id,
      nombre: product.nombre,
      cantidad: 1,
      costo: product.costo,
    });
  }
  renderPurchaseCart();
}

function changePurchaseItemQty(productId, delta) {
  const item = state.currentPurchase.items.find((entry) => entry.productId === productId);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    removePurchaseItem(productId);
    return;
  }
  renderPurchaseCart();
}

function removePurchaseItem(productId) {
  state.currentPurchase.items = state.currentPurchase.items.filter((item) => item.productId !== productId);
  renderPurchaseCart();
}

function updatePurchaseItemCost(productId, value) {
  const item = state.currentPurchase.items.find((entry) => entry.productId === productId);
  if (!item) return;
  item.costo = nonNegative(value);
  renderPurchaseCart();
}

function renderPurchaseCart() {
  clearMessage(refs.purchaseMessage);
  refs.emptyPurchase.style.display = state.currentPurchase.items.length ? "none" : "block";
  refs.purchaseCart.innerHTML = state.currentPurchase.items.map((item) => `
    <article class="purchase-item">
      <div class="purchase-item__header">
        <div class="list-item__meta">
          <strong>${escapeHtml(item.nombre)}</strong>
          <span>Total: <strong>${formatCOP(item.costo * item.cantidad)}</strong></span>
        </div>
        <div class="quantity-controls">
          <button type="button" data-purchase-dec="${escapeHtml(item.productId)}">-</button>
          <span>${item.cantidad}</span>
          <button type="button" data-purchase-inc="${escapeHtml(item.productId)}">+</button>
          <input class="inline-input" type="number" min="0" step="100" value="${item.costo}" data-purchase-cost="${escapeHtml(item.productId)}" />
          <button type="button" data-purchase-remove="${escapeHtml(item.productId)}" class="btn-danger">Eliminar</button>
        </div>
      </div>
    </article>
  `).join("");

  refs.purchaseCart.querySelectorAll("[data-purchase-inc]").forEach((button) => {
    button.addEventListener("click", () => changePurchaseItemQty(button.dataset.purchaseInc, 1));
  });
  refs.purchaseCart.querySelectorAll("[data-purchase-dec]").forEach((button) => {
    button.addEventListener("click", () => changePurchaseItemQty(button.dataset.purchaseDec, -1));
  });
  refs.purchaseCart.querySelectorAll("[data-purchase-remove]").forEach((button) => {
    button.addEventListener("click", () => removePurchaseItem(button.dataset.purchaseRemove));
  });
  refs.purchaseCart.querySelectorAll("[data-purchase-cost]").forEach((input) => {
    input.addEventListener("input", () => updatePurchaseItemCost(input.dataset.purchaseCost, input.value));
  });

  refs.purchaseTotal.textContent = formatCOP(getPurchaseTotal());
}

function buildPurchasePayload() {
  const items = state.currentPurchase.items.map((item) => ({
    productId: item.productId,
    nombre: item.nombre,
    cantidad: item.cantidad,
    costo: item.costo,
    subtotal: item.cantidad * item.costo,
  }));
  return {
    id: buildId("COMP"),
    fecha: new Date().toISOString(),
    proveedorId: state.currentPurchase.providerId,
    metodoPago: state.currentPurchase.method,
    total: items.reduce((acc, item) => acc + item.subtotal, 0),
    itemsJson: items,
  };
}

async function savePurchase() {
  clearMessage(refs.purchaseMessage);
  state.currentPurchase.providerId = refs.purchaseProviderSelect.value;
  state.currentPurchase.method = refs.purchaseMethodSelect.value;

  if (!state.currentPurchase.providerId) {
    setMessage(refs.purchaseMessage, "Selecciona un proveedor.", "error");
    return;
  }
  if (!state.currentPurchase.items.length) {
    setMessage(refs.purchaseMessage, "Agrega al menos un producto a la compra.", "error");
    return;
  }

  try {
    const payload = buildPurchasePayload();
    await apiPost("compras", payload);
    await applyInventoryFromPurchase(payload.itemsJson);
    await Promise.all([refreshPurchases(), refreshProducts()]);
    state.currentPurchase = createEmptyPurchase();
    renderPurchasesView();
    setMessage(refs.purchaseMessage, `Compra ${payload.id} registrada.`, "success");
  } catch (error) {
    setMessage(refs.purchaseMessage, error.message, "error");
  }
}

async function applyInventoryFromPurchase(items) {
  const requests = [];
  items.forEach((item) => {
    const product = findProductById(item.productId);
    if (!product) return;
    requests.push(apiPost("productos", {
      id: product.id,
      nombre: product.nombre,
      categoriaId: product.categoriaId,
      precio: product.precio,
      costo: item.costo,
      stock: product.stock + item.cantidad,
      seguimientoInventario: product.seguimientoInventario,
      codigoInterno: product.codigoInterno,
      codigoBarras: product.codigoBarras,
      imagenUrl: product.imagenUrl,
    }));
  });
  if (requests.length) {
    await Promise.all(requests);
  }
}

function renderPurchasesHistory() {
  refs.emptyPurchases.style.display = state.purchases.length ? "none" : "block";
  refs.purchasesList.innerHTML = state.purchases.map((purchase) => `
    <article class="list-item">
      <div class="list-item__meta">
        <strong>${escapeHtml(purchase.id)}</strong>
        <span class="muted">${formatDateTime(purchase.fecha)} · ${escapeHtml(getProviderName(purchase.proveedorId))}</span>
        <span>${formatCOP(purchase.total)}</span>
      </div>
      <span class="badge">${escapeHtml(purchase.metodoPago)}</span>
    </article>
  `).join("");
}

function resetPurchaseEditor() {
  state.currentPurchase = createEmptyPurchase();
  refs.purchaseSearchInput.value = "";
  renderPurchasesView();
}

function renderClientsView() {
  const query = refs.clientSearchInput.value.toLowerCase().trim();
  const clients = state.clients.filter((client) => `${client.nombre} ${client.telefono} ${client.correo}`.toLowerCase().includes(query));
  refs.clientsList.innerHTML = clients.length
    ? clients.map((client) => `
      <article class="entity-card">
        <div class="entity-card__meta">
          <h3>${escapeHtml(client.nombre)}</h3>
          <span class="muted">${escapeHtml(client.id)}</span>
          <span>${escapeHtml(client.telefono || "Sin teléfono")}</span>
          <span>${escapeHtml(client.correo || "Sin correo")}</span>
        </div>
        <div class="entity-actions">
          <button type="button" data-edit-client="${escapeHtml(client.id)}" class="btn-secondary">Editar</button>
          <button type="button" data-delete-client="${escapeHtml(client.id)}" class="btn-danger">Eliminar</button>
        </div>
      </article>
    `).join("")
    : `<p class="muted">No se encontraron clientes.</p>`;

  refs.clientsList.querySelectorAll("[data-edit-client]").forEach((button) => {
    button.addEventListener("click", () => startEditClient(button.dataset.editClient));
  });
  refs.clientsList.querySelectorAll("[data-delete-client]").forEach((button) => {
    button.addEventListener("click", () => deleteClient(button.dataset.deleteClient));
  });
}

function resetClientForm() {
  state.ui.clientEditingId = null;
  refs.clientFormTitle.textContent = "Crear cliente";
  refs.cancelClientEditBtn.classList.add("hidden");
  refs.clientName.value = "";
  refs.clientPhone.value = "";
  refs.clientEmail.value = "";
  clearMessage(refs.clientMessage);
}

function startEditClient(clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return;
  state.ui.clientEditingId = client.id;
  refs.clientFormTitle.textContent = `Editar: ${client.nombre}`;
  refs.cancelClientEditBtn.classList.remove("hidden");
  refs.clientName.value = client.nombre;
  refs.clientPhone.value = client.telefono;
  refs.clientEmail.value = client.correo;
  clearMessage(refs.clientMessage);
}

async function submitClientForm(event) {
  event.preventDefault();
  clearMessage(refs.clientMessage);
  const payload = {
    id: state.ui.clientEditingId || buildId("CLI"),
    nombre: normalizeText(refs.clientName.value),
    telefono: normalizeText(refs.clientPhone.value),
    correo: normalizeText(refs.clientEmail.value),
  };
  if (!payload.nombre) {
    setMessage(refs.clientMessage, "El nombre es obligatorio.", "error");
    return;
  }
  try {
    await apiPost("clientes", payload);
    await refreshClients();
    resetClientForm();
    renderClientsView();
    populateSaleClientOptions();
    showPageStatus("Cliente guardado correctamente.", "success");
    setTimeout(hidePageStatus, 2400);
  } catch (error) {
    setMessage(refs.clientMessage, error.message, "error");
  }
}

async function deleteClient(clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return;
  const ok = await askForConfirmation({
    title: "Eliminar cliente",
    message: `¿Seguro que deseas eliminar ${client.nombre}?`,
    confirmText: "Eliminar",
  });
  if (!ok) return;
  try {
    await apiPost("clientes", { id: client.id, nombre: DELETED_MARK, telefono: client.telefono, correo: client.correo });
    await refreshClients();
    renderClientsView();
    populateSaleClientOptions();
    setMessage(refs.clientMessage, "Cliente eliminado.", "success");
  } catch (error) {
    setMessage(refs.clientMessage, error.message, "error");
  }
}

function renderProvidersView() {
  const query = refs.providerSearchInput.value.toLowerCase().trim();
  const providers = state.providers.filter((provider) => `${provider.nombre} ${provider.nit} ${provider.telefono} ${provider.correo}`.toLowerCase().includes(query));
  refs.providersList.innerHTML = providers.length
    ? providers.map((provider) => `
      <article class="entity-card">
        <div class="entity-card__meta">
          <h3>${escapeHtml(provider.nombre)}</h3>
          <span class="muted">${escapeHtml(provider.id)}</span>
          <span>NIT: ${escapeHtml(provider.nit || "-")}</span>
          <span>${escapeHtml(provider.telefono || "Sin teléfono")}</span>
          <span>${escapeHtml(provider.correo || "Sin correo")}</span>
        </div>
        <div class="entity-actions">
          <button type="button" data-edit-provider="${escapeHtml(provider.id)}" class="btn-secondary">Editar</button>
          <button type="button" data-delete-provider="${escapeHtml(provider.id)}" class="btn-danger">Eliminar</button>
        </div>
      </article>
    `).join("")
    : `<p class="muted">No se encontraron proveedores.</p>`;

  refs.providersList.querySelectorAll("[data-edit-provider]").forEach((button) => {
    button.addEventListener("click", () => startEditProvider(button.dataset.editProvider));
  });
  refs.providersList.querySelectorAll("[data-delete-provider]").forEach((button) => {
    button.addEventListener("click", () => deleteProvider(button.dataset.deleteProvider));
  });
}

function resetProviderForm() {
  state.ui.providerEditingId = null;
  refs.providerFormTitle.textContent = "Crear proveedor";
  refs.cancelProviderEditBtn.classList.add("hidden");
  refs.providerName.value = "";
  refs.providerNit.value = "";
  refs.providerPhone.value = "";
  refs.providerEmail.value = "";
  clearMessage(refs.providerMessage);
}

function startEditProvider(providerId) {
  const provider = state.providers.find((item) => item.id === providerId);
  if (!provider) return;
  state.ui.providerEditingId = provider.id;
  refs.providerFormTitle.textContent = `Editar: ${provider.nombre}`;
  refs.cancelProviderEditBtn.classList.remove("hidden");
  refs.providerName.value = provider.nombre;
  refs.providerNit.value = provider.nit;
  refs.providerPhone.value = provider.telefono;
  refs.providerEmail.value = provider.correo;
  clearMessage(refs.providerMessage);
}

async function submitProviderForm(event) {
  event.preventDefault();
  clearMessage(refs.providerMessage);
  const payload = {
    id: state.ui.providerEditingId || buildId("PROV"),
    nombre: normalizeText(refs.providerName.value),
    nit: normalizeText(refs.providerNit.value),
    telefono: normalizeText(refs.providerPhone.value),
    correo: normalizeText(refs.providerEmail.value),
  };
  if (!payload.nombre || !payload.nit) {
    setMessage(refs.providerMessage, "Nombre y NIT son obligatorios.", "error");
    return;
  }
  try {
    await apiPost("proveedores", payload);
    await refreshProviders();
    resetProviderForm();
    renderProvidersView();
    populatePurchaseProviderOptions();
    showPageStatus("Proveedor guardado correctamente.", "success");
    setTimeout(hidePageStatus, 2400);
  } catch (error) {
    setMessage(refs.providerMessage, error.message, "error");
  }
}

async function deleteProvider(providerId) {
  const provider = state.providers.find((item) => item.id === providerId);
  if (!provider) return;
  const ok = await askForConfirmation({
    title: "Eliminar proveedor",
    message: `¿Seguro que deseas eliminar ${provider.nombre}?`,
    confirmText: "Eliminar",
  });
  if (!ok) return;
  try {
    await apiPost("proveedores", {
      id: provider.id,
      nombre: DELETED_MARK,
      nit: provider.nit,
      telefono: provider.telefono,
      correo: provider.correo,
    });
    await refreshProviders();
    renderProvidersView();
    populatePurchaseProviderOptions();
    setMessage(refs.providerMessage, "Proveedor eliminado.", "success");
  } catch (error) {
    setMessage(refs.providerMessage, error.message, "error");
  }
}

function renderCategoriesView() {
  const query = refs.categorySearchInput.value.toLowerCase().trim();
  const categories = state.categories.filter((category) => `${category.nombre} ${category.icono}`.toLowerCase().includes(query));
  refs.categoriesList.innerHTML = categories.length
    ? categories.map((category) => `
      <article class="entity-card">
        <div class="entity-card__meta">
          <h3><span class="color-chip" style="background:${escapeHtml(category.color)}"></span>${escapeHtml(category.nombre)}</h3>
          <span class="muted">${escapeHtml(category.id)}</span>
          <span>${escapeHtml(category.icono || "Sin ícono")}</span>
        </div>
        <div class="entity-actions">
          <button type="button" data-edit-category="${escapeHtml(category.id)}" class="btn-secondary">Editar</button>
          <button type="button" data-delete-category="${escapeHtml(category.id)}" class="btn-danger">Eliminar</button>
        </div>
      </article>
    `).join("")
    : `<p class="muted">No se encontraron categorías.</p>`;

  refs.categoriesList.querySelectorAll("[data-edit-category]").forEach((button) => {
    button.addEventListener("click", () => startEditCategory(button.dataset.editCategory));
  });
  refs.categoriesList.querySelectorAll("[data-delete-category]").forEach((button) => {
    button.addEventListener("click", () => deleteCategory(button.dataset.deleteCategory));
  });
}

function resetCategoryForm() {
  state.ui.categoryEditingId = null;
  refs.categoryFormTitle.textContent = "Crear categoría";
  refs.cancelCategoryEditBtn.classList.add("hidden");
  refs.categoryName.value = "";
  refs.categoryColor.value = "#4F46E5";
  refs.categoryIcon.value = "";
  clearMessage(refs.categoryMessage);
}

function startEditCategory(categoryId) {
  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) return;
  state.ui.categoryEditingId = category.id;
  refs.categoryFormTitle.textContent = `Editar: ${category.nombre}`;
  refs.cancelCategoryEditBtn.classList.remove("hidden");
  refs.categoryName.value = category.nombre;
  refs.categoryColor.value = category.color || "#4F46E5";
  refs.categoryIcon.value = category.icono;
  clearMessage(refs.categoryMessage);
}

async function submitCategoryForm(event) {
  event.preventDefault();
  clearMessage(refs.categoryMessage);
  const payload = {
    id: state.ui.categoryEditingId || buildId("CAT"),
    nombre: normalizeText(refs.categoryName.value),
    color: normalizeText(refs.categoryColor.value, "#4F46E5") || "#4F46E5",
    icono: normalizeText(refs.categoryIcon.value),
  };
  if (!payload.nombre) {
    setMessage(refs.categoryMessage, "El nombre es obligatorio.", "error");
    return;
  }
  try {
    await apiPost("categorias", payload);
    await refreshCategories();
    resetCategoryForm();
    renderCategoriesView();
    populateProductCategoryOptions();
    renderProductsView();
    renderSaleProducts();
    showPageStatus("Categoría guardada correctamente.", "success");
    setTimeout(hidePageStatus, 2400);
  } catch (error) {
    setMessage(refs.categoryMessage, error.message, "error");
  }
}

async function deleteCategory(categoryId) {
  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) return;
  const ok = await askForConfirmation({
    title: "Eliminar categoría",
    message: `¿Seguro que deseas eliminar ${category.nombre}?`,
    confirmText: "Eliminar",
  });
  if (!ok) return;
  try {
    await apiPost("categorias", {
      id: category.id,
      nombre: DELETED_MARK,
      color: category.color,
      icono: category.icono,
    });
    await refreshCategories();
    renderCategoriesView();
    populateProductCategoryOptions();
    renderProductsView();
    renderSaleProducts();
    setMessage(refs.categoryMessage, "Categoría eliminada.", "success");
  } catch (error) {
    setMessage(refs.categoryMessage, error.message, "error");
  }
}

async function refreshProducts() {
  const products = await apiGet("productos");
  state.products = sortByName(dedupeLatest(products, normalizeProduct, (item) => item.nombre === DELETED_MARK || !item.nombre));
}

async function refreshSales() {
  const sales = await apiGet("ventas");
  state.sales = sortByDateDesc(dedupeLatest(sales, normalizeSale));
}

async function refreshPurchases() {
  const purchases = await apiGet("compras");
  state.purchases = sortByDateDesc(dedupeLatest(purchases, normalizePurchase));
}

async function refreshClients() {
  const clients = await apiGet("clientes");
  state.clients = sortByName(dedupeLatest(clients, normalizeClient, (item) => item.nombre === DELETED_MARK || !item.nombre));
}

async function refreshProviders() {
  const providers = await apiGet("proveedores");
  state.providers = sortByName(dedupeLatest(providers, normalizeProvider, (item) => item.nombre === DELETED_MARK || !item.nombre));
}

async function refreshCategories() {
  const categories = await apiGet("categorias");
  state.categories = sortByName(dedupeLatest(categories, normalizeCategory, (item) => item.nombre === DELETED_MARK || !item.nombre));
}

function attachEvents() {
  refs.goSaleBtn.addEventListener("click", goToSale);
  refs.goSalesBtn.addEventListener("click", goToSales);
  refs.goProductsBtn.addEventListener("click", goToProducts);
  refs.goPurchasesBtn.addEventListener("click", goToPurchases);
  refs.goClientsBtn.addEventListener("click", goToClients);
  refs.goProvidersBtn.addEventListener("click", goToProviders);
  refs.goCategoriesBtn.addEventListener("click", goToCategories);

  refs.saleSearchInput.addEventListener("input", renderSaleProducts);
  refs.saleClientSelect.addEventListener("change", () => {
    state.currentSale.clientId = refs.saleClientSelect.value;
    if (state.currentSale.paymentMethod === "Debe" && isGeneralClient(state.currentSale.clientId)) {
      state.currentSale.clientId = "";
      refs.saleClientSelect.value = "";
      setMessage(refs.saleMessage, "Para ventas con método Debe debes seleccionar o crear un cliente diferente de Cliente General.", "error");
    }
  });
  refs.openQuickClientBtn.addEventListener("click", () => {
    goToClients();
    setMessage(refs.clientMessage, "Crea o selecciona un cliente y luego vuelve a la venta para usar el método Debe.", "info");
  });
  refs.paymentMethod.addEventListener("change", updateCashUI);
  refs.cashReceived.addEventListener("input", updateCashChange);
  refs.saveOpenSaleBtn.addEventListener("click", saveOpenSale);
  refs.discardSaleBtn.addEventListener("click", async () => {
    const ok = await askForConfirmation({
      title: "Descartar venta",
      message: "¿Deseas descartar la venta actual?",
      confirmText: "Descartar",
    });
    if (!ok) return;
    resetCurrentSale();
  });
  refs.confirmSaleBtn.addEventListener("click", confirmSale);
  refs.newSaleBtn.addEventListener("click", async () => {
    const hasItems = state.currentSale.items.length > 0;
    if (hasItems) {
      const ok = await askForConfirmation({
        title: "Nueva venta",
        message: "Esto limpiará la venta actual. ¿Deseas continuar?",
        confirmText: "Continuar",
        confirmClass: "btn-secondary",
      });
      if (!ok) return;
    }
    resetCurrentSale();
  });

  refs.confirmationNewSaleBtn.addEventListener("click", () => {
    state.ui.lastSaleId = null;
    goToSale();
  });
  refs.confirmationInvoiceBtn.addEventListener("click", () => {
    if (!state.ui.lastSaleId) {
      goToSales();
      return;
    }
    openInvoice(state.ui.lastSaleId, "saleConfirmationView");
  });
  refs.confirmationHistoryBtn.addEventListener("click", goToSales);

  refs.salesSearchInput.addEventListener("input", renderSalesView);
  refs.salesStatusFilter.addEventListener("change", renderSalesView);
  refs.invoiceBackBtn.addEventListener("click", () => {
    if (state.ui.invoiceBackTo === "saleConfirmationView") {
      showView("saleConfirmationView");
    } else {
      goToSales();
    }
  });

  refs.closeConfirmModalBtn.addEventListener("click", () => closeConfirmModal(false));
  refs.confirmModalCancelBtn.addEventListener("click", () => closeConfirmModal(false));
  refs.confirmModalAcceptBtn.addEventListener("click", () => closeConfirmModal(true));
  refs.confirmModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeConfirmModal === "true") {
      closeConfirmModal(false);
    }
  });
  refs.productSearchInput.addEventListener("input", renderProductsView);
  refs.openCreateProductBtn.addEventListener("click", () => openProductModal());
  refs.closeProductModalBtn.addEventListener("click", closeProductModal);
  refs.productModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeProductModal === "true") {
      closeProductModal();
    }
  });
  refs.pTrack.addEventListener("change", toggleStockRow);
  refs.productForm.addEventListener("submit", submitProductForm);

  refs.purchaseSearchInput.addEventListener("input", renderPurchaseProducts);
  refs.purchaseProviderSelect.addEventListener("change", () => {
    state.currentPurchase.providerId = refs.purchaseProviderSelect.value;
  });
  refs.purchaseMethodSelect.addEventListener("change", () => {
    state.currentPurchase.method = refs.purchaseMethodSelect.value;
  });
  refs.savePurchaseBtn.addEventListener("click", savePurchase);
  refs.resetPurchaseBtn.addEventListener("click", resetPurchaseEditor);

  refs.clientSearchInput.addEventListener("input", renderClientsView);
  refs.clientForm.addEventListener("submit", submitClientForm);
  refs.cancelClientEditBtn.addEventListener("click", resetClientForm);
  refs.resetClientBtn.addEventListener("click", resetClientForm);

  refs.providerSearchInput.addEventListener("input", renderProvidersView);
  refs.providerForm.addEventListener("submit", submitProviderForm);
  refs.cancelProviderEditBtn.addEventListener("click", resetProviderForm);
  refs.resetProviderBtn.addEventListener("click", resetProviderForm);

  refs.categorySearchInput.addEventListener("input", renderCategoriesView);
  refs.categoryForm.addEventListener("submit", submitCategoryForm);
  refs.cancelCategoryEditBtn.addEventListener("click", resetCategoryForm);
  refs.resetCategoryBtn.addEventListener("click", resetCategoryForm);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!refs.confirmModal.classList.contains("hidden")) {
      closeConfirmModal(false);
      return;
    }
    if (!refs.productModal.classList.contains("hidden")) {
      closeProductModal();
    }
  });
}

async function initApp() {
  attachEvents();
  try {
    await loadAllData();
    resetClientForm();
    resetProviderForm();
    resetCategoryForm();
    resetCurrentSale();
    resetPurchaseEditor();
    goToSale();
  } catch (error) {
    showPageStatus(`Error cargando la API: ${error.message}`, "error");
  }
}

initApp();
