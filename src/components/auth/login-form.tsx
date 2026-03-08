"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { login, resetPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const searchParams = useSearchParams();
  const timeoutMessage =
    searchParams.get("reason") === "timeout"
      ? "Your session expired after inactivity. Please sign in again."
      : null;

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

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) return;
    setLoading(true);
    setError(null);
    const result = await resetPassword(resetEmail);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("Password reset email sent! Check your inbox.");
    setForgotMode(false);
    setResetEmail("");
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo & Header */}
      <div className="text-center mb-8">
        <div className="inline-block rounded-full ring-2 ring-primary/50 ring-offset-4 ring-offset-background shadow-[0_0_20px_rgba(0,255,224,0.3)] mb-4">
          <Image
            src="/LKL.webp"
            alt="LK PharmaCare"
            width={80}
            height={80}
            className="rounded-full block"
          />
        </div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-sans)] text-white">
          LK <span className="text-primary">PharmaCare</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Pharmacy Operating System
        </p>
      </div>

      {/* Login Card */}
      <div className="glass-card p-8">
        {!forgotMode ? (
          <>
            <h2 className="text-lg font-semibold font-[family-name:var(--font-sans)] text-white mb-6">
              Sign in to your account
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm text-muted-foreground"
                >
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
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-sm text-muted-foreground"
                  >
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setError(null);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="bg-background/50 border-border focus:border-primary focus:ring-primary/20"
                />
              </div>

              {(error || timeoutMessage) && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error ?? timeoutMessage}
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
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setForgotMode(false);
                setError(null);
              }}
              className="flex items-center text-sm text-muted-foreground hover:text-white mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to sign in
            </button>
            <h2 className="text-lg font-semibold font-[family-name:var(--font-sans)] text-white mb-2">
              Reset Password
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="reset-email"
                  className="text-sm text-muted-foreground"
                >
                  Email Address
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@pharmacy.com"
                  required
                  className="bg-background/50 border-border focus:border-primary focus:ring-primary/20"
                />
              </div>

              {(error || timeoutMessage) && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error ?? timeoutMessage}
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
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </form>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground mt-6">
        LK PharmaCare v1.0 — Powered by{" "}
        <span className="text-primary font-medium">STEM ED</span>
      </p>
    </div>
  );
}
