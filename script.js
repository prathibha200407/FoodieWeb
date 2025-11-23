// script.js
document.addEventListener("DOMContentLoaded", () => {
  // ---------- Address detection (GPS -> reverse geocode -> fallback) ----------
  async function reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error("Reverse geocode failed");
      const j = await res.json();
      return j.display_name || null;
    } catch (err) {
      console.warn("Reverse geocode failed:", err);
      return null;
    }
  }

  async function fillDetectedAddress(lat, lng) {
    const fullAddr = await reverseGeocode(lat, lng);
    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
    const combined = fullAddr
      ? `📍 Address: ${fullAddr}\n🔗 Google Maps: ${mapsLink}`
      : `🔗 Google Maps: ${mapsLink}`;

    const deliveryLocationEl = document.getElementById("delivery-location");
    if (deliveryLocationEl) deliveryLocationEl.value = combined;

    const custAddrEl = document.getElementById("cust-address");
    if (custAddrEl) custAddrEl.value = fullAddr || mapsLink;
  }

  // Hook detect-location button (guarded)
  const detectBtn = document.getElementById("detect-location");
  if (detectBtn) {
    detectBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      if (!navigator.geolocation) {
        // IP fallback
        try {
          const r = await fetch("https://ipapi.co/json/");
          const j = await r.json();
          const fallback = `${j.city || ""}${j.region ? ", " + j.region : ""}${j.postal ? ", " + j.postal : ""}${j.country ? ", " + j.country : ""}`;
          const deliveryLocationEl = document.getElementById("delivery-location");
          if (deliveryLocationEl) deliveryLocationEl.value = fallback;
          const custAddrEl = document.getElementById("cust-address");
          if (custAddrEl) custAddrEl.value = fallback;
        } catch (err) {
          alert("Unable to detect location automatically.");
        }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          await fillDetectedAddress(lat, lng);
        },
        async () => {
          // fallback to IP service
          try {
            const r = await fetch("https://ipapi.co/json/");
            const j = await r.json();
            const fallback = `${j.city || ""}${j.region ? ", " + j.region : ""}${j.postal ? ", " + j.postal : ""}${j.country ? ", " + j.country : ""}`;
            const deliveryLocationEl = document.getElementById("delivery-location");
            if (deliveryLocationEl) deliveryLocationEl.value = fallback;
            const custAddrEl = document.getElementById("cust-address");
            if (custAddrEl) custAddrEl.value = fallback;
          } catch (e) {
            alert("Please allow location access or try again.");
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  // ---------- Order type controls (Delivery / Dine-in) ----------
  const orderTypeSelect = document.getElementById("order-type");
  const tableBox = document.getElementById("table-number-box");
  let addressContainer = null;
  const deliveryEl = document.getElementById("delivery-location");
  if (deliveryEl) {
    addressContainer = deliveryEl.closest(".col-12") || deliveryEl.parentElement;
  }

  if (orderTypeSelect) {
    orderTypeSelect.addEventListener("change", () => {
      const val = orderTypeSelect.value;
      if (val === "dinein") {
        if (tableBox) tableBox.style.display = "block";
        if (addressContainer) addressContainer.style.display = "none";
      } else if (val === "delivery") {
        if (tableBox) tableBox.style.display = "none";
        if (addressContainer) addressContainer.style.display = "block";
      } else {
        if (tableBox) tableBox.style.display = "none";
        if (addressContainer) addressContainer.style.display = "none";
      }
    });
  }

  // table-number digits-only guard
  const tableInput = document.getElementById("table-number");
  if (tableInput) {
    tableInput.addEventListener("input", () => {
      tableInput.value = tableInput.value.replace(/\D/g, "");
    });
  }

  // ---------- Helpers ----------
  function getFoodEmoji(name) {
    name = (name || "").toLowerCase();
    if (name.includes("pizza")) return "🍕";
    if (name.includes("pasta")) return "🍝";
    if (name.includes("salad")) return "🥗";
    if (name.includes("cake") || name.includes("ice") || name.includes("dessert") || name.includes("brownie")) return "🍨";
    if (name.includes("chicken") || name.includes("fish") || name.includes("prawns")) return "🍗";
    return "🍽";
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cssEscape(str) {
    return String(str).replace(/(["\\ ])/g, '\\$1');
  }

  // ---------- Elements & state ----------
  const cartCountElement = document.getElementById("cart-count");
  // improved cart icon selection (looks for .fa-cart-shopping inside a nav, fallback to any cart anchor)
  const cartIconLink = document.querySelector('.navbar .fa-cart-shopping') ? document.querySelector('.navbar .fa-cart-shopping').closest('a') : document.querySelector('a[href="#cart"], a[href="#checkout"], a.cart-link, a[href="#"]');
  const CHECKOUT_MODAL_ID = 'checkoutModal';
  const ORDER_POPUP_ID = 'order-success-popup';
  const ORDER_CONFIRM_MODAL_ID = 'orderConfirmModal';

  let cart = []; // { id, name, price, qty }

  // ---------- Persistence ----------
  function saveCart() {
    try { localStorage.setItem('foodMunchCart', JSON.stringify(cart)); } catch (e) { console.warn("Failed to save cart", e); }
  }
  function loadCart() {
    try {
      const raw = localStorage.getItem('foodMunchCart');
      cart = raw ? JSON.parse(raw) : [];
      // Ensure structure sanity
      if (!Array.isArray(cart)) cart = [];
      cart = cart.map(it => ({ id: String(it.id), name: it.name || '', price: Number(it.price) || 0, qty: Number(it.qty) || 0 }));
      cart = cart.filter(it => it.qty > 0);
    } catch (e) {
      cart = [];
      console.error('Failed to load cart from storage', e);
    }
  }

  // ---------- UI updates ----------
  function updateCartCountDisplay() {
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    if (!cartCountElement) return;
    cartCountElement.textContent = totalQty;
    cartCountElement.classList.add('bounce');
    setTimeout(() => cartCountElement.classList.remove('bounce'), 300);
    cartCountElement.style.display = totalQty > 0 ? 'inline-block' : 'none';
  }

  function findCartIndex(id) {
    return cart.findIndex(i => i.id === id);
  }

  function setItemQuantity(itemId, name, price, quantity) {
    const idx = findCartIndex(itemId);
    if (quantity <= 0) {
      if (idx > -1) cart.splice(idx, 1);
    } else {
      if (idx > -1) cart[idx].qty = quantity;
      else cart.push({ id: String(itemId), name: name || '', price: Number(price) || 0, qty: Number(quantity) || 0 });
    }
    saveCart();
    updateCartCountDisplay();
  }

  function syncQuantitySpansInModals(itemId, qty) {
    document.querySelectorAll(`.food-item[data-id="${cssEscape(itemId)}"] .quantity`).forEach(span => {
      span.textContent = qty;
    });
  }

  function syncQtyInCheckoutIfOpen(itemId, qty) {
    const el = document.getElementById(`checkout-qty-${itemId}`);
    const subEl = document.getElementById(`checkout-sub-${itemId}`);
    if (el) el.textContent = qty;
    const item = cart.find(it => it.id === itemId);
    if (subEl) subEl.textContent = `₹${((item?.price || 0) * qty).toFixed(2)}`;
    recalcCheckoutTotals();
  }

  function recalcCheckoutTotals() {
    const subtotalEl = document.getElementById('checkout-subtotal');
    const totalEl = document.getElementById('checkout-total');
    if (!subtotalEl || !totalEl) return;
    const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    totalEl.textContent = `₹${total.toFixed(2)}`;
  }

  // ---------- Global changeQuantity ----------
  window.changeQuantity = function(button, change) {
    const foodItem = button.closest('.food-item');
    if (!foodItem) return;
    const itemId = foodItem.dataset.id;
    const itemName = foodItem.dataset.name;
    const itemPrice = parseFloat(foodItem.dataset.price) || 0;
    const qtySpan = foodItem.querySelector('.quantity');
    let current = parseInt(qtySpan.textContent, 10) || 0;
    const prev = current;
    current = Math.max(0, current + change);
    qtySpan.textContent = current;
    setItemQuantity(itemId, itemName, itemPrice, current);
    syncQtyInCheckoutIfOpen(itemId, current);
    if (change > 0 && current > prev) {
      showCartToast({ name: itemName }, cart);
    }
  };

  // === Cart Toast Popup Function ===
  function showCartToast(item, cartArr, options = {}) {
    const body = document.getElementById('cartToastBody');
    if (!body) return;
    body.innerHTML = `
      ${getFoodEmoji(item.name)} <b>${escapeHtml(item.name)}</b> added to cart.<br>
      <small>Items: ${cartArr.reduce((sum, i) => sum + i.qty, 0)} | Subtotal: ₹${cartArr.reduce((sum, i) => sum + i.price * i.qty, 0).toFixed(2)}</small>
      <br><button id="cartToastGoToCart" class="btn btn-light btn-sm mt-2">Go to Cart</button>
      <button id="cartToastClose" class="btn btn-outline-light btn-sm mt-2 ms-2">Close</button>
    `;
    const toastEl = document.getElementById('cartToast');
    if (toastEl && typeof bootstrap !== 'undefined' && bootstrap.Toast) {
      // Show persistent toast (autohide false). User explicitly closes or clicks Go to Cart.
      const toast = new bootstrap.Toast(toastEl, { autohide: false });
      toast.show();

      // Attach event handlers safely (remove previous to avoid duplicates)
      setTimeout(() => {
        const goto = document.getElementById('cartToastGoToCart');
        const closeBtn = document.getElementById('cartToastClose');
        if (goto) {
          goto.onclick = (e) => {
            e.preventDefault();
            try { bootstrap.Toast.getInstance(toastEl)?.hide(); } catch (err) {}
            openCheckoutModal();
          };
        }
        if (closeBtn) {
          closeBtn.onclick = (e) => {
            e.preventDefault();
            try { bootstrap.Toast.getInstance(toastEl)?.hide(); } catch (err) {}
          };
        }
      }, 10);
    } else if (toastEl) {
      // Fallback: show simple message using alert
      console.log("Bootstrap Toast not available; cart toast shown in console.");
    }
  }

  // ---------- Build checkout UI ----------
  function buildCheckoutModalContent() {
    const modalBody = document.getElementById('checkout-items-body');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const totalEl = document.getElementById('checkout-total');
    const taxRate = 0.05;
    if (!modalBody) return;
    modalBody.innerHTML = '';

    if (!cart.length) {
      modalBody.innerHTML = `<div class="text-center p-4">Your cart is empty.</div>`;
      if (subtotalEl) subtotalEl.textContent = '₹0.00';
      if (totalEl) totalEl.textContent = '₹0.00';
      return;
    }

    const table = document.createElement('table');
    table.className = 'table table-borderless';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width:50%;">Item</th>
          <th style="width:15%;">Qty</th>
          <th style="width:15%;">Price</th>
          <th style="width:15%;">Subtotal</th>
          <th style="width:5%;"></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    let subtotal = 0;
    cart.forEach(item => {
      const itemSubtotal = item.price * item.qty;
      subtotal += itemSubtotal;
      const emoji = getFoodEmoji(item.name);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${emoji} ${escapeHtml(item.name)}</td>
        <td>
          <div class="d-flex align-items-center">
            <button class="btn btn-sm btn-light" data-action="dec" data-id="${item.id}">−</button>
            <span class="mx-2 fw-bold" id="checkout-qty-${item.id}">${item.qty}</span>
            <button class="btn btn-sm btn-light" data-action="inc" data-id="${item.id}">+</button>
          </div>
        </td>
        <td>₹${item.price.toFixed(2)}</td>
        <td id="checkout-sub-${item.id}">₹${itemSubtotal.toFixed(2)}</td>
        <td><button class="btn btn-sm btn-outline-danger" data-action="remove" data-id="${item.id}">Remove</button></td>
      `;
      tbody.appendChild(tr);
    });

    modalBody.appendChild(table);

    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `₹${total.toFixed(2)}`;
  }

  // ---------- Open checkout ----------
  function openCheckoutModal() {
    // Hide the toast if it's visible for smoother UX
    const toastEl = document.getElementById('cartToast');
    if (toastEl) {
      try { bootstrap.Toast.getInstance(toastEl)?.hide(); } catch (e) {}
    }

    const modalEl = document.getElementById('checkoutModal');
    if (!modalEl) {
      console.error('Checkout modal not found');
      return;
    }
    buildCheckoutModalContent();
    // Show the Bootstrap modal
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();
    } else {
      console.error('Bootstrap modal not available');
    }
  }
  // expose globally so inline onclicks can call it
  window.openCheckoutModal = openCheckoutModal;

  // ---------- Cart operations ----------
  function clearCart() {
    cart = [];
    saveCart();
    updateCartCountDisplay();
    buildCheckoutModalContent();
    document.querySelectorAll('.food-item .quantity').forEach(s => s.textContent = '0');
  }

  // ---------- Place Order Flow helpers ----------
  function openOrderConfirmModal() {
    const modalEl = document.getElementById(ORDER_CONFIRM_MODAL_ID);
    if (!modalEl) {
      alert("Order confirmation modal missing");
      return;
    }

    const summaryEl = modalEl.querySelector('#order-summary-body');
    if (summaryEl) {
      summaryEl.innerHTML = cart
        .map((it) => `<div>${getFoodEmoji(it.name)} ${escapeHtml(it.name)} × ${it.qty} = ₹${(it.price * it.qty).toFixed(2)}</div>`)
        .join('');
    }

    const total = cart.reduce((s, it) => s + it.price * it.qty, 0) * 1.05;
    const confirmTotalEl = modalEl.querySelector('#confirm-total');
    if (confirmTotalEl) confirmTotalEl.textContent = `₹${total.toFixed(2)}`;

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();
    }
  }

  function showOrderSuccessPopup() {
    const popup = document.getElementById(ORDER_POPUP_ID);
    if (!popup) return;

    popup.style.display = 'flex';
    try {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 100, startVelocity: 50 });
      }
    } catch (e) {}

    setTimeout(() => {
      popup.style.display = 'none';
      const modalEl = document.getElementById(CHECKOUT_MODAL_ID);
      try {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
      } catch (err) {}
      showTrackingStatus();
    }, 1500);
  }

  function showTrackingStatus() {
    const trackingDiv = document.createElement('div');
    trackingDiv.className = 'tracking-overlay';
    trackingDiv.innerHTML = `
      <div class="tracking-card">
        <h3>🚚 Order Tracking</h3>
        <div class="tracking-steps">
          <div class="step active">Order Received 🎉</div>
          <div class="step">Chef’s Magic in Progress 👨‍🍳</div>
          <div class="step">Plating Your Experience 🍽️</div>
          <div class="step">On Its Way to Table 🛎️</div>
          <div class="step">Enjoy Your Meal! ✨</div>
        </div>
      </div>
    `;
    document.body.appendChild(trackingDiv);

    const steps = trackingDiv.querySelectorAll('.step');
    let current = 0;
    const progress = setInterval(() => {
      if (current < steps.length - 1) {
        steps[current].classList.remove('active');
        steps[++current].classList.add('active');
      } else {
        clearInterval(progress);
        setTimeout(() => { trackingDiv.remove(); }, 1000);
      }
    }, 1200);
  }

  // UPI QR modal helper (simple)
  function showUPIQrModal(upiId = "foodmunch@upi") {
    if (!document.getElementById("upi-qr-modal")) {
      const div = document.createElement("div");
      div.innerHTML = `
       <div class="modal fade" id="upi-qr-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-sm modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Pay via UPI</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center">
              <p class="mb-2">Scan to pay</p>
              <img src="upi-qr.jpg" alt="UPI QR" style="max-width:20%;height:auto;" />
              <p class="mt-2 small">UPI ID: <span id="upi-id-text">${escapeHtml(upiId)}</span></p>
              <button id="copy-upi-id" class="btn btn-sm btn-outline-primary">Copy UPI ID</button>
            </div>
          </div>
        </div>
      </div>
      `;
      document.body.appendChild(div);
      const copyBtn = document.getElementById("copy-upi-id");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          const text = document.getElementById("upi-id-text")?.textContent || upiId;
          navigator.clipboard?.writeText(text).then(() => {
            alert("UPI ID copied to clipboard");
          }).catch(() => {
            alert("Unable to copy UPI ID");
          });
        });
      }
    } else {
      const t = document.getElementById("upi-id-text");
      if (t) t.textContent = upiId;
    }
    const modalEl = document.getElementById("upi-qr-modal");
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) new bootstrap.Modal(modalEl).show();
  }

  // ---------- Place Order ----------
  function getAddressForOrder() {
    const cust = document.getElementById('cust-address')?.value?.trim();
    const del = document.getElementById('delivery-location')?.value?.trim();
    if (cust) return cust;
    if (del) return del;
    return "";
  }

  function placeOrder() {
    const name = document.getElementById('cust-name')?.value?.trim();
    const addr = getAddressForOrder();
    const phone = document.getElementById('cust-phone')?.value?.trim();
    const pay = document.querySelector('input[name="payment"]:checked')?.value;
    const orderType = document.getElementById("order-type")?.value;
    const tableNum = document.getElementById("table-number")?.value?.trim();

    if (!cart.length) { alert("🛒 Your cart is empty! Please add items before placing order."); return; }
    if (!orderType) { alert("⚠️ Please select Order Type (Delivery or Dine-In)."); return; }

    if (orderType === "delivery") {
      if (!name) { alert("Full name is required."); return; }
      if (!phone) { alert("Phone number is required."); return; }
      if (!addr || addr.length < 5) { alert("Please enter a valid delivery address."); return; }
    } else if (orderType === "dinein") {
      if (!name) { alert("Full name is required."); return; }
      if (!phone) { alert("Phone number is required."); return; }
      if (!tableNum) { alert("Please enter your table number."); return; }
    }

    const order = {
      items: [...cart],
      total: cart.reduce((s, it) => s + it.price * it.qty, 0) * 1.05,
      customer: { name, addr: orderType === "delivery" ? addr : `Table ${tableNum || "N/A"}`, phone, pay, orderType, tableNum },
      date: new Date().toLocaleString(),
    };

    if (pay === "UPI") {
      showUPIQrModal("foodmunch@upi");
      const upiModalEl = document.getElementById("upi-qr-modal");
      if (upiModalEl) {
        upiModalEl.addEventListener('hidden.bs.modal', function onHide() {
          upiModalEl.removeEventListener('hidden.bs.modal', onHide);
          let history = JSON.parse(localStorage.getItem('foodMunchOrders') || '[]');
          history.push(order);
          localStorage.setItem('foodMunchOrders', JSON.stringify(history));
          showOrderSuccessPopup();
          clearCart();
        });
        return;
      }
    }

    let history = JSON.parse(localStorage.getItem('foodMunchOrders') || '[]');
    history.push(order);
    localStorage.setItem('foodMunchOrders', JSON.stringify(history));
    showOrderSuccessPopup();
    clearCart();
  }

  // ---------- Event Delegation for data-action buttons ----------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'inc':
      case 'dec': {
        const idx = findCartIndex(id);
        if (idx === -1) return;
        const delta = action === 'inc' ? 1 : -1;
        cart[idx].qty = Math.max(0, cart[idx].qty + delta);
        if (cart[idx].qty === 0) cart.splice(idx, 1);
        saveCart();
        buildCheckoutModalContent();
        updateCartCountDisplay();
        syncQuantitySpansInModals(id, findCartIndex(id) > -1 ? cart[findCartIndex(id)].qty : 0);
        break;
      }
      case 'remove': {
        const idx = findCartIndex(id);
        if (idx > -1) cart.splice(idx, 1);
        saveCart();
        buildCheckoutModalContent();
        updateCartCountDisplay();
        syncQuantitySpansInModals(id, 0);
        break;
      }
      case 'clear-cart':
        clearCart();
        break;

      case 'checkout':
      case 'confirm-order': {
        if (cart.length === 0) { alert("🛒 Your cart is empty! Please add items before placing order."); return; }
        const orderType = document.getElementById("order-type")?.value;
        if (!orderType) { alert("⚠️ Please select Order Type (Delivery or Dine-In)."); return; }

        if (orderType === "delivery") {
          const address = getAddressForOrder();
          if (!address || address.length < 5) { alert("📍 Please enter a valid Delivery Address."); return; }
        }

        if (orderType === "dinein") {
          const tableNum = document.getElementById("table-number")?.value?.trim();
          if (!tableNum) { alert("🍽 Please enter your Table Number."); return; }
        }

        const name = document.getElementById('cust-name')?.value?.trim();
        const phone = document.getElementById('cust-phone')?.value?.trim();
        if (!name) { alert("Full name is required."); return; }
        if (!phone) { alert("Phone number is required."); return; }

        placeOrder();
        break;
      }
    }
  });

  // ---------- Cart icon opens checkout ----------
  if (cartIconLink) {
    cartIconLink.addEventListener('click', (ev) => {
      // If the cart link is an actual navigation anchor, prevent default so we present modal
      ev.preventDefault();
      openCheckoutModal();
    });
  }

  // Chef Quotes Slider (auto rotates quotes every 4 seconds) - isolated
  (function initChefQuotes() {
    const quotes = document.querySelectorAll('.chef-quotes-slider blockquote');
    let qIndex = 0;
    if (quotes.length > 0) {
      quotes[qIndex].classList.add('active');
      setInterval(() => {
        quotes[qIndex].classList.remove('active');
        qIndex = (qIndex + 1) % quotes.length;
        quotes[qIndex].classList.add('active');
      }, 4000);
    }
  })();

  // Mood emoji toggle (guarded)
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const storyMood = document.getElementById('storyMood');
      if (storyMood) storyMood.value = this.textContent;
    });
  });

  // Image preview (guarded)
  const storyImageInput = document.getElementById('storyImage');
  if (storyImageInput) {
    storyImageInput.addEventListener('change', function() {
      const preview = document.getElementById('imagePreview');
      if (!preview) return;
      preview.innerHTML = "";
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function (evt) {
          preview.innerHTML = `<img src="${evt.target.result}" />`;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  // Food story form (guarded)
  const foodStoryForm = document.getElementById('foodStoryForm');
  if (foodStoryForm) {
    foodStoryForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const previewImg = document.getElementById('imagePreview')?.querySelector('img')?.src;
      const caption = document.getElementById('storyCaption')?.value;
      const emoji = document.getElementById('storyMood')?.value;
      if (!previewImg || !emoji || !caption) return;

      const grid = document.getElementById('storyMasonry');
      if (!grid) return;
      const card = document.createElement('div');
      card.className = 'col-12 col-md-4 story-card';
      card.innerHTML = `
        <span class="story-emoji">${emoji}</span>
        <img src="${previewImg}"/>
        <div class="story-caption">${escapeHtml(caption)}</div>
        <button class="delete-story-btn" title="Delete Story" aria-label="Delete">
          <i class="fas fa-trash"></i>
        </button>
      `;
      const delBtn = card.querySelector('.delete-story-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (confirm("Are you sure you want to delete this story?")) card.remove();
        });
      }
      grid.prepend(card);

      this.reset();
      const preview = document.getElementById('imagePreview');
      if (preview) preview.innerHTML = '';
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      const storyMood = document.getElementById('storyMood');
      if (storyMood) storyMood.value = '';
    });
  }

  // ---------- Init ----------
  loadCart();
  updateCartCountDisplay();

  // Sync existing quantities on page load
  cart.forEach((it) => {
    document.querySelectorAll(`.food-item[data-id="${cssEscape(it.id)}"] .quantity`).forEach((span) => {
      span.textContent = it.qty;
    });
  });

  // expose minimal API
  window.foodMunch = { clearCart, placeOrder };

}); // DOMContentLoaded end
