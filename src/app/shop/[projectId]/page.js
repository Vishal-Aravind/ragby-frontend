"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Search, X, ChevronRight, Check, RotateCw } from "lucide-react";
import LocationStep from "./_components/LocationStep";
import BranchList from "./_components/BranchList";
import ClosedBanner from "./_components/ClosedBanner";
import CheckoutFlow from "./_components/CheckoutFlow";
import MenuItemCard from "./_components/MenuItemCard";
import ShopHeader from "./_components/ShopHeader";
import OffersStrip from "./_components/OffersStrip";
import BottomBar, { BOTTOM_BAR_HEIGHT } from "./_components/BottomBar";
import MyOrders from "./_components/MyOrders";
import OrderPlaced from "./_components/OrderPlaced";
import PaymentReturn from "./_components/PaymentReturn";
import {
  UUID_RE, errorMessage, getConfig, getOrder, findBranches, getCatalogs, getProducts, getOffers,
  getBranchStatus, getOrderStatus, cancelOrder, readSession, writeSession, formatMoney, closedToastText,
  stripUrlParams, openWhatsAppChat,
} from "./_lib/shopApi";
import { bootIdentity, storeToken, UNVERIFIED } from "./_lib/identity";
import {
  EMPTY_ADDRESS, readCheckout, writeCheckout, readCart, writeCart, clearCart,
  readPending, clearPending, pendingLinkLive,
} from "./_lib/checkoutState";

const EMPTY_FORM = { fulfilment: "pickup", name: "", address: EMPTY_ADDRESS, coords: null };
const EMPTY_CHECKOUT = { step: 1, coupon: null, soldOut: "remove_item", note: "" };

const validPoint = (p) =>
  p && p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
    ? { lat: Number(p.lat), lng: Number(p.lng) }
    : null;
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

/** Form fields from a source; null when the source has nothing useful. */
function formFromLastDetails(d) {
  if (!d) return null;
  return {
    name: str(d.customer_name, 80),
    address: d.address_line1
      ? { line1: str(d.address_line1, 110), line2: str(d.address_line2, 110), city: str(d.address_city, 50), pincode: str(d.customer_pincode, 10) }
      : null,
    coords: validPoint({ lat: d.customer_lat, lng: d.customer_lng }),
  };
}
function formFromOrder(o) {
  const line1 = o.address_line1 || (o.delivery_address ? String(o.delivery_address).slice(0, 110) : "");
  return {
    fulfilment: o.fulfilment === "delivery" ? "delivery" : "pickup",
    name: str(o.customer_name, 80),
    address: line1
      ? { line1: str(line1, 110), line2: str(o.address_line2, 110), city: str(o.address_city, 50), pincode: str(o.customer_pincode, 10) }
      : null,
    coords: validPoint({ lat: o.customer_lat, lng: o.customer_lng }),
  };
}
/** Later sources win; the address is taken whole from one source, never mixed. */
function mergeForms(...sources) {
  const out = { ...EMPTY_FORM };
  for (const s of sources) {
    if (!s) continue;
    if (s.fulfilment) out.fulfilment = s.fulfilment;
    if (s.name) out.name = s.name;
    if (s.address && s.address.line1) out.address = { ...EMPTY_ADDRESS, ...s.address };
    if (s.coords) out.coords = s.coords;
  }
  return out;
}

