// app/layout.js
import "./globals.css";
import { Toaster } from "sonner";
import Script from "next/script";

export const metadata = {
  title: "ragby",
  description: "Multi-project RAG SaaS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        {children}
        <Toaster richColors position="top-right" />

        {/* Load Facebook SDK */}
        <Script
          src="https://connect.facebook.net/en_US/sdk.js"
          strategy="afterInteractive"
        />

        {/* Initialize SDK */}
        <Script id="fb-init" strategy="afterInteractive">
          {`
            window.fbAsyncInit = function () {
              FB.init({
                appId: "2088401315249131",
                autoLogAppEvents: true,
                xfbml: true,
                version: "v24.0"
              });
            };
          `}
        </Script>
      </body>
    </html>
  );
}
