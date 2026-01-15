import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">ragby</h1>
        <p className="text-muted-foreground">
          Build RAG chatbots for your documents
        </p>

        <div className="flex justify-center gap-4">
          <Link href="/login">
            <Button>Login</Button>
          </Link>

          <Link href="/signup">
            <Button variant="outline">Sign up</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
