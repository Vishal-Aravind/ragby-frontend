"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, Trash2, Loader2, ShoppingBag, Settings,
  Package, ClipboardList, ChevronLeft, Upload,
  ToggleLeft, ToggleRight, Lock, Store, Copy, AlertTriangle, Tag
} from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";
import { toast } from "sonner";
import { uploadMedia } from "@/lib/uploadMedia";
import RazorpayConnectCard from "@/components/RazorpayConnectCard";
import { confirmDialog } from "@/components/confirmDialog";
import BranchesPanel from "./BranchesPanel";
import BranchSelector, { ALL_BRANCHES } from "./BranchSelector";
import CopyMenuDialog from "./CopyMenuDialog";
import OrderCard, { ORDER_STATUSES, normalizeStatus } from "./OrderCard";
import { getOrdersSeenAt, markOrdersSeen } from "@/lib/newOrders";
import OffersPanel from "./OffersPanel";
import BrandingCard from "./BrandingCard";

const TABS = [
  { id: "settings",  label: "Settings",  icon: Settings },
  { id: "branches",  label: "Branches",  icon: Store },
  { id: "catalogs",  label: "Menu",      icon: ShoppingBag },
  { id: "offers",    label: "Offers",    icon: Tag },
  { id: "orders",    label: "Orders",    icon: ClipboardList },
];

const ORDER_FILTERS = [["all", "All"], ...ORDER_STATUSES];

