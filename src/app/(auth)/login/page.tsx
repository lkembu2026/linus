import { LoginForm } from "@/components/auth/login-form";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    next?: string;
    reason?: string;
    reset?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  if (params.code || (params.token_hash && params.type)) {
    const next = params.next ?? "/reset-password";

    // Password reset: send code directly to reset-password page
    // so the client-side can exchange it (PKCE code_verifier lives in browser cookies)
    if (next === "/reset-password") {
      const resetParams = new URLSearchParams();
      if (params.code) resetParams.set("code", params.code);
      if (params.token_hash) resetParams.set("token_hash", params.token_hash);
      if (params.type) resetParams.set("type", params.type);
      redirect(`/reset-password?${resetParams.toString()}`);
    }

    // Other auth flows (signup confirmation, etc.) → use server callback
    const callbackParams = new URLSearchParams();
    if (params.code) callbackParams.set("code", params.code);
    if (params.token_hash) callbackParams.set("token_hash", params.token_hash);
    if (params.type) callbackParams.set("type", params.type);
    callbackParams.set("next", next);
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  const timeoutMessage =
    params.reason === "timeout"
      ? "Your session expired after inactivity. Please sign in again."
      : params.reason === "recovery_error"
        ? "This password reset link is invalid or has expired. Request a new one from the sign-in screen."
        : null;
  const noticeMessage =
    params.reset === "success"
      ? "Password updated successfully. Sign in with your new password."
      : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background glow effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #00FFE0 0%, transparent 70%)",
          }}
        />
      </div>

      <LoginForm
        timeoutMessage={timeoutMessage}
        noticeMessage={noticeMessage}
      />
    </div>
  );
}
