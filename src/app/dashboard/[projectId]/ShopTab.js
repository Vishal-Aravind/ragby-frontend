"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, Trash2, Loader2, ShoppingBag, Settings,
  Package, ClipboardList, ChevronLeft, Upload,
  ToggleLeft, ToggleRight, Eye, EyeOff
} from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";

const TABS = [
  { id: "settings",  label: "Settings",  icon: Settings },
  { id: "catalogs",  label: "Catalogs",  icon: ShoppingBag },
  { id: "orders",    label: "Orders",    icon: ClipboardList },
];

const ORDER_STATUS_COLORS = {
  pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  ready:     "bg-purple-100 text-purple-700 border-purple-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const PAYMENT_STATUS_COLORS = {
  unpaid:    "bg-gray-100 text-gray-600 border-gray-200",
  link_sent: "bg-orange-100 text-orange-700 border-orange-200",
  paid:      "bg-green-100 text-green-700 border-green-200",
};

export default function ShopTab({ project }) {
  const projectId = project?.id || project;
  const [activeTab, setActiveTab] = useState("settings");

  // ── Settings ─────────────────────────────────────────
  const [config, setConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

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
  const [orderFilter, setOrderFilter] = useState("all");

  // ── Delete dialogs ────────────────────────────────────
  const [deleteCatalogOpen, setDeleteCatalogOpen] = useState(false);
  const [catalogToDelete, setCatalogToDelete] = useState(null);
  const [deleteProductOpen, setDeleteProductOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  function emptyProductForm() {
    return {
      name: "", description: "", price: "",
      category: "", gst_percent: "0",
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
          store_name: "", store_phone: "", gst_percent: 0,
          currency: "₹", accent_color: "#16a34a",
          delivery_types: ["Takeaway"], terms_note: "",
          razorpay_key_id: "", razorpay_key_secret: "", is_enabled: false,
        });
      });
  }, [projectId]);

  // ── Load catalogs ─────────────────────────────────────
  const fetchCatalogs = async () => {
    setLoadingCatalogs(true);
    const res = await fetch(`/api/catalogs?project_id=${projectId}`);
    if (res.ok) setCatalogs(await res.json() || []);
    setLoadingCatalogs(false);
  };

  useEffect(() => { if (projectId) fetchCatalogs(); }, [projectId]);

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
  const fetchOrders = async () => {
    setLoadingOrders(true);
    const res = await fetch(`/api/orders?project_id=${projectId}`);
    if (res.ok) setOrders(await res.json() || []);
    setLoadingOrders(false);
  };

  useEffect(() => { if (projectId && activeTab === "orders") fetchOrders(); }, [projectId, activeTab]);

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
      body: JSON.stringify({ project_id: projectId, name: newCatalogName.trim() }),
    });
    if (res.ok) {
      setNewCatalogName("");
      await fetchCatalogs();
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
      gst_percent: parseFloat(productForm.gst_percent || 0),
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
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", "flow-media");
    formData.append("folder", "products");
    const res = await fetch("/api/storage/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      setProductForm(f => ({ ...f, image_url: url }));
    }
    setUploadingImage(false);
    e.target.value = "";
  };

  // ── Update order status ───────────────────────────────
  const handleUpdateOrder = async (orderId, update) => {
    await fetch(`/api/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    await fetchOrders();
  };

  const filteredOrders = orderFilter === "all"
    ? orders
    : orders.filter(o => o.status === orderFilter);

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

      {/* ════════════════════════════════════════
          SETTINGS TAB
      ════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

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
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Store Phone (for customer contact & owner notifications)</label>
                  <Input placeholder="+91 98765 43210"
                    value={config.store_phone || ""}
                    onChange={e => setConfig(c => ({ ...c, store_phone: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Currency</label>
                    <Input placeholder="₹"
                      value={config.currency || "₹"}
                      onChange={e => setConfig(c => ({ ...c, currency: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">GST %</label>
                    <Input type="number" min="0" max="100" placeholder="5"
                      value={config.gst_percent ?? 0}
                      onChange={e => setConfig(c => ({ ...c, gst_percent: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Delivery Types (comma separated)</label>
                  <Input placeholder="Takeaway, Home Delivery"
                    value={(config.delivery_types || []).join(", ")}
                    onChange={e => setConfig(c => ({
                      ...c,
                      delivery_types: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                    }))} />
                </div>
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
                <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline">Get API keys →</a>
              </div>
              <p className="text-xs text-gray-400">
                Your customers pay directly into your Razorpay account. We never touch the money.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Key ID (rzp_live_...)</label>
                  <Input placeholder="rzp_live_xxxxxxxxxx"
                    value={config.razorpay_key_id || ""}
                    onChange={e => setConfig(c => ({ ...c, razorpay_key_id: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Key Secret</label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      placeholder="••••••••••••••••"
                      value={config.razorpay_key_secret || ""}
                      onChange={e => setConfig(c => ({ ...c, razorpay_key_secret: e.target.value }))}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowSecret(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  ⚠️ Leave empty to skip payment — orders will be confirmed without collecting payment.
                </p>
              </div>

              {/* Shop enabled toggle */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-sm font-medium text-gray-700">Shop Enabled</p>
                  <p className="text-xs text-gray-400">Allow customers to browse and order</p>
                </div>
                <button onClick={() => setConfig(c => ({ ...c, is_enabled: !c.is_enabled }))}>
                  {config.is_enabled
                    ? <ToggleRight size={28} className="text-green-600" />
                    : <ToggleLeft size={28} className="text-gray-400" />}
                </button>
              </div>
            </CardContent>
          </Card>

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
                    <ChevronLeft size={16} /> Catalogs
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Product Name *</label>
                          <Input placeholder="e.g. Ghee Pongal"
                            value={productForm.name}
                            onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Description</label>
                          <Input placeholder="Short description (optional)"
                            value={productForm.description}
                            onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Price *</label>
                            <Input type="number" min="0" placeholder="115"
                              value={productForm.price}
                              onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">GST %</label>
                            <Input type="number" min="0" placeholder="5"
                              value={productForm.gst_percent}
                              onChange={e => setProductForm(f => ({ ...f, gst_percent: e.target.value }))} />
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
                          <button onClick={() => setProductForm(f => ({ ...f, is_available: !f.is_available }))}>
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
                            <button onClick={() => setProductForm(f => ({ ...f, image_url: "" }))}
                              className="absolute top-2 right-2 bg-white border rounded-full p-1 shadow-sm hover:bg-red-50">
                              <Trash2 size={12} className="text-red-500" />
                            </button>
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
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Or paste image URL</label>
                          <Input placeholder="https://..."
                            value={productForm.image_url}
                            onChange={e => setProductForm(f => ({ ...f, image_url: e.target.value }))} />
                        </div>
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
                        <p className="font-medium text-gray-900 text-sm">{product.name}</p>
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
                            gst_percent: product.gst_percent || 0,
                            image_url: product.image_url || "",
                            is_available: product.is_available,
                            sort_order: product.sort_order || 0,
                          });
                          setShowProductForm(true);
                        }}>
                          ✏️
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => { setProductToDelete(product); setDeleteProductOpen(true); }}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Catalog list view */
            <div className="space-y-4">
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
                  <p className="text-sm text-gray-400">No catalogs yet</p>
                  <p className="text-xs text-gray-300 mt-1">Create a catalog to start adding products</p>
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
                            <p className="font-semibold text-gray-900 text-sm">{catalog.name}</p>
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
                          <Button variant="ghost" size="sm"
                            onClick={() => { setCatalogToDelete(catalog); setDeleteCatalogOpen(true); }}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 size={13} />
                          </Button>
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
          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "confirmed", "ready", "delivered", "cancelled"].map(f => (
              <button key={f} onClick={() => setOrderFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  orderFilter === f
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                }`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === "all" ? ` (${orders.length})` : ` (${orders.filter(o => o.status === f).length})`}
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
          ) : filteredOrders.length === 0 ? (
            <div className="border-2 border-dashed rounded-xl p-12 text-center">
              <ClipboardList size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map(order => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Order header */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-mono text-xs font-semibold text-gray-600">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ORDER_STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            {order.status}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PAYMENT_STATUS_COLORS[order.payment_status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            {order.payment_status === "paid" ? "✓ Paid" : order.payment_status === "link_sent" ? "Link Sent" : "Unpaid"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(order.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {/* Items */}
                        <div className="text-sm text-gray-700 mb-1">
                          {(order.items || []).map((item, i) => (
                            <span key={i}>
                              {item.name} x{item.quantity}
                              {i < order.items.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          <span>📞 +{order.phone_number}</span>
                          <span>🏃 {order.delivery_type}</span>
                          <span className="font-semibold text-gray-700">
                            {config.currency || "₹"}{order.total?.toFixed(2)}
                          </span>
                          {order.special_request && (
                            <span className="text-orange-600">📝 {order.special_request}</span>
                          )}
                        </div>
                      </div>

                      {/* Status actions */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {order.status === "pending" && (
                          <Button size="sm" onClick={() => handleUpdateOrder(order.id, { status: "confirmed" })}>
                            Confirm
                          </Button>
                        )}
                        {order.status === "confirmed" && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateOrder(order.id, { status: "ready" })}>
                            Mark Ready
                          </Button>
                        )}
                        {order.status === "ready" && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateOrder(order.id, { status: "delivered" })}>
                            Delivered
                          </Button>
                        )}
                        {!["delivered", "cancelled"].includes(order.status) && (
                          <Button size="sm" variant="ghost"
                            onClick={() => handleUpdateOrder(order.id, { status: "cancelled" })}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs">
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

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