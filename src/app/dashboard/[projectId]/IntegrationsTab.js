// src\app\dashboard\[projectId]\IntegrationsTab.js

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function IntegrationsTab({ projectId }) {
  const [copied, setCopied] = useState(false);

  const embedCode = `<script
  src="https://YOUR_DOMAIN/static/widget.js"
  data-project="${projectId}">
</script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Embeddable Chat Widget</h2>

        <p className="text-sm text-muted-foreground">
          Add this script to your website (before the closing <code>&lt;/body&gt;</code> tag).
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
  );
}
