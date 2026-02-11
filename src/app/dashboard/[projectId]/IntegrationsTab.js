"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function IntegrationsTab({ projectId }) {
  const [copied, setCopied] = useState(false);
  const [loadingWA, setLoadingWA] = useState(false);

  // ===============================
  // Chat Widget Embed Code
  // ===============================
  const embedCode = `<script
  src="https://web-production-f2592.up.railway.app/static/widget.js"
  data-project="${projectId}">
</script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success("Embed code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  // ===============================
  // WhatsApp Embedded Signup
  // ===============================
  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }

      try {
        const data = JSON.parse(event.data);

        if (data.type === "WA_EMBEDDED_SIGNUP") {
          if (data.event === "FINISH") {
            toast.success("WhatsApp connected");
          }
        }
      } catch {}
    });
  }, []);

  const fbLoginCallback = async (response) => {
    if (!response.authResponse) {
      setLoadingWA(false);
      return;
    }

    const code = response.authResponse.code;

    try {
      await fetch(
        "https://web-production-f2592.up.railway.app/whatsapp/onboard",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            projectId,
          }),
        }
      );

      toast.success("WhatsApp connected successfully");
    } catch {
      toast.error("WhatsApp connection failed");
    }

    setLoadingWA(false);
  };

  const launchWhatsAppSignup = () => {
    if (!window.FB) {
      toast.error("Facebook SDK not loaded");
      return;
    }

    setLoadingWA(true);

    window.FB.login(fbLoginCallback, {
      config_id: "947360908465347",
      response_type: "code",
      override_default_response_type: true,
      extras: { version: "v3" },
    });
  };

  return (
    <div className="space-y-6">
      {/* ===================================== */}
      {/* Embeddable Chat Widget */}
      {/* ===================================== */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Embeddable Chat Widget</h2>

          <p className="text-sm text-muted-foreground">
            Add this script to your website before the closing{" "}
            <code>&lt;/body&gt;</code> tag.
          </p>

          <div className="relative">
            <pre className="bg-muted border rounded p-4 text-sm overflow-x-auto">
              {embedCode}
            </pre>

            <Button
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            ✔ Works on any website <br />
            ✔ No login required <br />
            ✔ Uses your indexed documents
          </div>
        </CardContent>
      </Card>

      {/* ===================================== */}
      {/* WhatsApp Integration */}
      {/* ===================================== */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">WhatsApp Integration</h2>

          <p className="text-sm text-muted-foreground">
            Connect a WhatsApp number to this project to enable AI replies.
          </p>

          <Button onClick={launchWhatsAppSignup} disabled={loadingWA}>
            {loadingWA ? "Opening Meta..." : "Connect WhatsApp"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
