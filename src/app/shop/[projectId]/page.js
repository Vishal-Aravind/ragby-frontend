"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Search, X, Plus, Minus, ChevronRight, Check, RotateCw } from "lucide-react";
import LocationStep from "./_components/LocationStep";
import BranchList from "./_components/BranchList";
import ClosedBanner from "./_components/ClosedBanner";
import CheckoutSheet from "./_components/CheckoutSheet";
import MenuItemCard from "./_components/MenuItemCard";
import {
  UUID_RE, errorMessage, getConfig, getOrder, findBranches, getCatalogs, getProducts,
  getBranchStatus, readSession, writeSession, formatMoney, closedToastText,
} from "./_lib/shopApi";

const EMPTY_FORM = { fulfilment: "pickup", name: "", address: "", pincode: "", coords: null };

const validPoint = (p) =>
  p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) ? { lat: Number(p.lat), lng: Number(p.lng) } : null;

// Steps: loading → location → branches → menu (cart / checkout sheets on top) → submitted.
// Plus "unavailable" (shop switched off / no branches) and "error" (couldn't load).
export default function ShopPage() {
  const { projectId } = useParams();
  const searchParams = useSearchParams();
  // phone is never stored; it is always read from the WhatsApp link.
  const phone = searchParams.get("phone") || "";
  const catalogHint = searchParams.get("catalog") || "";
  const urlOrderId = searchParams.get("order_id") || "";
  const urlBranch = searchParams.get("branch") || "";

  const [step, setStep] = useState("loading");
  const [bootNonce, setBootNonce] = useState(0);
  const [config, setConfig] = useState(null);

  const [branches, setBranches] = useState([]);
  const [origin, setOrigin] = useState(null); // {lat,lng,source} from the server, or null
  const [originLabel, setOriginLabel] = useState(null);
  const [originPincode, setOriginPincode] = useState("");
  const [branch, setBranch] = useState(null);
  const [locked, setLocked] = useState(false); // editing an order: branch can't change
  const [status, setStatus] = useState(null);

  const [products, setProducts] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(false);
  const [menuNonce, setMenuNonce] = useState(0);
  const [activeCatalogId, setActiveCatalogId] = useState("");

  const [cart, setCart] = useState({});
  const [orderItemInfo, setOrderItemInfo] = useState({}); // product_id → {name, price, image_url}
  const [orderId, setOrderId] = useState(urlOrderId);
  const [restored, setRestored] = useState(false);
  const [notEditable, setNotEditable] = useState(false);

  const [sheet, setSheet] = useState(null); // null | "cart" | "checkout"
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [form, setForm] = useState(EMPTY_FORM);
  const [result, setResult] = useState(null);

  const branchRef = useRef(null);
  useEffect(() => {
    branchRef.current = branch;
  }, [branch]);

  const accent = config?.accent_color || "#16a34a";
  const currency = config?.currency || "₹";
  const india = currency === "₹";

  // ---- choosing a branch ---------------------------------------------------
  const openBranch = useCallback(
    (b, { keepCart = false, origin: o = null, label = null, pincode = "" } = {}) => {
      const prev = branchRef.current;
      if (prev && prev.id !== b.id && !keepCart) {
        setCart({});
        setOrderItemInfo({});
      }
      setBranch(b);
      setStatus(b.status || null);
      setSearch("");
      setActiveCategory("All");
      setSheet(null);
      setStep("menu");
      const gpsPoint = o && (o.source === "gps" || o.source === "pin") ? validPoint(o) : null;
      setForm((f) => ({
        ...f,
        fulfilment:
          f.fulfilment === "delivery" && b.delivery_available
            ? "delivery"
            : b.pickup_enabled || !b.delivery_available
              ? "pickup"
              : "delivery",
        pincode: f.pincode || pincode || "",
        // Only a real GPS/map point; a pincode centroid must never price a delivery.
        coords: f.coords || gpsPoint,
      }));
      writeSession(projectId, { branchId: b.id, origin: o, originLabel: label, pincode: pincode || "" });
    },
    [projectId]
  );

  // ---- boot ----------------------------------------------------------------
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      setStep("loading");
      const cfg = await getConfig(projectId);
      if (cancelled) return;
      if (cfg.status === 403 || cfg.status === 404) return setStep("unavailable");
      if (!cfg.ok || !cfg.data) return setStep("error");
      setConfig(cfg.data);

      const saved = readSession(projectId);
      const savedOrigin = saved ? validPoint(saved.origin) : null;
      const savedPincode = typeof saved?.pincode === "string" ? saved.pincode : "";

      // Add More / Change Order: restore the cart (phone-checked server side).
      let order = null;
      if (urlOrderId) {
        const o = await getOrder(urlOrderId, phone);
        if (cancelled) return;
        if (o.ok && o.data && Array.isArray(o.data.items) && o.data.items.length > 0) order = o.data;
      }
      let restoredForm = null;
      if (order) {
        const map = {};
        const info = {};
        for (const it of order.items) {
          if (!it?.product_id) continue;
          map[it.product_id] = (map[it.product_id] || 0) + (Number(it.quantity) || 0);
          info[it.product_id] = { name: it.name, price: it.price, image_url: it.image_url || null };
        }
        setCart(map);
        setOrderItemInfo(info);
        setRestored(true);
        restoredForm = {
          fulfilment: order.fulfilment === "delivery" ? "delivery" : "pickup",
          name: order.customer_name || "",
          address: order.delivery_address || "",
          pincode: order.customer_pincode || "",
          coords: validPoint({ lat: order.customer_lat, lng: order.customer_lng }),
        };
        setForm({ ...EMPTY_FORM, ...restoredForm });
        if (order.editable === false) {
          // Next submit creates a fresh order instead of hitting a 409.
          setNotEditable(true);
          setOrderId("");
        }
      }

      const editable = order && order.editable !== false;
      const lockId = editable && order.branch_id ? order.branch_id : null;
      const wantId = order?.branch_id || (UUID_RE.test(urlBranch) ? urlBranch : null);
      const count = cfg.data.branch_count;
      const single = count == null || count <= 1;
      const savedBranchId = saved && UUID_RE.test(saved.branchId || "") ? saved.branchId : null;

      if (!wantId && !single && !savedBranchId) {
        if (!cancelled) setStep("location");
        return;
      }

      const listBody = savedOrigin ? { lat: savedOrigin.lat, lng: savedOrigin.lng, source: "pin" } : {};
      const r = await findBranches(projectId, listBody);
      if (cancelled) return;
      if (r.status === 403 || r.status === 404) return setStep("unavailable");
      if (!r.ok || !r.data) return setStep("error");
      const list = Array.isArray(r.data.branches) ? r.data.branches : [];
      if (list.length === 0) return setStep("unavailable");

      const o = r.data.origin || null;
      const label = o ? saved?.originLabel || "Your location" : null;
      setBranches(list);
      setOrigin(o);
      setOriginLabel(label);
      setOriginPincode(savedPincode);

      const byId = (id) => (id ? list.find((b) => b.id === id) : null);
      let target = byId(wantId);
      if (target && target.id === lockId) setLocked(true);
      if (!target && list.length === 1) target = list[0];
      if (!target && single) target = byId(cfg.data.default_branch_id) || list[0];
      if (!target) target = byId(savedBranchId);

      if (target) {
        openBranch(target, { keepCart: true, origin: o, label, pincode: savedPincode });
      } else {
        setStep(o ? "branches" : "location");
      }
    })();

    return () => {
      cancelled = true;
    };
    // URL params are read once per boot; a retry bumps bootNonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, bootNonce]);

  // ---- menu for the chosen branch -------------------------------------------
  const branchId = branch?.id;
  useEffect(() => {
    if (!projectId || !branchId) return;
    let cancelled = false;
    (async () => {
      setMenuLoading(true);
      setMenuError(false);
      // The legacy ?catalog= hint only filters when it belongs to this branch.
      let catId = "";
      if (catalogHint && UUID_RE.test(catalogHint)) {
        const c = await getCatalogs(projectId, branchId);
        if (cancelled) return;
        if (c.ok && Array.isArray(c.data) && c.data.some((x) => x.id === catalogHint)) catId = catalogHint;
      }
      const p = await getProducts(projectId, branchId, catId);
      if (cancelled) return;
      if (p.ok && Array.isArray(p.data)) {
        setProducts(p.data);
      } else {
        setProducts([]);
        setMenuError(true);
      }
      setActiveCatalogId(catId);
      setMenuLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, branchId, catalogHint, menuNonce]);

  // ---- open/closed polling ----------------------------------------------------
  useEffect(() => {
    if (step !== "menu" || !projectId || !branchId) return;
    let alive = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const r = await getBranchStatus(projectId, branchId);
      if (alive && r.ok && r.data && typeof r.data.can_order === "boolean") setStatus(r.data);
    };
    const id = setInterval(tick, 60000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [step, projectId, branchId]);

  // ---- location search (LocationStep) --------------------------------------
  const handleSearch = async (body, label) => {
    const r = await findBranches(projectId, body);
    if (!r.ok || !r.data) {
      if (r.status === 0) return "Network error. Please check your connection and try again.";
      return errorMessage(r.data, "Couldn't find branches. Please try again.");
    }
    const list = Array.isArray(r.data.branches) ? r.data.branches : [];
    const o = r.data.origin || null;
    const pc = body.pincode || "";
    const lbl = pc || (o ? label : null);
    setBranches(list);
    setOrigin(o);
    setOriginLabel(lbl);
    setOriginPincode(pc);
    if (pc) setForm((f) => ({ ...f, pincode: pc }));
    if (o && (o.source === "gps" || o.source === "pin")) {
      setForm((f) => ({ ...f, coords: validPoint(o) }));
    }
    writeSession(projectId, { branchId: branch?.id || null, origin: o, originLabel: lbl, pincode: pc });
    setStep("branches");
    return null;
  };

  // ---- cart -----------------------------------------------------------------
  const canOrder = status ? status.can_order !== false : true;
  const productById = useMemo(() => {
    const m = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([product_id, quantity]) => ({ product_id, quantity })),
    [cart]
  );
  const cartItems = cartLines.map((l) => {
    const p = productById[l.product_id] || orderItemInfo[l.product_id] || {};
    return { id: l.product_id, name: p.name || "Item", price: Number(p.price) || 0, image_url: p.image_url || null, quantity: l.quantity };
  });
  const cartCount = cartLines.reduce((a, l) => a + l.quantity, 0);
  // Display only — every amount that is charged comes from the server quote.
  const localSubtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const blocked = () => toast(closedToastText(status));
  const addToCart = (product) => {
    if (!canOrder) return blocked();
    setCart((c) => ({ ...c, [product.id]: (c[product.id] || 0) + 1 }));
  };
  const removeFromCart = (product) =>
    setCart((c) => {
      const qty = (c[product.id] || 0) - 1;
      if (qty <= 0) {
        const next = { ...c };
        delete next[product.id];
        return next;
      }
      return { ...c, [product.id]: qty };
    });
  const keepOnly = (ids) =>
    setCart((c) => {
      const next = {};
      for (const [k, v] of Object.entries(c)) if (ids.has(k)) next[k] = v;
      return next;
    });

  // Only pass the catalog when every cart line is from it (a restored cart can
  // hold items from other catalogs, which the server would reject).
  const catalogForSubmit =
    activeCatalogId && cartLines.every((l) => productById[l.product_id]?.catalog_id === activeCatalogId)
      ? activeCatalogId
      : null;

  const canChangeBranch = branches.length > 1 && !locked;

  const openWhatsApp = () => {
    const bizPhone = (config?.store_phone || "").replace(/\D/g, "");
    const target = bizPhone || "15556458639";
    window.location.href = `https://wa.me/${target}`;
  };

  // ---- screens -------------------------------------------------------------
  const shell = (children) => (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8faf8" }}>
      <div className="text-center space-y-4 max-w-xs w-full">{children}</div>
    </div>
  );

  if (step === "loading") return shell(
    <>
      <div className="w-10 h-10 rounded-full animate-spin mx-auto"
        style={{ border: "3px solid #e5e7eb", borderTopColor: "#16a34a" }} />
      <p className="text-sm text-gray-400">Loading menu...</p>
    </>
  );

  if (step === "unavailable") return shell(
    <>
      <div className="text-4xl">🏪</div>
      <h2 className="text-lg font-bold text-gray-900">This shop isn&apos;t available right now</h2>
      <p className="text-sm text-gray-500">Please check back later or message the store on WhatsApp.</p>
    </>
  );

  if (step === "error") return shell(
    <>
      <h2 className="text-lg font-bold text-gray-900">Couldn&apos;t load the shop</h2>
      <p className="text-sm text-gray-500">Please check your connection and try again.</p>
      <button onClick={() => setBootNonce((n) => n + 1)}
        className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
        style={{ background: accent }}>
        <RotateCw size={16} /> Try again
      </button>
    </>
  );

  if (step === "submitted" && result) {
    const isDel = result.fulfilment === "delivery";
    return shell(
      <>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: accent }}>
          <Check size={28} color="white" strokeWidth={3} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{result.count} items added</h2>
          {result.total != null && (
            <p className="text-2xl font-bold mt-1" style={{ color: accent }}>{formatMoney(currency, result.total)}</p>
          )}
          <p className="text-sm text-gray-600 mt-1">
            {branches.length > 1 && result.branchName ? `🏪 ${result.branchName} · ` : ""}
            {isDel ? "🛵 Delivery" : "🏃 Pickup"}
          </p>
        </div>
        <p className="text-sm text-gray-500">
          Your cart has been saved.<br />
          Go back to WhatsApp — your cart summary is waiting there with options to continue or edit.
        </p>
        <button onClick={openWhatsApp}
          className="w-full py-4 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2"
          style={{ background: accent }}>
          💬 Open WhatsApp
        </button>
      </>
    );
  }

  if (step === "location") return (
    <LocationStep
      storeName={config?.store_name}
      accent={accent}
      initialPincode={originPincode}
      onSearch={handleSearch}
    />
  );

  if (step === "branches") return (
    <BranchList
      storeName={config?.store_name}
      branches={branches}
      originLabel={originLabel}
      hasDistances={branches.some((b) => b.distance_km != null)}
      accent={accent}
      currency={currency}
      cartCount={branch ? cartCount : 0}
      onPick={(b) => openBranch(b, { origin, label: originLabel, pincode: originPincode })}
      onChangeLocation={() => setStep("location")}
    />
  );

  // ---- menu ----------------------------------------------------------------
  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];
  const q = search.toLowerCase();
  const filtered = products.filter((p) => {
    const matchSearch = !q || (p.name || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q);
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    return matchSearch && matchCat;
  });
  const grouped = {};
  filtered.forEach((p) => {
    const cat = p.category || "General";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const multi = branches.length > 1;
  const showStatusLine = status?.label && status.can_order && status.label !== "Open now";

  return (
    <div className="min-h-screen pb-24" style={{ background: "#f8faf8", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="sticky top-0 z-20 shadow-sm">
        <div className="px-4 pt-4 pb-3" style={{ background: accent }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h1 className="text-white font-bold text-lg leading-tight">{config?.store_name || "Menu"}</h1>
              {multi && branch && (
                <p className="text-white text-xs opacity-90 mt-0.5 truncate">
                  🏪 {branch.name}
                  {canChangeBranch && (
                    <button onClick={() => setStep("branches")} className="ml-1 underline font-semibold">· Change</button>
                  )}
                </p>
              )}
              {showStatusLine && <p className="text-white text-[11px] opacity-80 mt-0.5">{status.label}</p>}
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search dishes, categories..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white rounded-xl pl-8 pr-4 py-2.5 text-sm outline-none text-gray-700 placeholder-gray-400" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Clear search">
                <X size={14} className="text-gray-400" />
              </button>
            )}
          </div>
          {restored && cartCount > 0 && (
            <p className="text-white text-xs opacity-80 mt-2">✓ Your previous cart has been restored</p>
          )}
        </div>
        <ClosedBanner status={status} branchName={branch?.name} />
      </div>

      {notEditable && (
        <div className="px-4 py-2 text-center text-xs font-medium" style={{ background: "#fee2e2", color: "#991b1b" }}>
          This order is already being processed — place a new order
        </div>
      )}

      {!phone && (
        <div className="px-4 py-2 text-center text-xs font-medium" style={{ background: "#fef3c7", color: "#92400e" }}>
          ⚠️ Open this menu from your WhatsApp chat to place an order — you can browse below, but checkout needs WhatsApp.
        </div>
      )}

      {categories.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border"
              style={{
                background: activeCategory === cat ? accent : "white",
                color: activeCategory === cat ? "white" : "#374151",
                borderColor: activeCategory === cat ? accent : "#e5e7eb",
              }}>
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className={`px-4 space-y-6 ${categories.length > 1 ? "" : "pt-4"}`}>
        {menuLoading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-white border border-gray-100 animate-pulse" />)}
          </div>
        )}
        {!menuLoading && Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            {(activeCategory === "All" || Object.keys(grouped).length > 1) && (
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-bold text-gray-900">{category}</h2>
                <span className="text-xs text-gray-400">{items.length} items</span>
                <div className="flex-1 h-px" style={{ background: accent, opacity: 0.3 }} />
              </div>
            )}
            <div className="space-y-3">
              {items.map((product) => (
                <MenuItemCard
                  key={product.id}
                  product={product}
                  qty={cart[product.id] || 0}
                  accent={accent}
                  currency={currency}
                  disabled={!canOrder}
                  onAdd={addToCart}
                  onRemove={removeFromCart}
                  onBlocked={blocked}
                />
              ))}
            </div>
          </div>
        ))}
        {!menuLoading && menuError && (
          <div className="text-center py-12 space-y-3">
            <p className="text-gray-500 text-sm">Couldn&apos;t load the menu.</p>
            <button onClick={() => setMenuNonce((n) => n + 1)} className="text-sm font-semibold" style={{ color: accent }}>
              Try again
            </button>
          </div>
        )}
        {!menuLoading && !menuError && filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">{products.length === 0 ? "No items on the menu yet" : "No items found"}</p>
          </div>
        )}
      </div>

      {cartCount > 0 && !sheet && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 z-30">
          <button onClick={() => setSheet("cart")}
            className="w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-between px-5 shadow-lg"
            style={{ background: canOrder ? accent : "#6b7280" }}>
            <span className="bg-white/20 rounded-lg px-2.5 py-0.5 text-sm font-bold">{cartCount} items</span>
            <span>{canOrder ? formatMoney(currency, localSubtotal) : "Closed"}</span>
            <span className="flex items-center gap-1">View Cart <ChevronRight size={16} /></span>
          </button>
        </div>
      )}

      {sheet === "cart" && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheet(null)} />
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart size={18} /> Your Cart
              </h2>
              <button onClick={() => setSheet(null)} aria-label="Close"
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} className="text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt={item.name} className="w-14 h-14 object-cover rounded-lg shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-400">{currency}{item.price} each</p>
                    <p className="font-bold text-sm" style={{ color: accent }}>
                      {formatMoney(currency, item.price * item.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => removeFromCart(item)} aria-label={`Remove one ${item.name}`}
                      className="w-8 h-8 rounded-lg border-2 flex items-center justify-center font-bold"
                      style={{ borderColor: accent, color: accent }}>
                      <Minus size={14} />
                    </button>
                    <span className="font-bold text-sm w-4 text-center" style={{ color: accent }}>{item.quantity}</span>
                    <button onClick={() => addToCart(item)} aria-label={`Add one more ${item.name}`}
                      aria-disabled={!canOrder || undefined}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                      style={{ background: canOrder ? accent : "#d1d5db" }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {cartItems.length === 0 && <p className="text-center text-sm text-gray-400 py-6">Your cart is empty</p>}
            </div>
            <div className="px-5 py-4 border-t space-y-2">
              <div className="flex justify-between text-sm text-gray-700 font-medium">
                <span>Items</span><span>{formatMoney(currency, localSubtotal)}</span>
              </div>
              <p className="text-xs text-gray-400">Taxes{branch?.delivery_available ? " and delivery" : ""} are calculated at checkout.</p>
              <button
                onClick={() => (canOrder ? setSheet("checkout") : blocked())}
                disabled={cartItems.length === 0}
                aria-disabled={!canOrder || undefined}
                className="w-full py-4 rounded-xl text-white font-semibold text-base mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: canOrder ? accent : "#9ca3af" }}>
                {canOrder ? <>Checkout <ChevronRight size={18} /></> : closedToastText(status)}
              </button>
              {!phone && (
                <p className="text-xs text-red-500 text-center">Please open this link from WhatsApp</p>
              )}
            </div>
          </div>
        </div>
      )}

      {sheet === "checkout" && branch && (
        <CheckoutSheet
          projectId={projectId}
          phone={phone}
          branch={branch}
          status={status}
          currency={currency}
          accent={accent}
          india={india}
          cartLines={cartLines}
          catalogId={catalogForSubmit}
          orderId={orderId}
          origin={origin}
          locked={locked}
          canChangeBranch={canChangeBranch}
          form={form}
          setForm={setForm}
          onClose={() => setSheet(null)}
          onBack={() => setSheet("cart")}
          onChangeBranch={() => {
            setSheet(null);
            setStep("branches");
          }}
          onKeepOnly={keepOnly}
          onOrderNotEditable={() => {
            setOrderId("");
            setLocked(false);
            setNotEditable(true);
          }}
          onSubmitted={(data) => {
            setResult({
              total: data.total,
              count: cartCount,
              branchName: branch.name,
              fulfilment: form.fulfilment,
            });
            setSheet(null);
            setStep("submitted");
            if (data.warning) console.warn("submit-cart warning:", data.warning);
          }}
        />
      )}
    </div>
  );
}
