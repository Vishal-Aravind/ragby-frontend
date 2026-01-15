import "./globals.css";
import { Toaster } from "sonner";

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
      </body>
    </html>
  );
}
