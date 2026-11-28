/* ================================================================
   EATSWADA — CHECKOUT COUPONS  (window.EWCoupon)
   ----------------------------------------------------------------
   Manual coupon entry on the checkout page only. The customer types a
   code in the existing Savings-corner sheet; this module asks the
   backend to validate it and then lets the existing pricing quote and
   the existing EWOffers popup show the result.

   Backend contract (controllers/couponController.js, POST /coupons/validate)
     request : { code, subtotal, restaurantId, paymentMethod: 'upi'|'cod' }
     success : { success:true,
                 data : { code, discount, type },            (legacy shape)
                 offer: { code, title, description, type, value, discount,
                          maxDiscount, minSubtotal, restaurantId,
                          restaurantName, image, paymentMethods,
                          startsAt, expiresAt, autoApply, showPopup } }
     failure : 400 { success:false, code:'COUPON_*', message }

   Authoritative quote contract (controllers/pricingController.js, POST /pricing/quote)
     request : { restaurantId, addressId, items, paymentMethod, couponCode?, tipAmount? }
     200     : { success:true, data:<quote> }  -> bill.couponDiscount is the ONLY
               trustworthy coupon rupee amount
     409     : { success:false, code, message, data:<quote> } when the order is not
               serviceable. A coupon the engine cannot fund arrives as
               `COUPON_NOT_ECONOMICALLY_SERVICEABLE` (NOT the delivery reason
               `NOT_ECONOMICALLY_SERVICEABLE`), so it is a coupon verdict.
     400     : { success:false, code:'COUPON_*', message } when the coupon itself is
               rejected before pricing (NOT_FOUND / EXPIRED / WRONG_RESTAURANT /
               MIN_SUBTOTAL / PAYMENT_METHOD / FIRST_ORDER_ONLY / ...).

   Rules this file keeps
     • Never auto-applies. `autoApply` is ignored; the /coupons/eligible
       endpoint is never called. The customer always types the code.
     • Never computes or approves a discount. The validate response and,
       above all, the backend pricing quote (bill.couponDiscount) are the
       only sources of any rupee amount shown.
     • `showPopup` (from the validated offer) gates ONLY the confirmation
       popup: when it is false the discount still shows in the bill but no
       popup is shown.
     • ctState.couponCode is what the existing quote request and
       POST /orders already read; it is only set after a successful
       validation and is cleared whenever the backend says it no longer
       applies. Nothing here is persisted to storage.
     • States: "Applying..." (during validate AND every quote refresh) ->
       "Applied" ONLY when the backend quote shows bill.couponDiscount > 0.
       If the quote rejects or ignores the coupon it is cleared (and no
       longer sent) with a message. A cart with no quote (several
       restaurants, no saved address, engine off) never applies a coupon.
     • Duplicate taps, stale responses and a payment-method change during
       validation are handled with an in-flight lock and a sequence token.

   Requires (all optional, read lazily): ctState, readCart, closeSheet,
   renderCart, showToast, CONFIG, EWAuth, EWCartQuoteUI, EWOffers.
   ================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EWCoupon = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  /* Fallback wording, used only when the backend sent a code but no message. */
  var FALLBACK_MESSAGES = {
    COUPON_NOT_FOUND: 'Coupon is invalid or expired.',
    COUPON_INVALID: 'Coupon is invalid or expired.',
    COUPON_INACTIVE: 'This coupon is not currently active.',
    COUPON_NOT_STARTED: 'This coupon is not active yet.',
    COUPON_EXPIRED: 'This coupon has expired.',
    COUPON_EXHAUSTED: 'Coupon usage limit has been reached.',
    COUPON_WRONG_RESTAURANT: 'This coupon is not valid for this checkout.',
    COUPON_RESTAURANT_INELIGIBLE: 'This coupon is not available for this restaurant right now.',
    COUPON_MIN_SUBTOTAL: 'Your order is below the minimum for this coupon.',
    COUPON_PER_USER_LIMIT: 'You have already used this coupon.',
    COUPON_FIRST_ORDER_ONLY: 'This coupon is for first orders only.',
    COUPON_PAYMENT_METHOD: 'This coupon is not valid for the selected payment method.',
    // The pricing quote's own coupon verdict: the engine cannot fund the coupon
    // on this basket, so it must never stay shown as applied.
    COUPON_NOT_ECONOMICALLY_SERVICEABLE: 'This coupon cannot be applied to this order right now. Try a larger order or another coupon.'
  };
  var NETWORK_MESSAGE = 'We couldn’t reach EatSwada. Check your connection and try again.';
  var SERVER_MESSAGE = 'Something went wrong while checking the coupon. Please try again.';
  var LOGIN_MESSAGE = 'Please log in to apply a coupon.';

  var st = { applying: false, seq: 0, rseq: 0, awaitingQuote: false, reval: false, notice: '' };

  function num(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function isNum(v) { return v !== null && v !== undefined && v !== '' && isFinite(Number(v)); }
  function money(v) {
    var x = Math.round(num(v) * 100) / 100;
    return '₹' + (x % 1 ? x.toFixed(2) : String(x));
  }
  function normalizeCode(c) { return String(c || '').trim().toUpperCase(); }
  function cs() { try { return ctState; } catch (e) { return null; } }
  function doc() { return (root && root.document) || null; }
  function byId(id) { var d = doc(); return d && d.getElementById ? d.getElementById(id) : null; }
  function call(name) {
    // Calls a cart-page global by name, tolerating its absence.
    try {
      // cart-page.js declares these as top-level functions, i.e. globals.
      var fn = (typeof root[name] === 'function') ? root[name] : null;
      if (fn) return fn.apply(null, Array.prototype.slice.call(arguments, 1));
    } catch (e) { /* cosmetic */ }
    return undefined;
  }
  function toast(msg, kind) { call('showToast', msg, kind || 'error'); }

  /* ── environment readers ─────────────────────────────────────── */
  function selectedMethod() {
    var m = call('ctSelectedPaymentMethod');
    return m === 'cod' ? 'cod' : 'upi';
  }
  function cartRestaurantIds() {
    var ids = {};
    try {
      var cart = call('readCart') || {};
      Object.keys(cart).forEach(function (k) {
        var r = cart[k] && cart[k].resId;
        if (r && r !== 'undefined' && r !== 'null') ids[String(r)] = 1;
      });
    } catch (e) { /* ignore */ }
    return Object.keys(ids).sort();
  }
  function foodSubtotal() {
    var s = cs();
    if (s && Array.isArray(s.items) && s.items.length) {
      return s.items.reduce(function (sum, it) { return sum + num(it.price) * (num(it.quantity) || 1); }, 0);
    }
    return s ? num(s.subtotal) : 0;
  }
  function authToken() {
    try {
      if (root.EWAuth && typeof root.EWAuth.getToken === 'function') return root.EWAuth.getToken();
      return root.localStorage.getItem('nearbite_token') || root.localStorage.getItem('eatswada_token') || '';
    } catch (e) { return ''; }
  }
  function apiBase() {
    try { return CONFIG.API_BASE_URL; } catch (e) { return (root.CONFIG && root.CONFIG.API_BASE_URL) || ''; }
  }
  function quoteUi() { return root.EWCartQuoteUI || null; }
  function currentQuote() {
    try {
      var c = quoteUi() && quoteUi()._controller && quoteUi()._controller();
      return (c && c.quote && c.quote()) || null;
    } catch (e) { return null; }
  }
  /* A single-restaurant cart with an address is priced by the backend quote;
     otherwise (multi-restaurant, GPS-only, engine off) there is no quote. */
  function quotePathActive() {
    try {
      var q = quoteUi();
      return !!(q && typeof q.isQuoteEligible === 'function' && q.isQuoteEligible() &&
        !(typeof q.isEngineDisabled === 'function' && q.isEngineDisabled()));
    } catch (e) { return false; }
  }
  function requote() {
    try { if (quoteUi() && typeof quoteUi().onBasketChanged === 'function') quoteUi().onBasketChanged(); } catch (e) { /* pricing must not break */ }
  }
  function offers() { return root.EWOffers || null; }

  /* ── response handling ───────────────────────────────────────── */
  function messageFor(code, backendMessage) {
    var m = String(backendMessage || '').trim();
    if (m) return m;
    return FALLBACK_MESSAGES[String(code || '')] || 'Coupon could not be applied.';
  }

  /* Presentation metadata from `offer`, falling back to the legacy `data`.
     Absent fields stay null so the UI hides them instead of inventing values. */
  function normalizeImage(v) {
    if (typeof v !== 'string' || !v.trim()) return null;
    v = v.trim();
    if (/^https:\/\//i.test(v)) return v;
    if (/^http:\/\//i.test(v)) return 'https://' + v.slice(7);          // mixed content would be blocked
    if (v.charAt(0) === '/') { try { return new URL(v, apiBase()).href.replace(/^http:/i, 'https:'); } catch (e) { return null; } }
    return null;
  }
  function buildOffer(body) {
    var o = (body && body.offer && typeof body.offer === 'object') ? body.offer : null;
    var d = (body && body.data && typeof body.data === 'object') ? body.data : null;
    if (!o && !d) return null;
    var src = o || {};
    var code = normalizeCode(src.code || (d && d.code));
    if (!code) return null;
    var discount = isNum(src.discount) ? Number(src.discount) : (d && isNum(d.discount) ? Number(d.discount) : 0);
    var type = src.type || (d && d.type) || null;
    var methods = Array.isArray(src.paymentMethods)
      ? src.paymentMethods.map(function (m) { return String(m || '').toLowerCase(); }).filter(function (m) { return m === 'upi' || m === 'cod'; })
      : null;
    /* The promo image may arrive under another field name or only in the legacy `data` block. */
    var IMG_KEYS = ['image', 'imageUrl', 'imageURL', 'promoImage', 'promotionalImage', 'promotionalImageUrl', 'bannerImage', 'banner', 'thumbnail'];
    var rawImage = null, imgFrom = null;
    [src, d || {}].forEach(function (obj) {
      IMG_KEYS.forEach(function (k) {
        if (!rawImage && obj && typeof obj[k] === 'string' && obj[k].trim()) { rawImage = obj[k]; imgFrom = k; }
      });
    });
    /* The backend may fall back to the restaurant photo; the promo-image popup is for a coupon's own image only. */
    var image = (src.imageSource === 'restaurant') ? null : normalizeImage(rawImage);
    if (!image && src.imageSource !== 'restaurant') {
      diagnose('coupon has no usable promo image', { received: rawImage, field: imgFrom, offerKeys: Object.keys(src), dataKeys: d ? Object.keys(d) : null });
    }
    return {
      code: code,
      title: src.title ? String(src.title) : '',
      description: src.description ? String(src.description) : '',
      type: type === 'percent' || type === 'fixed' ? type : null,
      value: isNum(src.value) ? Number(src.value) : null,
      discount: discount,
      maxDiscount: isNum(src.maxDiscount) ? Number(src.maxDiscount) : null,
      minSubtotal: isNum(src.minSubtotal) ? Number(src.minSubtotal) : 0,
      restaurantId: src.restaurantId ? String(src.restaurantId) : null,
      restaurantName: src.restaurantName ? String(src.restaurantName) : '',
      image: image,
      paymentMethods: methods && methods.length ? methods : null,
      expiresAt: src.expiresAt || null,
      // The backend's own popup switch. Absent (older payloads) means "show",
      // so a coupon whose contract predates the flag still confirms once.
      showPopup: src.showPopup === false ? false : true
    };
  }

  /* Turns an HTTP status + parsed body into { ok, code, message, offer }. */
  function interpret(status, body) {
    if (status >= 200 && status < 300 && body && body.success) {
      var offer = buildOffer(body);
      if (offer) return { ok: true, offer: offer, discount: offer.discount };
      return { ok: false, code: 'BAD_RESPONSE', message: SERVER_MESSAGE };
    }
    if (status === 401) return { ok: false, code: 'AUTH', message: LOGIN_MESSAGE };
    var code = body && body.code ? String(body.code) : '';
    if (status >= 500 || !body) return { ok: false, code: code || 'SERVER', message: (body && body.message) || SERVER_MESSAGE };
    return { ok: false, code: code || 'COUPON_INVALID', message: messageFor(code, body && body.message) };
  }

  function validate(p) {
    var f = root.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!f) return Promise.resolve({ ok: false, code: 'NETWORK', message: NETWORK_MESSAGE });
    var token = authToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return Promise.resolve().then(function () {
      return f(apiBase() + '/coupons/validate', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          code: p.code,
          subtotal: p.subtotal,
          restaurantId: p.restaurantId || undefined,
          paymentMethod: p.paymentMethod === 'cod' ? 'cod' : 'upi'
        })
      });
    }).then(function (r) {
      return r.json().then(function (b) { return b; }, function () { return null; })
        .then(function (b) { return interpret(r.status, b); });
    }, function () { return { ok: false, code: 'NETWORK', message: NETWORK_MESSAGE }; });
  }

  /* ── payment wording (from the backend's own paymentMethods) ─── */
  function paymentLabel(methods) {
    if (!Array.isArray(methods) || !methods.length) return '';
    var hasU = methods.indexOf('upi') !== -1, hasC = methods.indexOf('cod') !== -1;
    if (hasU && hasC) return 'UPI & Cash on Delivery';
    return hasU ? 'UPI only' : 'Cash on Delivery only';
  }
  function paymentOnlyPhrase(methods) {
    if (!Array.isArray(methods) || methods.length !== 1) return 'the selected payment method';
    return methods[0] === 'cod' ? 'Cash on Delivery' : 'UPI';
  }

  /* ── what the checkout is allowed to show as the discount ────── */
  /* The backend quote's bill.couponDiscount is authoritative. Before the first
     quote for this coupon arrives there is nothing trustworthy to show on a
     quote-priced cart (null). Carts without a quote (multi-restaurant, no
     address, engine off) use the validated amount; POST /orders re-prices. */
  function authoritativeAmount() {
    var s = cs();
    if (!s || !s.couponCode) return null;
    if (!quotePathActive()) return null;           // no quote -> nothing can confirm a coupon
    if (st.awaitingQuote) return null;
    var q = currentQuote();
    var b = q && q.bill;
    if (b && isNum(b.couponDiscount)) return Number(b.couponDiscount);
    return null;
  }

  /* Why a coupon cannot be used on this cart (no backend quote exists for it). */
  function noQuoteMessage() {
    try { if (quoteUi() && quoteUi().isEngineDisabled && quoteUi().isEngineDisabled()) return 'Coupons are not available for this order right now.'; } catch (e) { /* fall through */ }
    if (cartRestaurantIds().length > 1) return 'Coupons work for one restaurant at a time. Order from one restaurant to use a coupon.';
    return 'Select a saved delivery address to use a coupon.';
  }

  function detailRows(o) {
    var rows = [];
    if (o.restaurantName) rows.push({ label: 'Restaurant', value: o.restaurantName });
    if (o.minSubtotal > 0) rows.push({ label: 'Minimum order', value: money(o.minSubtotal) });
    if (o.maxDiscount !== null && o.maxDiscount > 0) rows.push({ label: 'Maximum discount', value: money(o.maxDiscount) });
    var pay = paymentLabel(o.paymentMethods);
    if (pay) rows.push({ label: 'Payment', value: pay });
    if (o.expiresAt) {
      var d = new Date(o.expiresAt);
      if (!isNaN(d.getTime())) rows.push({ label: 'Valid till', value: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) });
    }
    return rows;
  }

  /* The payload EWOffers shows for the confirmation. Null until there is a
     real, backend-confirmed discount for the code now in ctState — and null
     when the backend's own `showPopup` flag says not to pop up (the discount
     still shows in the bill; only the popup is suppressed). */
  function confirmation() {
    var s = cs();
    if (!s || !s.couponCode) return null;
    var offer = s.couponOffer;
    if (!offer || offer.code !== normalizeCode(s.couponCode)) return null;
    if (offer.showPopup === false) { if (st.warnedNoPopup !== offer.code) { st.warnedNoPopup = offer.code; diagnose('popup suppressed: backend offer.showPopup is false', { code: offer.code }); } return null; }
    var amount = authoritativeAmount();
    if (!(amount > 0)) return null;
    var headline, sub;
    if (offer.image) {
      /* Promo-image coupon: the new confirmation wording. */
      headline = money(amount) + ' saved on this order \uD83C\uDF89';
      sub = offer.description || 'Good food with extra offers. That\u2019s double the delight!';
    } else {
      /* No promo image: the original wording, unchanged. */
      var big;
      if (offer.type === 'percent' && offer.value > 0) big = String(offer.value).replace(/\.0+$/, '') + '% OFF';
      else if (offer.type === 'fixed' && offer.value > 0) big = money(offer.value) + ' OFF';
      else big = money(amount) + ' off!';
      var at = offer.restaurantName ? ' at ' + offer.restaurantName : '';
      headline = 'Get ' + big + at;
      sub = offer.description || ('You saved ' + money(amount) + ' on this order.');
    }
    return {
      code: offer.code,
      amount: amount,
      big: headline,
      sub: sub,
      chip: 'YOU SAVED ' + money(amount),
      title: offer.title || '',
      desc: '',
      image: offer.image || '',
      details: detailRows(offer),
      row: money(amount) + ' saved with ' + offer.code
    };
  }

  /* ── Savings-corner card ─────────────────────────────────────── */
  function paint() {
    var s = cs();
    var sub = byId('coupon-card-sub');
    var group = byId('ct-payment-group');
    var box = byId('coupon-applied-box');
    var txt = byId('coupon-applied-text');
    var has = !!(s && s.couponCode);
    // "Applying..." covers the /coupons/validate call AND every quote refresh.
    var busy = st.applying || (has && quotePathActive() && st.awaitingQuote);
    var amt = (has && !busy) ? authoritativeAmount() : null;
    // "Applied" only when the backend quote shows a coupon discount.
    var applied = has && !busy && amt > 0;
    if (sub) {
      if (busy) sub.textContent = (has && !st.applying) ? 'Applying ' + s.couponCode + '…' : 'Applying coupon…';
      else if (applied) sub.textContent = s.couponCode + ' applied · You save ' + money(amt);
      else if (has) sub.textContent = s.couponCode + ' · waiting for the price check';
      else sub.textContent = st.notice || '';
    }
    if (group && group.classList) { if (applied) group.classList.add('is-applied'); else group.classList.remove('is-applied'); }
    if (box) box.hidden = !applied;
    if (txt) txt.textContent = applied ? s.couponCode : '';
  }

  function setError(msg) {
    var err = byId('coupon-error');
    if (!err) return;
    err.textContent = msg || '';
    err.hidden = !msg;
  }
  function setBusy(on) {
    var btn = byId('coupon-apply');
    if (btn) {
      btn.disabled = !!on;
      if (btn.setAttribute) btn.setAttribute('aria-busy', on ? 'true' : 'false');
      btn.textContent = on ? 'Checking…' : 'Apply coupon';
    }
  }

  function afterChange() {
    paint();
    requote();
    // The legacy bill rows read ctState.couponDiscount; repaint outside this call stack.
    setTimeout(function () { call('renderCart'); }, 0);
    try { if (offers() && offers().evaluate) offers().evaluate(); } catch (e) { /* cosmetic */ }
  }

  /* ── state changes ───────────────────────────────────────────── */
  function commit(offer, method) {
    var s = cs();
    if (!s) return;
    var prev = s.couponCode;
    if (prev && prev !== offer.code) { try { offers() && offers().forgetCoupon && offers().forgetCoupon(prev); } catch (e) { /* ignore */ } }
    s.couponCode = offer.code;
    s.couponDiscount = 0;                         // only the backend quote sets an amount
    s.couponOffer = offer;
    st.notice = '';
    st.awaitingQuote = quotePathActive();
    st.validatedMethod = method;
  }

  function clearState() {
    var s = cs();
    if (!s) return '';
    var prev = s.couponCode;
    s.couponCode = '';
    s.couponDiscount = 0;
    s.couponOffer = null;
    st.awaitingQuote = false;
    st.seq += 1;                                  // any in-flight validation is now stale
    st.rseq += 1;
    if (prev) { try { offers() && offers().forgetCoupon && offers().forgetCoupon(prev); } catch (e) { /* ignore */ } }
    return prev || '';
  }

  /* Drop the coupon because it no longer applies, and say why. */
  function dropCoupon(reason) {
    var prev = clearState();
    if (!prev) return;
    st.notice = prev + ' was removed. ' + reason;
    toast(prev + ' removed — ' + reason, 'error');
    afterChange();
  }

  function remove() {
    var prev = clearState();
    st.notice = '';
    setError('');
    if (prev) toast('Coupon removed', 'success');
    afterChange();
    call('closeSheet');
  }

  /* ── the Apply button ────────────────────────────────────────── */
  async function applyFromSheet() {
    if (st.applying) return { ok: false, ignored: true };       // duplicate tap
    var input = byId('coupon-input');
    var code = normalizeCode(input && input.value);
    setError('');
    if (!code) { setError('Enter a coupon code.'); return { ok: false, code: 'EMPTY' }; }
    var s = cs();
    if (!s) return { ok: false };

    if (s.couponCode && normalizeCode(s.couponCode) === code) {
      setError('This coupon is already applied.');
      return { ok: false, code: 'ALREADY_APPLIED' };
    }
    var ids = cartRestaurantIds();
    if (!ids.length) { setError('Add items to your cart before applying a coupon.'); return { ok: false, code: 'EMPTY_CART' }; }

    // No backend quote for this cart (several restaurants, no saved address, engine off):
    // the coupon cannot be confirmed, so it is not applied.
    if (!quotePathActive()) {
      var nq = noQuoteMessage();
      setError(nq);
      return { ok: false, code: 'NO_QUOTE', message: nq };
    }

    st.applying = true;
    setBusy(true);
    paint();
    var mySeq = ++st.seq;
    var res = null, method = selectedMethod();
    try {
      for (var attempt = 0; attempt < 2; attempt++) {
        method = selectedMethod();
        res = await validate({ code: code, subtotal: foodSubtotal(), restaurantId: ids[0], paymentMethod: method });
        if (mySeq !== st.seq) return { ok: false, stale: true };  // coupon removed / replaced meanwhile
        if (!res.ok || selectedMethod() === method) break;        // method changed mid-flight: ask again
      }
    } finally {
      st.applying = false;
      setBusy(false);
      paint();
    }
    if (!res.ok) { setError(res.message); return res; }          // previous coupon, if any, is kept

    if (selectedMethod() !== method) {                           // still racing after a retry: do not commit
      setError('Your payment method changed. Please tap Apply again.');
      return { ok: false, code: 'METHOD_CHANGED' };
    }
    // A restaurant coupon needs a single-restaurant checkout (backend: COUPON_WRONG_RESTAURANT).
    // /coupons/validate only receives one restaurantId, so a multi-restaurant cart must be refused here.
    if (res.offer.restaurantId && (ids.length !== 1 || ids[0] !== res.offer.restaurantId)) {
      var msg = FALLBACK_MESSAGES.COUPON_WRONG_RESTAURANT;
      setError(msg);
      return { ok: false, code: 'COUPON_WRONG_RESTAURANT', message: msg };
    }

    commit(res.offer, method);
    if (input) input.value = '';
    afterChange();
    call('closeSheet');
    return { ok: true, offer: res.offer };
  }

  /* ── payment-method change ───────────────────────────────────── */
  /* Called by cart-page when the customer switches UPI <-> COD, before the
     re-quote is requested. A coupon is only ever dropped here, never approved. */
  function onPaymentMethodChanged(method) {
    var s = cs();
    if (!s || !s.couponCode) return;
    method = method === 'cod' ? 'cod' : 'upi';
    var offer = s.couponOffer;
    if (offer && offer.paymentMethods && offer.paymentMethods.indexOf(method) === -1) {
      dropCoupon('it is only valid when you pay with ' + paymentOnlyPhrase(offer.paymentMethods) + '.');
      return;
    }
    revalidate(method);
  }

  /* Ask the backend again whether the applied coupon still holds. */
  async function revalidate(method) {
    var s = cs();
    if (!s || !s.couponCode || st.reval) return;
    var code = normalizeCode(s.couponCode);
    var ids = cartRestaurantIds();
    if (!ids.length) return;
    st.reval = true;
    var mySeq = ++st.rseq;
    var res;
    try {
      res = await validate({ code: code, subtotal: foodSubtotal(), restaurantId: ids[0], paymentMethod: method || selectedMethod() });
    } finally { st.reval = false; }
    var now = cs();
    if (mySeq !== st.rseq || !now || normalizeCode(now.couponCode) !== code) return;   // superseded
    if (res.ok) {
      if (res.offer && now.couponOffer) now.couponOffer = res.offer;
      paint();
      return;
    }
    if (res.code === 'NETWORK' || res.code === 'SERVER' || res.code === 'AUTH') return; // not a verdict on the coupon
    dropCoupon(res.message);
  }

  /* ── quote events (see cart-quote-ui.js notifyQuote / notifyPending) ── */
  /* Contract diagnostics: a structured console warning for a backend answer
     that contradicts the documented contract. Never shown to the customer. */
  function diagnose(reason, extra) {
    try {
      if (!root.console || typeof root.console.warn !== 'function') return;
      root.console.warn('[EWCoupon] ' + reason, extra || {});
    } catch (e) { /* logging must never break checkout */ }
  }

  /* The backend quote is the only authority. It confirms the coupon with
     bill.couponDiscount > 0; any other answer clears the coupon. */
  function onQuoteResult(detail) {
    var s = cs();
    if (!s || !s.couponCode) return;
    var d = detail || {};
    // An answer to an older request (priced without this coupon) says nothing about it;
    // a newer quote is already on its way.
    if (normalizeCode(d.requestCoupon) !== normalizeCode(s.couponCode)) return;
    st.awaitingQuote = false;
    var code = String(d.code || '');
    if (d.ok) {
      var q = currentQuote();
      var b = q && q.bill;
      if (b && isNum(b.couponDiscount) && Number(b.couponDiscount) > 0) {
        s.couponDiscount = Number(b.couponDiscount);       // authoritative
        paint();
        try { if (offers() && offers().evaluate) offers().evaluate(); } catch (e) { /* cosmetic */ }
        return;
      }
      // Quote is fine but it did not price the coupon (missing or zero): the
      // contract says a submitted coupon the quote ignores is never "applied".
      // Treat it as a rejection and log the detail for diagnostics only.
      diagnose('quote succeeded without pricing the coupon', {
        couponCode: s.couponCode,
        couponDiscount: b ? b.couponDiscount : undefined,
        billKeys: b ? Object.keys(b) : null,
        quoteId: q && q.quoteId
      });
      dropCoupon('it could not be applied to this order.');
      return;
    }
    // The quote rejected the coupon: the backend sends its COUPON_* code and
    // message. This includes COUPON_NOT_ECONOMICALLY_SERVICEABLE, the coupon's
    // own economic rejection (distinct from the delivery reason
    // NOT_ECONOMICALLY_SERVICEABLE below).
    if (/^COUPON_/.test(code)) { dropCoupon(messageFor(code, d.message)); return; }
    if (code === 'PRICING_ENGINE_DISABLED') { dropCoupon('coupons are not available for this order right now.'); return; }
    // Delivery is not economical with this coupon on the bill: the coupon cannot be used.
    if (d.decision === 'NOT_ECONOMICALLY_SERVICEABLE' || code === 'NOT_ECONOMICALLY_SERVICEABLE' || code === 'target_unreachable_within_permitted_rules') {
      dropCoupon('it can’t be used with this order right now.');
      return;
    }
    // Network error, outside the delivery area, minimum order...: not a verdict on the coupon.
    // It stays unconfirmed (never shown as Applied) and the quote UI offers its own retry.
    paint();
  }

  /* A fresh quote is being asked for: until it answers the coupon is "Applying...". */
  function onQuotePending() {
    var s = cs();
    if (!s || !s.couponCode || !quotePathActive()) return;
    st.awaitingQuote = true;
    paint();
  }

  /* The cart has no quote any more (second restaurant added, address removed). */
  function onQuoteUnavailable() {
    var s = cs();
    if (!s || !s.couponCode) return;
    if (!cartRestaurantIds().length) { clearState(); afterChange(); return; }   // empty cart: just reset
    dropCoupon(noQuoteMessage());
  }

  /* A restaurant-specific coupon cannot outlive a change of restaurant. */
  function onCartUpdated() {
    var s = cs();
    if (!s || !s.couponCode || !s.couponOffer || !s.couponOffer.restaurantId) return;
    var ids = cartRestaurantIds();
    if (ids.length && (ids.length !== 1 || ids[0] !== s.couponOffer.restaurantId)) {
      dropCoupon('it is not valid for this checkout.');
    }
  }

  function prepareSheet() {
    setError('');
    var input = byId('coupon-input');
    if (input) input.value = '';
    st.notice = '';
    paint();
  }

  var d0 = doc();
  if (d0 && typeof d0.addEventListener === 'function') {
    d0.addEventListener('eatswada:quote-result', function (e) { try { onQuoteResult(e && e.detail); } catch (err) { /* never break pricing */ } });
    d0.addEventListener('eatswada:quote-pending', function () { try { onQuotePending(); } catch (err) { /* ignore */ } });
    d0.addEventListener('eatswada:quote-unavailable', function () { try { onQuoteUnavailable(); } catch (err) { /* ignore */ } });
    d0.addEventListener('eatswada:cart-updated', function () { try { onCartUpdated(); } catch (err) { /* ignore */ } });
  }

  return {
    applyFromSheet: applyFromSheet,
    remove: remove,
    prepareSheet: prepareSheet,
    paint: paint,
    confirmation: confirmation,
    onPaymentMethodChanged: onPaymentMethodChanged,
    onQuoteResult: onQuoteResult,
    onQuotePending: onQuotePending,
    onQuoteUnavailable: onQuoteUnavailable,
    onCartUpdated: onCartUpdated,
    validate: validate,
    interpret: interpret,
    buildOffer: buildOffer,
    messageFor: messageFor,
    paymentLabel: paymentLabel,
    isApplying: function () { return st.applying; },
    _state: st
  };
});