// Screens: loading → location → branches → menu (checkout full screen on top)
// → placed | submitted. Plus payment_return, unavailable and error.
// `tab` switches Home / My Orders independently of the screen.
export default function ShopPage() {
  const { projectId } = useParams();
  const searchParams = useSearchParams();
  // URL params are read once; t / phone / paid / r are stripped from the bar.
  const [url] = useState(() => ({
    phone: searchParams.get("phone") || "",
    catalog: searchParams.get("catalog") || "",
    orderId: searchParams.get("order_id") || "",
    branch: searchParams.get("branch") || "",
    view: searchParams.get("view") || "",
    t: searchParams.get("t") || "",
    paid: searchParams.get("paid") || "",
    r: searchParams.get("r") || "",
  }));
  const catalogHint = url.catalog;

  const [step, setStep] = useState("loading");
  const [tab, setTab] = useState("home");
  const [bootNonce, setBootNonce] = useState(0);
  const bootedRef = useRef(false);
  const [config, setConfig] = useState(null);

  const [token, setToken] = useState(null);
  const [identity, setIdentity] = useState(UNVERIFIED);
  const effectivePhone = identity.verified ? identity.phone : url.phone;

  const [branches, setBranches] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [originLabel, setOriginLabel] = useState(null);
  const [originPincode, setOriginPincode] = useState("");
  const [branch, setBranch] = useState(null);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState(null);

  const [products, setProducts] = useState([]);
  const [productsBranchId, setProductsBranchId] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(false);
  const [menuNonce, setMenuNonce] = useState(0);
  const [activeCatalogId, setActiveCatalogId] = useState("");
  const [offers, setOffers] = useState([]);
  const [pendingCode, setPendingCode] = useState(null);

  const [cart, setCart] = useState({});
  const [orderItemInfo, setOrderItemInfo] = useState({});
  const [orderId, setOrderId] = useState(url.orderId);
  const [restored, setRestored] = useState(false);
  const [notEditable, setNotEditable] = useState(false);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [form, setForm] = useState(EMPTY_FORM);
  const [checkout, setCheckout] = useState(EMPTY_CHECKOUT);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [persistReady, setPersistReady] = useState(false);

  const [placedResult, setPlacedResult] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [returnInfo, setReturnInfo] = useState(null);
  const [pendingBanner, setPendingBanner] = useState(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [reorderReq, setReorderReq] = useState(null);
  const [confirmAsk, setConfirmAsk] = useState(null); // {title, text, yes, onYes}

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
      setCheckoutOpen(false);
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
        address: f.address.pincode || !pincode ? f.address : { ...f.address, pincode },
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
      const first = !bootedRef.current;
      bootedRef.current = true;

      let ret = null;
      if (first && UUID_RE.test(url.paid) && url.r && url.r.length <= 64) {
        ret = { orderId: url.paid, receipt: url.r };
      }
      if (first && (url.paid || url.r)) {
        try {
          const names = ["paid", "r"];
          new URL(window.location.href).searchParams.forEach((_, k) => {
            if (k.startsWith("razorpay_")) names.push(k);
          });
          stripUrlParams(names);
        } catch {
          stripUrlParams(["paid", "r"]);
        }
      }

      const [cfg, idRes] = await Promise.all([getConfig(projectId), bootIdentity(projectId, first ? url.t : null)]);
      if (cancelled) return;
      setToken(idRes.token);
      setIdentity(idRes.identity);
      if (cfg.status === 403 || cfg.status === 404) return setStep("unavailable");
      if (!cfg.ok || !cfg.data) return setStep("error");
      setConfig(cfg.data);
      if (first && url.view === "orders") setTab("orders");

      if (ret) {
        setReturnInfo(ret);
        setStep("payment_return");
        return;
      }

      const ident = idRes.identity;
      const phoneNow = ident.verified ? ident.phone : url.phone;
      const saved = readSession(projectId);
      const savedOrigin = saved ? validPoint(saved.origin) : null;
      const savedPincode = typeof saved?.pincode === "string" ? saved.pincode : "";
      const savedCheckout = readCheckout(projectId);
      const savedCart = readCart(projectId);

      // Add More / Change Order: restore the cart (phone-checked server side).
      let order = null;
      const wantOrder = first ? url.orderId : orderId;
      if (wantOrder) {
        const o = await getOrder(wantOrder, phoneNow);
        if (cancelled) return;
        if (o.ok && o.data && Array.isArray(o.data.items) && o.data.items.length > 0) order = o.data;
      }

      setForm(
        mergeForms(
          ident.verified ? formFromLastDetails(ident.last_details) : null,
          savedCheckout,
          order ? formFromOrder(order) : null
        )
      );
      if (savedCheckout) {
        setCheckout({ step: savedCheckout.step, coupon: savedCheckout.coupon, soldOut: savedCheckout.soldOut, note: order?.note ? str(order.note, 300) : savedCheckout.note });
      } else if (order) {
        setCheckout({
          ...EMPTY_CHECKOUT,
          soldOut: ["remove_item", "call_me", "merchant_choice"].includes(order.sold_out_preference) ? order.sold_out_preference : "remove_item",
          note: str(order.note, 300),
        });
      }

      let cartFromOrder = false;
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
        cartFromOrder = true;
        if (order.editable === false) {
          // Next submit creates a fresh order instead of hitting a 409.
          setNotEditable(true);
          setOrderId("");
        }
      } else if (wantOrder) {
        setOrderId("");
      }

      const editable = order && order.editable !== false;
      const lockId = editable && order.branch_id ? order.branch_id : null;
      const savedBranchId = saved && UUID_RE.test(saved.branchId || "") ? saved.branchId : null;
      const wantId = order?.branch_id || (UUID_RE.test(url.branch) ? url.branch : null);
      const count = cfg.data.branch_count;
      const single = count == null || count <= 1;

      const finish = (target, o, label) => {
        if (target) {
          if (!cartFromOrder && savedCart && savedCart.branchId === target.id && Object.keys(savedCart.items).length) {
            setCart(savedCart.items);
            setOrderItemInfo(savedCart.info || {});
          }
          openBranch(target, { keepCart: true, origin: o, label, pincode: savedPincode });
          if (savedCheckout?.open && (cartFromOrder || (savedCart && savedCart.branchId === target.id))) setCheckoutOpen(true);
        }
        setPersistReady(true);
      };

      if (!wantId && !single && !savedBranchId) {
        if (!cancelled) setStep("location");
        finish(null);
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

      if (!target) setStep(o ? "branches" : "location");
      finish(target, o, label);
    })();

    return () => {
      cancelled = true;
    };
    // URL params are read once per boot; a retry bumps bootNonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, bootNonce]);

  // ---- back from Razorpay without paying: is the link still open? ------------
  useEffect(() => {
    if (step !== "menu" || !projectId) return;
    const p = readPending(projectId);
    if (!pendingLinkLive(p) || !p.receipt) {
      setPendingBanner(null);
      return;
    }
    let alive = true;
    (async () => {
      const r = await getOrderStatus(projectId, p.order_id, { receipt: p.receipt });
      if (!alive) return;
      if (r.status === 404) {
        clearPending(projectId);
        return;
      }
      const d = r.ok ? r.data : null;
      if (d && (d.payment_status === "paid" || d.status === "cancelled" || d.status !== "pending")) {
        clearPending(projectId);
        setPendingBanner(null);
        if (d.payment_status === "paid" && d.status !== "cancelled") {
          clearCart(projectId);
          setCart({});
          toast.success(`Payment received for #${d.short_id || p.short_id || ""}`, { id: "paid-already" });
        }
        return;
      }
      setPendingBanner({
        order_id: p.order_id,
        receipt: p.receipt,
        short_id: d?.short_id || p.short_id,
        total: d?.total ?? p.total,
        payment_url: d?.pay_url && String(d.pay_url).startsWith("https://") ? d.pay_url : p.payment_url,
      });
    })();
    return () => {
      alive = false;
    };
  }, [step, projectId]);

  // ---- menu for the chosen branch -------------------------------------------
  const branchId = branch?.id;
  useEffect(() => {
    if (!projectId || !branchId) return;
    let cancelled = false;
    (async () => {
      setMenuLoading(true);
      setMenuError(false);
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
      setProductsBranchId(branchId);
      setActiveCatalogId(catId);
      setMenuLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, branchId, catalogHint, menuNonce]);

  // ---- offers strip ------------------------------------------------------------
  useEffect(() => {
    if (!projectId || !branchId) return;
    let alive = true;
    (async () => {
      const r = await getOffers(projectId, branchId);
      if (!alive) return;
      setOffers(r.ok && Array.isArray(r.data?.offers) ? r.data.offers : []);
    })();
    return () => {
      alive = false;
    };
  }, [projectId, branchId]);

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

  // Persist the cart and the checkout form for this tab (never the token).
  useEffect(() => {
    if (!persistReady || !projectId) return;
    if (!branchId || cartLines.length === 0) {
      clearCart(projectId);
      return;
    }
    const info = {};
    for (const l of cartLines) {
      const p = productById[l.product_id] || orderItemInfo[l.product_id];
      if (p) info[l.product_id] = { name: p.name, price: p.price, image_url: p.image_url || null };
    }
    writeCart(projectId, { branchId, items: cart, info });
  }, [persistReady, projectId, branchId, cart, cartLines, productById, orderItemInfo]);

  const serializeCheckout = useCallback(
    (open) => ({
      open,
      step: checkout.step,
      fulfilment: form.fulfilment,
      name: form.name,
      address: form.address,
      coords: form.coords,
      coupon: checkout.coupon,
      soldOut: checkout.soldOut,
      note: checkout.note,
    }),
    [checkout, form]
  );
  useEffect(() => {
    if (!persistReady || !projectId) return;
    writeCheckout(projectId, serializeCheckout(checkoutOpen));
  }, [persistReady, projectId, serializeCheckout, checkoutOpen]);

  const blocked = () => toast(closedToastText(status), { id: "closed" });
  const addToCart = (product) => {
    if (!canOrder) return blocked();
    if (!cart[product.id]) toast.success("Added to cart", { id: "cart-add", duration: 1200 });
    setCart((c) => ({ ...c, [product.id]: Math.min(999, (c[product.id] || 0) + 1) }));
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

  // Only pass the catalog when every cart line is from it.
  const catalogForSubmit =
    activeCatalogId && cartLines.every((l) => productById[l.product_id]?.catalog_id === activeCatalogId)
      ? activeCatalogId
      : null;

  const canChangeBranch = branches.length > 1 && !locked;
  const homeStep = () => (branch ? "menu" : branches.length ? "branches" : "location");

  const openCheckout = () => {
    if (!branch) {
      toast("Pick a branch first", { id: "pick-branch" });
      return;
    }
    setTab("home");
    setStep("menu");
    setCheckout((c) => ({ ...c, step: 1 }));
    setCheckoutOpen(true);
  };

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
    if (pc) setForm((f) => (f.address.pincode ? f : { ...f, address: { ...f.address, pincode: pc } }));
    if (o && (o.source === "gps" || o.source === "pin")) {
      setForm((f) => ({ ...f, coords: validPoint(o) }));
    }
    writeSession(projectId, { branchId: branch?.id || null, origin: o, originLabel: lbl, pincode: pc });
    setStep("branches");
    return null;
  };

  // ---- reorder from My Orders ----------------------------------------------------
  const startReorder = (o) => {
    const go = async () => {
      let list = branches;
      let b = list.find((x) => x.id === o.branch_id);
      if (!b) {
        const r = await findBranches(projectId, {});
        list = r.ok && Array.isArray(r.data?.branches) ? r.data.branches : [];
        if (list.length) setBranches(list);
        b = list.find((x) => x.id === o.branch_id);
      }
      if (!b) {
        toast.error("That branch isn't taking online orders any more");
        return;
      }
      const switching = !branch || branch.id !== b.id;
      if (switching && orderId) {
        setOrderId("");
        setLocked(false);
      }
      if (switching) openBranch(b, { origin, label: originLabel, pincode: originPincode });
      setReorderReq({ branchId: b.id, items: Array.isArray(o.items) ? o.items : [] });
      setTab("home");
      setStep("menu");
    };
    if (cartCount > 0 && branch && o.branch_id !== branch.id) {
      setConfirmAsk({
        title: "Replace your cart?",
        text: `This order is from ${o.branch_name || "another branch"}. Your current cart will be cleared.`,
        yes: "Replace cart",
        onYes: go,
      });
    } else {
      go();
    }
  };

  useEffect(() => {
    if (!reorderReq || menuLoading || productsBranchId !== reorderReq.branchId) return;
    let added = 0;
    let missing = 0;
    const adds = {};
    for (const it of reorderReq.items) {
      const p = it?.product_id ? productById[it.product_id] : null;
      const q = Math.max(1, Math.floor(Number(it?.quantity) || 1));
      if (p) {
        adds[p.id] = (adds[p.id] || 0) + q;
        added += 1;
      } else {
        missing += 1;
      }
    }
    setReorderReq(null);
    if (added > 0) {
      setCart((c) => {
        const next = { ...c };
        for (const [k, q] of Object.entries(adds)) next[k] = Math.min(999, (next[k] || 0) + q);
        return next;
      });
      setCheckout((c) => ({ ...c, step: 1 }));
      setCheckoutOpen(true);
    }
    const msg = `${added} item${added === 1 ? "" : "s"} added${missing ? ` · ${missing} no longer available` : ""}`;
    if (added > 0) toast.success(msg, { id: "reorder" });
    else toast.error("None of those items are on the menu any more", { id: "reorder" });
  }, [reorderReq, menuLoading, productsBranchId, productById]);

  // ---- checkout callbacks ------------------------------------------------------
  const onVerifiedLost = useCallback(() => {
    storeToken(projectId, null);
    setToken(null);
    setIdentity((i) => ({ ...i, verified: false, reason: "expired" }));
    toast("Your WhatsApp link has expired — send *menu* in WhatsApp for a fresh one.", { id: "token-expired" });
  }, [projectId]);

  const onOrderNotEditable = useCallback(({ silent = false } = {}) => {
    setOrderId("");
    setLocked(false);
    if (!silent) setNotEditable(true);
  }, []);

  const resetAfterOrder = () => {
    clearCart(projectId);
    clearPending(projectId);
    setCart({});
    setOrderItemInfo({});
    setOrderId("");
    setLocked(false);
    setRestored(false);
    setNotEditable(false);
    setCheckout(EMPTY_CHECKOUT);
    setCheckoutOpen(false);
  };

  const cancelPendingPayment = async () => {
    if (!pendingBanner) return;
    setBannerBusy(true);
    const r = await cancelOrder(projectId, pendingBanner.order_id, { receipt: pendingBanner.receipt });
    setBannerBusy(false);
    if (r.ok) {
      clearPending(projectId);
      if (orderId && orderId === pendingBanner.order_id) {
        setOrderId("");
        setLocked(false);
      }
      setPendingBanner(null);
      toast.success("Payment cancelled — your cart is still here", { id: "pay-cancelled" });
    } else {
      toast.error(
        r.data?.detail?.code === "order_not_cancellable"
          ? "That order is already being processed and can't be cancelled."
          : errorMessage(r.data, "Couldn't cancel. Please try again."),
        { id: "pay-cancel-fail" }
      );
      if (r.data?.detail?.code === "order_not_cancellable") {
        clearPending(projectId);
        setPendingBanner(null);
      }
    }
  };

  // ---- screens -------------------------------------------------------------
  const shell = (children) => (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8faf8" }}>
      <div className="text-center space-y-4 max-w-xs w-full">{children}</div>
    </div>
  );

  const confirmDialog = confirmAsk && (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 px-4 pb-6" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-3 shadow-xl">
        <h3 className="font-bold text-gray-900 text-lg">{confirmAsk.title}</h3>
        <p className="text-sm text-gray-600">{confirmAsk.text}</p>
        <button
          onClick={() => {
            const fn = confirmAsk.onYes;
            setConfirmAsk(null);
            fn();
          }}
          className="w-full py-3 rounded-xl text-white font-semibold"
          style={{ background: accent }}
        >
          {confirmAsk.yes}
        </button>
        <button onClick={() => setConfirmAsk(null)} className="w-full py-2 text-sm font-semibold text-gray-500">
          Cancel
        </button>
      </div>
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

  if (step === "payment_return" && returnInfo) return (
    <PaymentReturn
      projectId={projectId}
      orderId={returnInfo.orderId}
      receipt={returnInfo.receipt}
      token={token}
      currency={currency}
      accent={accent}
      onPaid={() => {
        clearCart(projectId);
        clearPending(projectId);
        setCart({});
        setCheckout(EMPTY_CHECKOUT);
        try {
          const c = readCheckout(projectId);
          if (c) writeCheckout(projectId, { ...c, open: false, step: 1, coupon: null, note: "", soldOut: "remove_item" });
        } catch {
          /* ignore */
        }
      }}
      onMyOrders={() => {
        setReturnInfo(null);
        setTab("orders");
        setBootNonce((n) => n + 1);
      }}
      onBackToMenu={() => {
        setReturnInfo(null);
        setTab("home");
        setBootNonce((n) => n + 1);
      }}
    />
  );

  if (step === "placed" && placedResult) return (
    <OrderPlaced
      result={placedResult}
      currency={currency}
      accent={accent}
      onMyOrders={() => {
        setPlacedResult(null);
        setTab("orders");
        setStep(homeStep());
      }}
      onBackToMenu={() => {
        setPlacedResult(null);
        setTab("home");
        setStep(homeStep());
      }}
    />
  );

  if (step === "submitted" && submitted) {
    const isDel = submitted.fulfilment === "delivery";
    return shell(
      <>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: accent }}>
          <Check size={28} color="white" strokeWidth={3} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{submitted.count} items added</h2>
          {submitted.total != null && (
            <p className="text-2xl font-bold mt-1" style={{ color: accent }}>{formatMoney(currency, submitted.total)}</p>
          )}
          <p className="text-sm text-gray-600 mt-1">
            {branches.length > 1 && submitted.branchName ? `🏪 ${submitted.branchName} · ` : ""}
            {isDel ? "🛵 Delivery" : "🏃 Pickup"}
          </p>
        </div>
        <p className="text-sm text-gray-500">
          Your cart has been saved.<br />
          Go back to WhatsApp — your cart summary is waiting there with options to continue or edit.
        </p>
        <button onClick={() => openWhatsAppChat(config?.store_phone)}
          className="w-full py-4 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2"
          style={{ background: accent }}>
          💬 Open WhatsApp
        </button>
        <button onClick={() => setStep("menu")} className="text-sm font-semibold text-gray-500">
          Back to menu
        </button>
      </>
    );
  }

  const bottomBar = (
    <BottomBar
      tab={tab}
      cartCount={cartCount}
      accent={accent}
      onHome={() => {
        setTab("home");
        setStep(homeStep());
      }}
      onCart={openCheckout}
      onOrders={() => setTab("orders")}
    />
  );

  if (tab === "orders") return (
    <div className="min-h-screen" style={{ background: "#f8faf8", paddingBottom: `calc(${BOTTOM_BAR_HEIGHT + 16}px + env(safe-area-inset-bottom))` }}>
      <MyOrders
        projectId={projectId}
        token={token}
        verified={identity.verified}
        currency={currency}
        accent={accent}
        storePhone={config?.store_phone}
        onReorder={startReorder}
      />
      {bottomBar}
      {confirmDialog}
    </div>
  );

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
    const matchSearch = !q || (p.name || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
      || (p.description || "").toLowerCase().includes(q);
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
  const showStatusLine = status?.label && status.can_order && status.label !== "Open now" ? status.label : null;
  const freeDeliveryOffer = offers.some((o) => o.kind === "free_delivery");
  const cartBarBottom = `calc(${BOTTOM_BAR_HEIGHT + 8}px + env(safe-area-inset-bottom))`;

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#f8faf8",
        fontFamily: "system-ui, -apple-system, sans-serif",
        paddingBottom: `calc(${BOTTOM_BAR_HEIGHT + (cartCount > 0 ? 88 : 20)}px + env(safe-area-inset-bottom))`,
      }}
    >
      <ShopHeader
        storeName={config?.store_name}
        coverUrl={config?.cover_image_url}
        logoUrl={config?.logo_url}
        accent={accent}
        branchName={branch?.name}
        showBranch={multi}
        canChangeBranch={canChangeBranch}
        onChangeBranch={() => setStep("branches")}
        statusLine={showStatusLine}
      />
      <OffersStrip offers={offers} accent={accent} onPickCode={setPendingCode} />

      <div className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="px-4 py-2.5">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search dishes, categories..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-100 rounded-xl pl-9 pr-9 py-2.5 text-base outline-none text-gray-700 placeholder-gray-400" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Clear search">
                <X size={15} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
        {categories.length > 1 && (
          <div className="flex gap-2 px-4 pb-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
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
        <ClosedBanner status={status} branchName={branch?.name} />
      </div>

      {pendingBanner && (
        <div className="mx-4 mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-sm font-semibold text-amber-900">
            Payment pending for #{pendingBanner.short_id || ""}
            {pendingBanner.total != null ? ` · ${formatMoney(currency, pendingBanner.total)}` : ""}
          </p>
          <div className="flex gap-2">
            {pendingBanner.payment_url && (
              <button onClick={() => window.location.assign(pendingBanner.payment_url)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: accent }}>
                Pay now
              </button>
            )}
            <button onClick={cancelPendingPayment} disabled={bannerBusy}
              className="flex-1 py-2 rounded-lg text-sm font-semibold border border-amber-300 bg-white text-amber-900 disabled:opacity-60">
              {bannerBusy ? "Cancelling…" : "Cancel & edit cart"}
            </button>
          </div>
        </div>
      )}

      {identity.reason === "expired" && (
        <div className="px-4 py-2 text-center text-xs font-medium" style={{ background: "#fef3c7", color: "#92400e" }}>
          Your link has expired — send <b>menu</b> in WhatsApp to get a fresh one.
        </div>
      )}
      {notEditable && (
        <div className="px-4 py-2 text-center text-xs font-medium" style={{ background: "#fee2e2", color: "#991b1b" }}>
          This order is already being processed — place a new order
        </div>
      )}
      {!effectivePhone && (
        <div className="px-4 py-2 text-center text-xs font-medium" style={{ background: "#fef3c7", color: "#92400e" }}>
          ⚠️ Open this menu from your WhatsApp chat to place an order — you can browse below, but checkout needs WhatsApp.
        </div>
      )}
      {restored && cartCount > 0 && (
        <p className="px-4 pt-3 text-xs font-medium" style={{ color: accent }}>✓ Your previous cart has been restored</p>
      )}

      <div className="px-4 pt-4 space-y-6 max-w-xl mx-auto">
        {menuLoading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-white border border-gray-100 animate-pulse" />)}
          </div>
        )}
        {!menuLoading && Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            {(activeCategory === "All" || Object.keys(grouped).length > 1) && (
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-bold text-gray-900">{category}</h2>
                <span className="text-xs text-gray-400">{items.length} items</span>
                <div className="flex-1 h-px bg-gray-200" />
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

      {cartCount > 0 && !checkoutOpen && (
        <div className="fixed left-0 right-0 px-4 z-30" style={{ bottom: cartBarBottom }}>
          <button onClick={openCheckout}
            className="w-full max-w-xl mx-auto py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-between px-5 shadow-lg"
            style={{ background: canOrder ? accent : "#6b7280" }}>
            <span className="bg-white/20 rounded-lg px-2.5 py-0.5 text-sm font-bold">{cartCount} item{cartCount === 1 ? "" : "s"}</span>
            <span>{canOrder ? formatMoney(currency, localSubtotal) : "Closed"}</span>
            <span className="flex items-center gap-1">View cart <ChevronRight size={16} /></span>
          </button>
        </div>
      )}

      {!checkoutOpen && bottomBar}

      {checkoutOpen && branch && (
        <CheckoutFlow
          projectId={projectId}
          token={token}
          identity={identity}
          effectivePhone={effectivePhone}
          branch={branch}
          status={status}
          currency={currency}
          accent={accent}
          india={india}
          origin={origin}
          canChangeBranch={canChangeBranch}
          items={cartItems}
          cartLines={cartLines}
          catalogId={catalogForSubmit}
          orderId={orderId}
          form={form}
          setForm={setForm}
          checkout={checkout}
          setCheckout={setCheckout}
          pendingCode={pendingCode}
          onPendingCodeUsed={() => setPendingCode(null)}
          freeDeliveryOffer={freeDeliveryOffer}
          onClose={() => setCheckoutOpen(false)}
          onChangeBranch={() => {
            setCheckoutOpen(false);
            setStep("branches");
          }}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onKeepOnly={keepOnly}
          onOrderNotEditable={onOrderNotEditable}
          onVerifiedLost={onVerifiedLost}
          onPlaced={(d) => {
            resetAfterOrder();
            setPlacedResult(d);
            setStep("placed");
          }}
          onConfirmInWhatsApp={(d) => {
            setSubmitted({
              total: d?.totals?.total ?? null,
              count: cartCount,
              branchName: d?.branch_name || branch.name,
              fulfilment: d?.fulfilment || form.fulfilment,
            });
            setCheckoutOpen(false);
            setStep("submitted");
          }}
          onBeforeRedirect={() => writeCheckout(projectId, serializeCheckout(false))}
        />
      )}
      {confirmDialog}
    </div>
  );
}
