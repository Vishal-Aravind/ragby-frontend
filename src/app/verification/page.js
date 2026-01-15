"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function VerificationPage() {
  const router = useRouter();

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user?.email_confirmed_at) {
          toast.success("Email verified successfully!");
          router.replace("/dashboard");
        }
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-center">
      <p className="text-muted-foreground">
        Verification email sent. Please check your inbox.
      </p>
    </div>
  );
}
