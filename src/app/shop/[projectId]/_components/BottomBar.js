"use client";

import { Home, ShoppingCart, Receipt } from "lucide-react";

export const BOTTOM_BAR_HEIGHT = 56;

/** Fixed Home / Cart / My Orders bar with safe-area padding. */
export default function BottomBar({ tab, cartCount, accent, onHome, onCart, onOrders }) {
  const items = [
    { key: "home", label: "Home", Icon: Home, onClick: onHome },
    { key: "cart", label: "Cart", Icon: ShoppingCart, onClick: onCart, badge: cartCount },
    { key: "orders", label: "My Orders", Icon: Receipt, onClick: onOrders },
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Shop navigation"
    >
      <div className="max-w-xl mx-auto grid grid-cols-3" style={{ height: BOTTOM_BAR_HEIGHT }}>
        {items.map(({ key, label, Icon, onClick, badge }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={onClick}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold"
              style={{ color: active ? accent : "#6b7280" }}
            >
              <span className="relative">
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                {badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                    style={{ background: "#ef4444" }}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
