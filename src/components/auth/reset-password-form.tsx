"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { completePasswordReset } from "@/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type ResetPasswordFormProps = {
  code?: string;
  tokenHash?: string;
  tokenType?: string;
};

export function ResetPasswordForm({
  code,
  tokenHash,
  tokenType,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [exchanging, setExchanging] = useState(Boolean(code || tokenHash));

  // Exchange the code/token on the CLIENT side where browser cookies
  // (including the PKCE code_verifier) are reliably available
  useEffect(() => {
    if (!code && !tokenHash) {
      setExchanging(false);
      return;
    }

    const supabase = createClient();

    async function exchangeToken() {
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            setHasRecoverySession(true);
            window.history.replaceState({}, "", "/reset-password");
          } else {
            setError(
              "This reset link is invalid or has expired. Request a new one from the sign-in screen.",
            );
          }
        } else if (tokenHash && tokenType) {
          const { error } = await supabase.auth.verifyOtp({
            type: tokenType as "recovery",
            token_hash: tokenHash,
          });
          if (!error) {
            setHasRecoverySession(true);
            window.history.replaceState({}, "", "/reset-password");
          } else {
            setError(
              "This reset link is invalid or has expired. Request a new one from the sign-in screen.",
            );
          }
        }
      } catch {
        setError("Something went wrong. Please request a new reset link.");
      } finally {
        setExchanging(false);
      }
    }

    exchangeToken();
  }, [code, tokenHash, tokenType]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await completePasswordReset(password);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="w-full max-w-md mx-auto">
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
          Secure password recovery
        </p>
      </div>

      <div className="glass-card p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-sans)] text-white">
            Create a new password
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose a new password for your account and use it the next time you
            sign in.
          </p>
        </div>

        {exchanging && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              Verifying reset link…
            </span>
          </div>
        )}

        {!exchanging && !hasRecoverySession && !success && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Reset link unavailable</AlertTitle>
            <AlertDescription>
              This reset link is invalid or has expired. Request a fresh link
              from the sign-in screen.
            </AlertDescription>
          </Alert>
        )}

        {success ? (
          <Alert>
            <CheckCircle2 />
            <AlertTitle>Password updated</AlertTitle>
            <AlertDescription>
              Your password has been reset successfully.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm text-muted-foreground"
              >
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter a new password"
                minLength={6}
                required
                disabled={exchanging || !hasRecoverySession || loading}
                className="bg-background/50 border-border focus:border-primary focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirm-password"
                className="text-sm text-muted-foreground"
              >
                Confirm Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your new password"
                minLength={6}
                required
                disabled={exchanging || !hasRecoverySession || loading}
                className="bg-background/50 border-border focus:border-primary focus:ring-primary/20"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Unable to reset password</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={exchanging || !hasRecoverySession || loading}
              className="w-full bg-primary text-primary-foreground hover:bg-[#00B8A9] font-semibold uppercase tracking-wider text-sm h-12 transition-all duration-300"
              style={{
                boxShadow: "0 4px 15px rgba(0, 255, 224, 0.3)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        )}

        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/login?reset=success")}
            disabled={!success}
            className="text-primary hover:text-primary"
          >
            Return to sign in
          </Button>
        </div>

        {!success && (
          <p className="text-center text-xs text-muted-foreground">
            Need a new link? Return to{" "}
            <Link href="/login" className="text-primary hover:underline">
              sign in
            </Link>{" "}
            and request another password reset email.
          </p>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        LK PharmaCare v1.0 - Powered by{" "}
        <span className="text-primary font-medium">STEM ED</span>
      </p>
    </div>
  );
}