// Per-viewer UI preferences only; every read/write is guarded because
// storage can be blocked (private mode, site data cleared).
function readPref(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writePref(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}

export default function ShopTab({ project }) {
  const projectId = project?.id || project;
  // UI hint only (the backend enforces roles). Admin-only controls are
  // hidden for agents; a missing role falls back to showing them and the
  // server's 403 message explains.
  const myRole = project?.myRole;
  const isAdmin = !myRole || myRole === "owner" || myRole === "admin";
  const branchPrefKey = `zavo_shop_branch_${projectId}`;
  const notifyPrefKey = `zavo_shop_notify_${projectId}`;
  const [activeTab, setActiveTab] = useState("settings");

  // ── Branches ─────────────────────────────────────────
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branchesError, setBranchesError] = useState(null);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [menuBranchId, setMenuBranchId] = useState(null);
  const [orderBranchId, setOrderBranchId] = useState(ALL_BRANCHES);
  const selectionInitRef = useRef(false);
  const [copyTarget, setCopyTarget] = useState(null);

  // ── Settings ─────────────────────────────────────────
  const [config, setConfig] = useState(null);
  // Only a connected Shopify store has an in-chat checkout link to switch on.
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [razorpayConnected, setRazorpayConnected] = useState(false);

  // ── Offers (only "is any offer live?" here, for the terms-note warning;
  // the Offers tab loads and manages the full list itself) ──
  const [hasActiveOffers, setHasActiveOffers] = useState(false);

  // ── Catalogs ──────────────────────────────────────────
  const [catalogs, setCatalogs] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [creatingCatalog, setCreatingCatalog] = useState(false);

  // ── Products ──────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(emptyProductForm());
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // ── Orders ────────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState(null);
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderBusy, setOrderBusy] = useState(null);
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  // ── Delete dialogs ────────────────────────────────────
  const [deleteCatalogOpen, setDeleteCatalogOpen] = useState(false);
  const [catalogToDelete, setCatalogToDelete] = useState(null);
  const [deleteProductOpen, setDeleteProductOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  function emptyProductForm() {
    return {
      name: "", description: "", price: "",
      category: "", gst_percent: "",
      image_url: "", is_available: true, sort_order: "0",
    };
  }

  // ── Load config ───────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/shop-config/${projectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setConfig(data);
        else setConfig({
          store_name: "", gst_percent: 0,
          currency: "₹", accent_color: "#16a34a",
          delivery_types: ["Takeaway"], terms_note: "",
          razorpay_key_id: "", razorpay_key_secret: "", is_enabled: false, bot_can_assist: false, bot_can_order: false,
        });
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/shopify/status/${projectId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setShopifyConnected(!!d?.connected))
      .catch(() => {});
  }, [projectId]);

  // ── Load branches ─────────────────────────────────────
  // The backend creates the default "Main" branch on first read, so every
  // shop has at least one. If this fails (e.g. backend unreachable), Menu
  // and Orders still work unfiltered, as before branches existed.
  const fetchBranches = async ({ silent = false } = {}) => {
    if (!silent) setLoadingBranches(true);
    try {
      const res = await fetch(`/api/shop-branches?project_id=${projectId}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        setBranches(data);
        setBranchesError(null);
      } else {
        setBranchesError(data?.error || "Couldn't load your branches.");
      }
    } catch {
      setBranchesError("Couldn't load your branches. Check your connection and try again.");
    }
    if (!silent) setLoadingBranches(false);
    setBranchesLoaded(true);
  };

  useEffect(() => {
    if (!projectId) return;
    setNotifyCustomer(readPref(notifyPrefKey) !== "0");
    fetchBranches();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/shop-offers?project_id=${projectId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (Array.isArray(data)) setHasActiveOffers(data.some(o => o.state === "active")); })
      .catch(() => { /* warning only; ignore */ });
  }, [projectId]);

  // Pick the Menu / Orders branch once branches arrive (remembered per
  // project), and fall back to the default if the remembered one is gone.
  useEffect(() => {
    if (!branchesLoaded) return;
    const valid = (id) => branches.some(b => b.id === id);
    const fallback = (branches.find(b => b.is_default) || branches[0])?.id || null;
    if (!selectionInitRef.current) {
      selectionInitRef.current = true;
      const stored = readPref(branchPrefKey);
      setMenuBranchId(valid(stored) ? stored : fallback);
      setOrderBranchId(valid(stored) ? stored : ALL_BRANCHES);
      return;
    }
    setMenuBranchId(prev => (valid(prev) ? prev : fallback));
    setOrderBranchId(prev => (prev === ALL_BRANCHES || valid(prev) ? prev : ALL_BRANCHES));
  }, [branchesLoaded, branches]);

  const pickMenuBranch = (id) => {
    setMenuBranchId(id);
    writePref(branchPrefKey, id);
    setSelectedCatalog(null);
    setShowProductForm(false);
    setEditingProduct(null);
  };
  const pickOrderBranch = (id) => {
    setOrderBranchId(id);
    writePref(branchPrefKey, id);
  };

  const multiBranch = branches.length > 1;
  const menuBranch = branches.find(b => b.id === menuBranchId) || null;
  const orderBranchFilter = multiBranch && orderBranchId !== ALL_BRANCHES ? orderBranchId : null;
  const branchNameById = Object.fromEntries(branches.map(b => [b.id, b.name]));
  const defaultTimezone = (branches.find(b => b.is_default) || branches[0])?.timezone || "Asia/Kolkata";
  const deliveryNotReady = branches.filter(b => (b.warnings || []).includes("delivery_not_configured"));

  // ── Load catalogs ─────────────────────────────────────
  // Request counter: switching branches quickly must not let an older,
  // slower response overwrite the newer branch's list.
  const catalogReqRef = useRef(0);
  const fetchCatalogs = async () => {
    const reqId = ++catalogReqRef.current;
    setLoadingCatalogs(true);
    const q = menuBranchId ? `&branch_id=${menuBranchId}` : "";
    try {
      const res = await fetch(`/api/catalogs?project_id=${projectId}${q}`);
      if (reqId !== catalogReqRef.current) return;
      if (res.ok) setCatalogs(await res.json() || []);
    } catch {
      if (reqId === catalogReqRef.current) toast.error("Couldn't load the menu.");
    }
    if (reqId === catalogReqRef.current) setLoadingCatalogs(false);
  };

  useEffect(() => {
    if (projectId && branchesLoaded) fetchCatalogs();
  }, [projectId, branchesLoaded, menuBranchId]);

  // ── Load products for selected catalog ───────────────
  const fetchProducts = async (catalogId) => {
    setLoadingProducts(true);
    const res = await fetch(`/api/products?project_id=${projectId}&catalog_id=${catalogId}`);
    if (res.ok) setProducts(await res.json() || []);
    setLoadingProducts(false);
  };

  useEffect(() => {
    if (selectedCatalog) fetchProducts(selectedCatalog.id);
  }, [selectedCatalog]);

  // ── Load orders ───────────────────────────────────────
  const orderReqRef = useRef(0);
  const fetchOrders = async () => {
    const reqId = ++orderReqRef.current;
    setLoadingOrders(true);
    const q = orderBranchFilter ? `&branch_id=${orderBranchFilter}` : "";
    try {
      const res = await fetch(`/api/orders?project_id=${projectId}${q}`);
      if (reqId !== orderReqRef.current) return;
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        setOrders(data);
        setOrdersError(null);
      } else {
        setOrdersError(data?.error || "Couldn't load orders.");
      }
    } catch {
      if (reqId === orderReqRef.current) setOrdersError("Couldn't load orders. Check your connection and try again.");
    }
    if (reqId === orderReqRef.current) setLoadingOrders(false);
  };

  useEffect(() => {
    if (projectId && activeTab === "orders" && branchesLoaded) fetchOrders();
  }, [projectId, activeTab, branchesLoaded, orderBranchFilter]);

  // Opening Orders clears the dashboard bell. The previous marker is kept for
  // this visit so the orders that arrived since then are tagged NEW.
  const [ordersSeenBefore, setOrdersSeenBefore] = useState(null);
  useEffect(() => {
    if (!projectId || activeTab !== "orders") return;
    setOrdersSeenBefore(prev => prev || getOrdersSeenAt(projectId));
    markOrdersSeen(projectId);
  }, [projectId, activeTab]);
  const isNewOrder = (o) => {
    if (!ordersSeenBefore || ["pending", "cancelled"].includes(o.status)) return false;
    return new Date(o.placed_at || o.created_at).getTime() > new Date(ordersSeenBefore).getTime();
  };

  // ── Save config ───────────────────────────────────────
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    const res = await fetch(`/api/shop-config/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    }
    setSavingConfig(false);
  };

  // ── Create catalog ────────────────────────────────────
  const handleCreateCatalog = async () => {
    if (!newCatalogName.trim()) return;
    setCreatingCatalog(true);
    const res = await fetch("/api/catalogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        name: newCatalogName.trim(),
        ...(menuBranchId ? { branch_id: menuBranchId } : {}),
      }),
    });
    if (res.ok) {
      setNewCatalogName("");
      await fetchCatalogs();
      fetchBranches({ silent: true }); // catalog counts / "no menu" warning
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Couldn't create the catalog.");
    }
    setCreatingCatalog(false);
  };

  // ── Toggle catalog active ─────────────────────────────
  const handleToggleCatalog = async (catalog) => {
    await fetch(`/api/catalogs/${catalog.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !catalog.is_active }),
    });
    await fetchCatalogs();
    if (selectedCatalog?.id === catalog.id) {
      setSelectedCatalog(c => ({ ...c, is_active: !c.is_active }));
    }
  };

  // ── Delete catalog ────────────────────────────────────
  const confirmDeleteCatalog = async () => {
    await fetch(`/api/catalogs/${catalogToDelete.id}`, { method: "DELETE" });
    if (selectedCatalog?.id === catalogToDelete.id) setSelectedCatalog(null);
    setCatalogToDelete(null);
    setDeleteCatalogOpen(false);
    await fetchCatalogs();
    fetchBranches({ silent: true });
  };

  // ── Save product ──────────────────────────────────────
  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.price) return;
    setSavingProduct(true);
    const payload = {
      ...productForm,
      project_id: projectId,
      catalog_id: selectedCatalog.id,
      price: parseFloat(productForm.price),
      gst_percent: String(productForm.gst_percent ?? "").trim() === "" ? null : parseFloat(productForm.gst_percent),
      sort_order: parseInt(productForm.sort_order || 0),
    };

    if (editingProduct) {
      await fetch(`/api/products/${editingProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setShowProductForm(false);
    setEditingProduct(null);
    setProductForm(emptyProductForm());
    setSavingProduct(false);
    await fetchProducts(selectedCatalog.id);
  };

  // ── Delete product ────────────────────────────────────
  const confirmDeleteProduct = async () => {
    await fetch(`/api/products/${productToDelete.id}`, { method: "DELETE" });
    setProductToDelete(null);
    setDeleteProductOpen(false);
    await fetchProducts(selectedCatalog.id);
  };

  // ── Upload product image ──────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const { url, error } = await uploadMedia(file, "products");
    if (url) setProductForm(f => ({ ...f, image_url: url }));
    else toast.error(error);
    setUploadingImage(false);
    e.target.value = "";
  };

  // ── Update order status ───────────────────────────────
  // Goes through the backend, which checks the move is allowed and (when
  // notify is on) sends the customer a WhatsApp update. Cancelling asks
  // first, then asks whether to message the customer, the same as
  // cancelling an event registration.
  const STATUS_LABELS = Object.fromEntries(ORDER_STATUSES);
  const handleOrderAction = async (order, status) => {
    const oid = String(order.id).slice(0, 8).toUpperCase();
    let notify = notifyCustomer;
    if (status === "cancelled") {
      if (!(await confirmDialog({
        title: `Cancel order #${oid}?`,
        description: "This cannot be undone. If the customer already paid, refund them in Razorpay.",
        confirmText: "Cancel order", cancelText: "Keep it",
      }))) return;
      notify = await confirmDialog({
        title: "Send a WhatsApp message?",
        description: `Tell ${order.phone_number ? "+" + order.phone_number : "the customer"} on WhatsApp that their order is cancelled?\n\n` +
          'Note: this needs your WhatsApp account connected in Integrations, and the "Order Cancelled" template ' +
          "added and approved in Templates. Without an approved template, the message only reaches people who messaged you in the last 24 hours.",
        confirmText: "Yes, send", cancelText: "No, don't send",
      });
    }

    setOrderBusy(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notify }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't update the order.");
        if (res.status === 409) fetchOrders(); // someone else may have moved it
        return;
      }
      const { notification, ...row } = data || {};
      setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, ...row } : o)));

      const done = `Order #${oid}: ${STATUS_LABELS[status] || status}`;
      if (!notify || !notification) {
        toast.success(done);
      } else if (notification === "template") {
        toast.success(done, { description: "Customer notified on WhatsApp" });
      } else if (notification === "text") {
        toast.success(done, { description: "Sent (24-hour window only). Add the order templates so updates reach every customer." });
      } else if (notification === "skipped") {
        toast.success(done, { description: "WhatsApp isn't connected, so the customer wasn't notified." });
      } else {
        toast.warning(done, { description: "The WhatsApp message to the customer couldn't be sent." });
      }
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setOrderBusy(null);
    }
  };

  const toggleNotify = (on) => {
    setNotifyCustomer(on);
    writePref(notifyPrefKey, on ? "1" : "0");
  };

  const filteredOrders = orderFilter === "all"
    ? orders
    : orders.filter(o => normalizeStatus(o.status) === orderFilter);

  // Products synced from a connected Shopify store — name/description/price/
  // image/availability are overwritten on every sync (see
  // backend/sources/shopify.py's field-ownership split), so editing them
  // here would just get silently clobbered next sync. Category/GST%/sort
  // order stay merchant-owned and editable either way.
  const isShopifyManaged = !!(editingProduct && editingProduct.shopify_product_id);

  if (!config) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 size={20} className="animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Sub tab bar ── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}>
              <Icon size={14} />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Delivery is switched on somewhere but has no area, so customers
          silently only get pickup (e.g. shops migrated from "Home Delivery"). */}
      {deliveryNotReady.length > 0 && activeTab !== "branches" && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0" />
          <p className="flex-1 min-w-0">
            Delivery is on for <strong>{deliveryNotReady.map(b => b.name).join(", ")}</strong> but no delivery area is set,
            so customers can only pick up. Add a map location and a max distance or pincodes.
          </p>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setActiveTab("branches")}>Set up delivery</Button>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          BRANCHES TAB
      ════════════════════════════════════════ */}
      {activeTab === "branches" && (
        <BranchesPanel
          projectId={projectId}
          branches={branches}
          loading={loadingBranches}
          error={branchesError}
          isAdmin={isAdmin}
          currency={config.currency || "₹"}
          defaultTimezone={defaultTimezone}
          onRefresh={() => fetchBranches({ silent: true })}
          onCopyMenu={setCopyTarget}
        />
      )}

      {/* ════════════════════════════════════════
          OFFERS TAB
      ════════════════════════════════════════ */}
      {activeTab === "offers" && (
        <OffersPanel
          projectId={projectId}
          branches={branches}
          isAdmin={isAdmin}
          currency={config.currency || "₹"}
          defaultTimezone={defaultTimezone}
          onOffersChange={(list) => setHasActiveOffers(list.some(o => o.state === "active"))}
        />
      )}

      {/* ════════════════════════════════════════
          SETTINGS TAB
      ════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Shop enabled — master switch for every branch, so it sits on top */}
          <Card className="md:col-span-2">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Shop is {config.is_enabled ? "ON" : "OFF"}
                </p>
                <p className="text-xs text-gray-400">
                  {config.is_enabled
                    ? "Customers can browse and order at every branch"
                    : "Customers can't browse or order at any branch. Existing orders still get updates."}
                </p>
              </div>
              <button onClick={() => setConfig(c => ({ ...c, is_enabled: !c.is_enabled }))}>
                {config.is_enabled
                  ? <ToggleRight size={28} className="text-green-600" />
                  : <ToggleLeft size={28} className="text-gray-400" />}
              </button>
            </CardContent>
          </Card>

          {/* Store Info */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Store Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Store Name</label>
                  <Input placeholder="e.g. Geetham Veg Velachery"
                    value={config.store_name || ""}
                    onChange={e => setConfig(c => ({ ...c, store_name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Currency Symbol</label>
                    <Input placeholder="₹"
                      value={config.currency || "₹"}
                      onChange={e => setConfig(c => ({ ...c, currency: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">GST % (shop rate)</label>
                    <Input type="number" min="0" max="100" step="any" placeholder="5"
                      value={config.gst_percent ?? 0}
                      onChange={e => setConfig(c => ({ ...c, gst_percent: parseFloat(e.target.value) || 0 }))} />
                    <p className="text-[11px] text-gray-400 mt-1">Used for items without their own GST %. Prices are entered without GST - it is added at checkout.</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Currency Code (for payments)</label>
                  <Input placeholder="INR" maxLength={3}
                    value={config.currency_code || "INR"}
                    onChange={e => setConfig(c => ({ ...c, currency_code: e.target.value.toUpperCase() }))} />
                  <p className="text-xs text-gray-400 mt-1">
                    The real currency code (e.g. INR, USD) Razorpay actually charges in — separate from the ₹/$ symbol above.
                    Auto-filled from your Shopify store's currency if you connect one before setting up Shop.
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  Pickup, delivery, phone numbers and new-order WhatsApp alerts are set per branch, in the{" "}
                  <button type="button" onClick={() => setActiveTab("branches")} className="underline hover:text-gray-600">Branches</button> tab.
                </p>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Terms & Conditions Note</label>
                  <Input placeholder="This order is not eligible for any discounts. T&C apply."
                    value={config.terms_note || ""}
                    onChange={e => setConfig(c => ({ ...c, terms_note: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Payment (Razorpay)</h3>
              </div>
              <RazorpayConnectCard
                projectId={projectId}
                compact
                onStatusChange={setRazorpayConnected}
              />
              {!razorpayConnected && (config.razorpay_key_id || config.razorpay_key_secret) && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  You're still using an older manual API key setup — connect with Razorpay above to switch to the
                  new, more secure OAuth connection. Your existing setup keeps working until you do.
                </p>
              )}
              {!razorpayConnected && !(config.razorpay_key_id || config.razorpay_key_secret) && (
                <p className="text-xs text-gray-400">
                  ⚠️ Connect Razorpay to collect payment — orders will be confirmed without collecting payment until then.
                </p>
              )}

              {/* Let the AI bot check orders / browse catalog in chat */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-sm font-medium text-gray-700">Let the AI assist in chat</p>
                  <p className="text-xs text-gray-400">Bot can check order status and answer product questions directly in conversation</p>
                </div>
                <button onClick={() => setConfig(c => {
                  const next = !c.bot_can_assist
                  return { ...c, bot_can_assist: next, bot_can_order: next ? c.bot_can_order : false }
                })}>
                  {config.bot_can_assist
                    ? <ToggleRight size={28} className="text-green-600" />
                    : <ToggleLeft size={28} className="text-gray-400" />}
                </button>
              </div>

              {/* Shopify stores only: the chat on the Shopify site can hand over a Shopify checkout link */}
              {shopifyConnected && (
                <div className={`flex items-center justify-between pt-2 border-t ${!config.bot_can_assist ? 'opacity-40' : ''}`}>
                  <div className="pr-4">
                    <p className="text-sm font-medium text-gray-700">Let the AI create Shopify checkout links</p>
                    <p className="text-xs text-gray-400">On your Shopify store's chat, the AI can build a cart from what the customer says and give them a Shopify checkout link to pay</p>
                  </div>
                  <button
                    disabled={!config.bot_can_assist}
                    onClick={() => setConfig(c => ({ ...c, bot_can_order: !c.bot_can_order }))}>
                    {config.bot_can_order
                      ? <ToggleRight size={28} className="text-green-600" />
                      : <ToggleLeft size={28} className="text-gray-400" />}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <BrandingCard
            projectId={projectId}
            config={config}
            isAdmin={isAdmin}
            hasActiveOffers={hasActiveOffers}
            onBrandingSaved={(b) => setConfig(c => ({ ...c, ...b }))}
          />

          {/* Save button */}
          <div className="md:col-span-2">
            <Button onClick={handleSaveConfig} disabled={savingConfig} className="w-full md:w-auto">
              {savingConfig ? <><Loader2 size={14} className="animate-spin mr-2" />Saving...</> : "Save Settings"}
            </Button>
            {configSaved && <span className="ml-3 text-sm text-green-600 font-medium">✓ Saved</span>}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          CATALOGS TAB
      ════════════════════════════════════════ */}
      {activeTab === "catalogs" && (
        <>
          {/* Catalog editor view */}
          {selectedCatalog ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setSelectedCatalog(null); setShowProductForm(false); setEditingProduct(null); }}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
                    <ChevronLeft size={16} /> {multiBranch && menuBranch ? `Menu · ${menuBranch.name}` : "Menu"}
                  </button>
                  <span className="text-gray-300">/</span>
                  <span className="font-semibold text-gray-900">{selectedCatalog.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    selectedCatalog.is_active
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}>
                    {selectedCatalog.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleToggleCatalog(selectedCatalog)}>
                    {selectedCatalog.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" onClick={() => { setShowProductForm(true); setEditingProduct(null); setProductForm(emptyProductForm()); }}>
                    <Plus size={13} className="mr-1" /> Add Product
                  </Button>
                </div>
              </div>

              {/* Product form */}
              {showProductForm && (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-semibold text-gray-900">
                      {editingProduct ? "Edit Product" : "Add Product"}
                    </h3>
                    {isShopifyManaged && (
                      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        <Lock size={13} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-700">
                          Name, description, price, image, and availability are managed by Shopify —
                          edit them in your Shopify admin and they'll sync here automatically.
                          Category, GST %, and sort order are yours to set.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Product Name *</label>
                          <Input placeholder="e.g. Ghee Pongal" disabled={isShopifyManaged}
                            value={productForm.name}
                            onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Description</label>
                          <Input placeholder="Short description (optional)" disabled={isShopifyManaged}
                            value={productForm.description}
                            onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Price *</label>
                            <Input type="number" min="0" placeholder="115" disabled={isShopifyManaged}
                              value={productForm.price}
                              onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">GST %</label>
                            <Input type="number" min="0" max="100" step="any"
                              placeholder={config?.gst_percent != null ? `Shop rate (${config.gst_percent}%)` : "Shop rate"}
                              value={productForm.gst_percent}
                              onChange={e => setProductForm(f => ({ ...f, gst_percent: e.target.value }))} />
                            <p className="text-[11px] text-gray-400 mt-1">Leave empty to use the shop rate. Type 0 for no GST on this item.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Category</label>
                            <Input placeholder="e.g. Breakfast"
                              value={productForm.category}
                              onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Sort Order</label>
                            <Input type="number" min="0" placeholder="0"
                              value={productForm.sort_order}
                              onChange={e => setProductForm(f => ({ ...f, sort_order: e.target.value }))} />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-gray-700">Available</label>
                          <button disabled={isShopifyManaged}
                            onClick={() => setProductForm(f => ({ ...f, is_available: !f.is_available }))}
                            className={isShopifyManaged ? "opacity-40 cursor-not-allowed" : ""}>
                            {productForm.is_available
                              ? <ToggleRight size={24} className="text-green-600" />
                              : <ToggleLeft size={24} className="text-gray-400" />}
                          </button>
                        </div>
                      </div>

                      {/* Image upload */}
                      <div className="space-y-3">
                        <label className="text-xs text-gray-500 mb-1 block">Product Image</label>
                        {productForm.image_url ? (
                          <div className="relative">
                            <img src={productForm.image_url} alt="product"
                              className="w-full h-40 object-cover rounded-lg border" />
                            {!isShopifyManaged && (
                              <button onClick={() => setProductForm(f => ({ ...f, image_url: "" }))}
                                className="absolute top-2 right-2 bg-white border rounded-full p-1 shadow-sm hover:bg-red-50">
                                <Trash2 size={12} className="text-red-500" />
                              </button>
                            )}
                          </div>
                        ) : isShopifyManaged ? (
                          <div className="flex items-center justify-center w-full h-40 border-2 border-dashed rounded-lg text-xs text-gray-400">
                            No image set in Shopify
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            {uploadingImage
                              ? <Loader2 size={20} className="animate-spin text-gray-400" />
                              : <>
                                  <Upload size={20} className="text-gray-300 mb-2" />
                                  <p className="text-xs text-gray-400">Click to upload image</p>
                                  <p className="text-xs text-gray-300">JPG, PNG, WEBP · Max 5MB</p>
                                </>
                            }
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                          </label>
                        )}
                        {!isShopifyManaged && (
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">Or paste image URL</label>
                            <Input placeholder="https://..."
                              value={productForm.image_url}
                              onChange={e => setProductForm(f => ({ ...f, image_url: e.target.value }))} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button onClick={handleSaveProduct} disabled={savingProduct || !productForm.name || !productForm.price}>
                        {savingProduct ? <><Loader2 size={13} className="animate-spin mr-1" />Saving...</> : editingProduct ? "Update Product" : "Add Product"}
                      </Button>
                      <Button variant="outline" onClick={() => { setShowProductForm(false); setEditingProduct(null); setProductForm(emptyProductForm()); }}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Products list */}
              {loadingProducts ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                </div>
              ) : products.length === 0 ? (
                <div className="border-2 border-dashed rounded-xl p-12 text-center">
                  <Package size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No products yet</p>
                  <p className="text-xs text-gray-300 mt-1">Click "Add Product" to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {products.map(product => (
                    <div key={product.id}
                      className="flex items-center gap-3 border rounded-xl px-4 py-3 bg-white hover:border-gray-300 transition-colors">
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded-lg shrink-0" />
                        : <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                            <Package size={16} className="text-gray-400" />
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                          {product.name}
                          {product.shopify_product_id && (
                            <span title="Synced from Shopify"><Lock size={11} className="text-gray-300" /></span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">{product.category} · {config.currency || "₹"}{product.price}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          product.is_available
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}>
                          {product.is_available ? "Available" : "Unavailable"}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingProduct(product);
                          setProductForm({
                            name: product.name,
                            description: product.description || "",
                            price: product.price,
                            category: product.category || "",
                            gst_percent: product.gst_percent == null ? "" : String(product.gst_percent),
                            image_url: product.image_url || "",
                            is_available: product.is_available,
                            sort_order: product.sort_order || 0,
                          });
                          setShowProductForm(true);
                        }}>
                          ✏️
                        </Button>
                        {product.shopify_product_id ? (
                          <span title="Remove it in Shopify instead — deleting here would just be re-added on the next sync">
                            <Button variant="ghost" size="sm" disabled className="text-gray-300 cursor-not-allowed">
                              <Trash2 size={13} />
                            </Button>
                          </span>
                        ) : (
                          <Button variant="ghost" size="sm"
                            onClick={() => { setProductToDelete(product); setDeleteProductOpen(true); }}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Catalog list view */
            <div className="space-y-4">
              {/* Branch picker + copy */}
              {multiBranch && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Menu for</span>
                    <BranchSelector branches={branches} value={menuBranchId} onChange={pickMenuBranch} />
                  </div>
                  {isAdmin && menuBranch && (
                    <Button variant="outline" size="sm" onClick={() => setCopyTarget(menuBranch)}>
                      <Copy size={13} className="mr-1" /> Copy menu from another branch
                    </Button>
                  )}
                </div>
              )}

              {/* Create catalog */}
              <div className="flex gap-2">
                <Input placeholder="Catalog name e.g. Breakfast Menu"
                  value={newCatalogName}
                  onChange={e => setNewCatalogName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreateCatalog()} />
                <Button onClick={handleCreateCatalog} disabled={creatingCatalog || !newCatalogName.trim()}>
                  {creatingCatalog ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Create
                </Button>
              </div>

              {loadingCatalogs ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                </div>
              ) : catalogs.length === 0 ? (
                <div className="border-2 border-dashed rounded-xl p-12 text-center">
                  <ShoppingBag size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">
                    {multiBranch && menuBranch ? `No catalogs in ${menuBranch.name} yet` : "No catalogs yet"}
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    Create a catalog to start adding products{multiBranch && isAdmin ? ", or copy the menu from another branch" : ""}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {catalogs.map(catalog => (
                    <div key={catalog.id}
                      className="border rounded-xl p-4 bg-white hover:border-gray-300 cursor-pointer transition-colors"
                      onClick={() => setSelectedCatalog(catalog)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <ShoppingBag size={16} className="text-gray-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                              {catalog.name}
                              {catalog.source === "shopify" && (
                                <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                  <Lock size={9} /> Synced
                                </span>
                              )}
                            </p>
                            {catalog.description && (
                              <p className="text-xs text-gray-400">{catalog.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            catalog.is_active
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-gray-50 text-gray-400 border-gray-200"
                          }`}>
                            {catalog.is_active ? "Active" : "Inactive"}
                          </span>
                          {catalog.source !== "shopify" && (
                            <Button variant="ghost" size="sm"
                              onClick={() => { setCatalogToDelete(catalog); setDeleteCatalogOpen(true); }}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════
          ORDERS TAB
      ════════════════════════════════════════ */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Branch + notify preference */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {multiBranch ? (
              <BranchSelector branches={branches} value={orderBranchId} onChange={pickOrderBranch} allowAll />
            ) : <span />}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={notifyCustomer} onChange={e => toggleNotify(e.target.checked)} />
              Notify customer on WhatsApp
            </label>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            Add the &quot;Order Status Update&quot; and &quot;Order Cancelled&quot; templates in{" "}
            <a href={`/dashboard/${projectId}/templates`} className="underline font-medium hover:text-gray-600">Templates</a>{" "}
            so updates reach every customer. Without them, messages only reach people who messaged you in the last 24 hours.
          </p>

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {ORDER_FILTERS.map(([f, label]) => (
              <button key={f} onClick={() => setOrderFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  orderFilter === f
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                }`}>
                {label}
                {f === "all" ? ` (${orders.length})` : ` (${orders.filter(o => normalizeStatus(o.status) === f).length})`}
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={fetchOrders} className="ml-auto">
              Refresh
            </Button>
          </div>

          {loadingOrders ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 size={18} className="animate-spin text-gray-400" />
            </div>
          ) : ordersError ? (
            <div className="text-center py-10 border border-red-200 bg-red-50 rounded-xl text-sm">
              <p className="text-red-700 font-medium">{ordersError}</p>
              <button onClick={fetchOrders} className="mt-2 text-xs underline text-gray-500">Try again</button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="border-2 border-dashed rounded-xl p-12 text-center">
              <ClipboardList size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">
                {orders.length === 0 ? "No orders yet" : "No orders with this status"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  currency={config.currency || "₹"}
                  branchName={multiBranch && !orderBranchFilter ? branchNameById[order.branch_id] : null}
                  busy={orderBusy === order.id}
                  onAction={handleOrderAction}
                  isNew={isNewOrder(order)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <CopyMenuDialog
        open={!!copyTarget}
        target={copyTarget}
        branches={branches}
        onClose={() => setCopyTarget(null)}
        onCopied={() => {
          fetchBranches({ silent: true });
          if (copyTarget?.id === menuBranchId) fetchCatalogs();
        }}
      />

      {/* Delete dialogs */}
      <AppAlertDialog
        open={deleteCatalogOpen}
        title="Delete catalog?"
        description={<>Catalog <strong>{catalogToDelete?.name}</strong> and all its products will be permanently deleted.</>}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteCatalog}
        onCancel={() => { setDeleteCatalogOpen(false); setCatalogToDelete(null); }}
      />
      <AppAlertDialog
        open={deleteProductOpen}
        title="Delete product?"
        description={<><strong>{productToDelete?.name}</strong> will be permanently deleted.</>}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteProduct}
        onCancel={() => { setDeleteProductOpen(false); setProductToDelete(null); }}
      />
    </div>
  );
}