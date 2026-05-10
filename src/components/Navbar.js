"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      const { user } = await res.json();
      setUser(user);
    };
    loadUser();
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <header className="h-14 border-b bg-white/80 backdrop-blur-sm px-6 flex items-center justify-between sticky top-0 z-50">

      {/* Wordmark */}
      <button
        onClick={() => router.push("/dashboard")}
        className="group flex items-center gap-2 focus:outline-none"
      >
        {/* Z icon — chat bubble peeking */}
        <div className="relative w-8 h-8 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Chat bubble */}
            <rect x="4" y="12" width="24" height="18" rx="6" fill="#111111"/>
            {/* Bubble tail */}
            <path d="M9 30 L5 36 L15 30" fill="#111111"/>
            {/* Typing dots */}
            <circle cx="10" cy="21" r="2" fill="#4F8EF7" opacity="0.9"/>
            <circle cx="16" cy="21" r="2" fill="#4F8EF7" opacity="0.6"/>
            <circle cx="22" cy="21" r="2" fill="#4F8EF7" opacity="0.3"/>
            {/* Z peeking over bubble */}
            <line x1="6" y1="8" x2="18" y2="8" stroke="#4F8EF7" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="18" y1="8" x2="6" y2="14" stroke="#4F8EF7" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="6" y1="14" x2="18" y2="14" stroke="#4F8EF7" strokeWidth="3.5" strokeLinecap="round"/>
            {/* Eyes on Z top bar */}
            <circle cx="9" cy="5" r="2.5" fill="white" stroke="#111" strokeWidth="0.5"/>
            <circle cx="9" cy="5" r="1.2" fill="#111111"/>
            <circle cx="15" cy="4" r="2.5" fill="white" stroke="#111" strokeWidth="0.5"/>
            <circle cx="15" cy="4" r="1.2" fill="#111111"/>
          </svg>
        </div>

        {/* Wordmark text */}
        <span className="text-[17px] font-semibold tracking-tight text-gray-900 group-hover:text-black transition-colors">
          zavo
        </span>
      </button>

      {/* Right — user avatar */}
      {user && (
        <Sheet>
          <SheetTrigger asChild>
            <button className="focus:outline-none group">
              <Avatar className="h-8 w-8 ring-2 ring-transparent group-hover:ring-blue-200 transition-all duration-200">
                <AvatarFallback className="bg-gray-900 text-white text-xs font-medium">
                  {user.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </SheetTrigger>

          <SheetContent side="right" className="w-76 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Account</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-full">

              {/* Header area */}
              <div className="px-6 pt-8 pb-6 border-b bg-gray-50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gray-900 text-white text-sm font-medium">
                      {user.email?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">My Account</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 px-6 py-6 space-y-2">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
                >
                  <User size={15} className="text-gray-400" />
                  Dashboard
                </button>
              </div>

              {/* Footer */}
              <div className="px-6 pb-8">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>

            </div>
          </SheetContent>
        </Sheet>
      )}
    </header>
  );
}