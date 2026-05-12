import "./globals.css";
import { Toaster } from "sonner";
import Script from "next/script";

export const metadata = {
  title: "zavo",
  description: "Multi-project RAG SaaS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        {children}
        <Toaster richColors position="top-right" />

        {/* Init MUST come before SDK */}
        <Script id="fb-init" strategy="beforeInteractive">
          {`
            window.fbAsyncInit = function () {
              FB.init({
                appId: "${process.env.NEXT_PUBLIC_META_APP_ID}",
                autoLogAppEvents: true,
                xfbml: true,
                version: "v19.0"
              });
            };
          `}
        </Script>

        {/* Facebook SDK */}
        <Script
          src="https://connect.facebook.net/en_US/sdk.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}