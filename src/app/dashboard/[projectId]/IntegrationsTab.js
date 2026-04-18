"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function IntegrationsTab({ projectId }) {
const [copied, setCopied] = useState(false);
const [loadingWA, setLoadingWA] = useState(false);

const embedCode = `<script
src="https://web-production-f2592.up.railway.app/static/widget.js"
data-project="${projectId}"> </script>`;

// -------------------------------
// Copy embed code
// -------------------------------
const handleCopy = async () => {
try {
await navigator.clipboard.writeText(embedCode);
setCopied(true);
toast.success("Embed code copied");
setTimeout(() => setCopied(false), 2000);
} catch {
toast.error("Failed to copy");
}
};

// -------------------------------
// Embedded Signup listener
// -------------------------------
useEffect(() => {
const handler = async (event) => {
if (!event.origin.endsWith("facebook.com")) return;


  let data;

  try {
    data =
      typeof event.data === "string"
        ? JSON.parse(event.data)
        : event.data;
  } catch {
    return; // ignore non-JSON
  }

  if (data?.type === "WA_EMBEDDED_SIGNUP") {
    // ✅ Success
    if (data.event === "FINISH") {
      const { phone_number_id, waba_id } = data.data || {};

      try {
        await fetch(
          "https://web-production-f2592.up.railway.app/whatsapp/save-metadata",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              phone_number_id,
              waba_id,
            }),
          }
        );
      } catch (err) {
        console.error("Metadata save failed", err);
      }

      toast.success("WhatsApp connected");
      setLoadingWA(false);
    }

    // ❌ Cancel
    if (data.event === "CANCEL") {
      toast.error("WhatsApp setup cancelled");
      setLoadingWA(false);
    }

    // ❌ Error
    if (data.event === "ERROR") {
      toast.error("WhatsApp setup error");
      setLoadingWA(false);
    }
  }
};

window.addEventListener("message", handler);
return () => window.removeEventListener("message", handler);


}, [projectId]);

// -------------------------------
// FB login callback (code → backend)
// -------------------------------
const fbLoginCallback = (response) => {
if (!response.authResponse) {
setLoadingWA(false);
return;
}


const code = response.authResponse.code;

fetch("https://web-production-f2592.up.railway.app/whatsapp/onboard", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ code, projectId }),
})
  .then(async (res) => {
    if (!res.ok) throw new Error();
    toast.success("WhatsApp onboarding started");
    setLoadingWA(false);
  })
  .catch(() => {
    toast.error("Failed to connect WhatsApp");
    setLoadingWA(false);
  });


};

// -------------------------------
// Launch Embedded Signup
// -------------------------------
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
});


};

// -------------------------------
// UI
// -------------------------------
return ( <div className="space-y-6">
{/* Web Widget */} <Card> <CardContent className="p-6 space-y-4"> <h2 className="text-lg font-semibold">Embeddable Chat Widget</h2>

```
      <p className="text-sm text-muted-foreground">
        Add this script before <code>&lt;/body&gt;</code>.
      </p>

      <div className="relative">
        <pre className="bg-muted border rounded p-4 text-sm overflow-x-auto whitespace-pre-wrap">
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
    </CardContent>
  </Card>

  {/* WhatsApp */}
  <Card>
    <CardContent className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">WhatsApp Integration</h2>

      <p className="text-sm text-muted-foreground">
        Connect a WhatsApp number to this project.
      </p>

      <Button onClick={launchWhatsAppSignup} disabled={loadingWA}>
        {loadingWA ? "Opening Meta..." : "Connect WhatsApp"}
      </Button>
    </CardContent>
  </Card>
</div>


);
}
