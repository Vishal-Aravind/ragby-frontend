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

        {/* Facebook SDK */}
        <Script
          src="https://connect.facebook.net/en_US/sdk.js"
          strategy="afterInteractive"
          onLoad={() => {
            window.FB.init({
              appId: "2088401315249131", // your real App ID
              autoLogAppEvents: true,
              xfbml: true,
              version: "v24.0",
            });
          }}
        />
      </body>
    </html>
  );
}
