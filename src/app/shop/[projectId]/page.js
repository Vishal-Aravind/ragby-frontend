"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ShoppingCart, Search, X, Plus, Minus, ChevronRight, Check } from "lucide-react";

export default function ShopPage() {
  const { projectId } = useParams();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const catalogId = searchParams.get("catalog") || "";

  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [deliveryType, setDeliveryType] = useState("");
  const [deliverySelected, setDeliverySelected] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const [configRes, productsRes] = await Promise.all([
          fetch(`/api/public/shop/${projectId}?type=config`),
          fetch(`/api/public/shop/${projectId}?type=products${catalogId ? `&catalog_id=${catalogId}` : ""}`),
        ]);
        const configData = configRes.ok ? await configRes.json() : {};
        const productsData = productsRes.ok ? await productsRes.json() : [];
        setConfig(configData);
        setProducts(productsData);
        const types = configData.delivery_types || ["Takeaway"];
        setDeliveryType(types[0]);
        if (types.length === 1) setDeliverySelected(true);
      } catch (e) {
        console.error("Load error:", e);
        setConfig({});
        setProducts([]);
      }
      setLoading(false);
    };
    loadData();
  }, [projectId, catalogId]);

  const accent = config?.accent_color || "#16a34a";
  const currency = config?.currency || "₹";
  const deliveryTypes = config?.delivery_types || ["Takeaway"];
  const categories = ["All", ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  const grouped = {};
  filtered.forEach(p => {
    const cat = p.category || "General";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const addToCart = (product) => setCart(c => ({ ...c, [product.id]: (c[product.id] || 0) + 1 }));
  const removeFromCart = (product) => setCart(c => {
    const qty = (c[product.id] || 0) - 1;
    if (qty <= 0) { const next = { ...c }; delete next[product.id]; return next; }
    return { ...c, [product.id]: qty };
  });

  const cartItems = products.filter(p => cart[p.id] > 0).map(p => ({ ...p, quantity: cart[p.id] }));
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const gstPct = config?.gst_percent || 0;
  const gstAmount = Math.round(subtotal * gstPct) / 100;
  const total = subtotal + gstAmount;

  const handleSubmit = async () => {
    if (!phone || cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/shop/submit-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          project_id: projectId,
          catalog_id: catalogId,
          items: cartItems.map(item => ({
            product_id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image_url: item.image_url || null,
          })),
          delivery_type: deliveryType,
        }),
      });
      if (res.ok) { setSubmitted(true); setCartOpen(false); }
      else { const err = await res.json(); console.error("Submit error:", err); }
    } catch (e) { console.error("Submit error:", e); }
    setSubmitting(false);
  };

  // Opens the existing chat with the business WhatsApp number
  const openWhatsApp = () => {
    const bizPhone = (config?.store_phone || "").replace(/\D/g, "");
    const target = bizPhone || "15556458639"; // fallback to test number
    window.location.href = `https://wa.me/${target}`;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8faf8" }}>
      <div className="text-center space-y-3">
        <div className="w-10 h-10 rounded-full animate-spin mx-auto"
          style={{ border: "3px solid #e5e7eb", borderTopColor: "#16a34a" }} />
        <p className="text-sm text-gray-400">Loading menu...</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8faf8" }}>
      <div className="text-center space-y-5 max-w-xs w-full">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: accent }}>
          <Check size={28} color="white" strokeWidth={3} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{cartCount} items added</h2>
          <p className="text-2xl font-bold mt-1" style={{ color: accent }}>{currency}{total.toFixed(2)}</p>
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
      </div>
    </div>
  );

  if (!deliverySelected && deliveryTypes.length > 1) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8faf8" }}>
      <div className="max-w-xs w-full space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">How would you like to receive your order?</h2>
        </div>
        <div className="space-y-3">
          {deliveryTypes.map(type => (
            <button key={type}
              onClick={() => { setDeliveryType(type); setDeliverySelected(true); }}
              className="w-full py-4 px-5 rounded-xl border-2 text-left font-medium text-gray-800 bg-white flex items-center justify-between"
              style={{ borderColor: deliveryType === type ? accent : "#e5e7eb" }}>
              <span>{type === "Takeaway" ? "🏃 " : "🛵 "}{type}</span>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24" style={{ background: "#f8faf8", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3 shadow-sm" style={{ background: accent }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">{config?.store_name || "Menu"}</h1>
            {deliveryType && <p className="text-white text-xs opacity-80">🏃 {deliveryType}</p>}
          </div>
          {deliveryTypes.length > 1 && (
            <button onClick={() => setDeliverySelected(false)}
              className="text-xs text-white opacity-80 border border-white border-opacity-40 rounded-lg px-3 py-1.5">
              Change type
            </button>
          )}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search dishes, categories..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white rounded-xl pl-8 pr-4 py-2.5 text-sm outline-none text-gray-700 placeholder-gray-400" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {categories.map(cat => (
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

      {/* Products */}
      <div className="px-4 space-y-6">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            {(activeCategory === "All" || Object.keys(grouped).length > 1) && (
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-bold text-gray-900">{category}</h2>
                <span className="text-xs text-gray-400">{items.length} items</span>
                <div className="flex-1 h-px" style={{ background: accent, opacity: 0.3 }} />
              </div>
            )}
            <div className="space-y-3">
              {items.map(product => {
                const qty = cart[product.id] || 0;
                return (
                  <div key={product.id}
                    className="bg-white rounded-xl p-3 flex gap-3 shadow-sm border"
                    style={{ borderColor: qty > 0 ? accent : "#f3f4f6", borderWidth: qty > 0 ? 1.5 : 1 }}>
                    {product.image_url && (
                      <img src={product.image_url} alt={product.name}
                        className="w-20 h-20 object-cover rounded-lg shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-1">
                        <div className="w-4 h-4 border-2 rounded shrink-0 mt-0.5 flex items-center justify-center"
                          style={{ borderColor: accent }}>
                          <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
                        </div>
                        <p className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</p>
                      </div>
                      {product.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{product.description}</p>
                      )}
                      <p className="font-bold text-sm mt-1" style={{ color: accent }}>{currency}{product.price}</p>
                    </div>
                    <div className="shrink-0 flex items-end">
                      {qty === 0 ? (
                        <button onClick={() => addToCart(product)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold shadow-sm"
                          style={{ background: accent }}>
                          <Plus size={18} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => removeFromCart(product)}
                            className="w-8 h-8 rounded-lg border-2 flex items-center justify-center font-bold"
                            style={{ borderColor: accent, color: accent }}>
                            <Minus size={14} />
                          </button>
                          <span className="font-bold text-sm w-4 text-center" style={{ color: accent }}>{qty}</span>
                          <button onClick={() => addToCart(product)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ background: accent }}>
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">No items found</p>
          </div>
        )}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 z-30">
          <button onClick={() => setCartOpen(true)}
            className="w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-between px-5 shadow-lg"
            style={{ background: accent }}>
            <span className="bg-white bg-opacity-20 rounded-lg px-2.5 py-0.5 text-sm font-bold">{cartCount} items</span>
            <span>{currency}{subtotal.toFixed(2)}</span>
            <span className="flex items-center gap-1">View Cart <ChevronRight size={16} /></span>
          </button>
        </div>
      )}

      {/* Cart modal */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart size={18} /> Your Cart
              </h2>
              <button onClick={() => setCartOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} className="text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="w-14 h-14 object-cover rounded-lg shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-400">{currency}{item.price} each</p>
                    <p className="font-bold text-sm" style={{ color: accent }}>
                      {currency}{(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => removeFromCart(item)}
                      className="w-8 h-8 rounded-lg border-2 flex items-center justify-center font-bold"
                      style={{ borderColor: accent, color: accent }}>
                      <Minus size={14} />
                    </button>
                    <span className="font-bold text-sm w-4 text-center" style={{ color: accent }}>{item.quantity}</span>
                    <button onClick={() => addToCart(item)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                      style={{ background: accent }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span><span>{currency}{subtotal.toFixed(2)}</span>
              </div>
              {gstPct > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST ({gstPct}%)</span><span>{currency}{gstAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t">
                <span>Total</span><span>{currency}{total.toFixed(2)}</span>
              </div>
              <button onClick={handleSubmit}
                disabled={submitting || !phone}
                className="w-full py-4 rounded-xl text-white font-semibold text-base mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: accent }}>
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</>
                  : <>📱 Continue to WhatsApp</>
                }
              </button>
              {!phone && (
                <p className="text-xs text-red-500 text-center">Please open this link from WhatsApp</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}