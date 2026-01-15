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
    <header className="h-14 border-b px-6 flex items-center justify-between">
      {/* Left */}
      <div
        className="font-semibold cursor-pointer"
        onClick={() => router.push("/dashboard")}
      >
        Ragby
      </div>

      {/* Right */}
      {user && (
        <Sheet>
          <SheetTrigger asChild>
            <button className="rounded-full">
              <Avatar>
                <AvatarFallback>
                  {user.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </SheetTrigger>

          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>Account</SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div className="text-sm">
                <p className="font-medium">Signed in as</p>
                <p className="text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>

              <Button
                variant="destructive"
                className="w-full"
                onClick={logout}
              >
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </header>
  );
}
