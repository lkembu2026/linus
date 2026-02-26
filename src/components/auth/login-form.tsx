"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await login(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo & Header */}
      <div className="text-center mb-8">
        <Image
          src="/lk1.webp"
          alt="LK PharmaCare"
          width={64}
          height={64}
          className="rounded-xl mb-4 mx-auto"
        />
        <h1 className="text-2xl font-bold font-[family-name:var(--font-sans)] text-white">
          LK <span className="text-primary">PharmaCare</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Pharmacy Operating System
        </p>
      </div>

      {/* Login Card */}
      <div className="glass-card p-8">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-sans)] text-white mb-6">
          Sign in to your account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-muted-foreground">
              Email Address
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@pharmacy.com"
              required
              className="bg-background/50 border-border focus:border-primary focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="bg-background/50 border-border focus:border-primary focus:ring-primary/20"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-[#00B8A9] font-semibold uppercase tracking-wider text-sm h-12 transition-all duration-300"
            style={{
              boxShadow: "0 4px 15px rgba(0, 255, 224, 0.3)",
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground mt-6">
        LK PharmaCare v1.0 — Powered by{" "}
        <span className="text-primary font-medium">HYKROX</span>
      </p>
    </div>
  );
}
