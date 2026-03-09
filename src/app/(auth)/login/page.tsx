import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    reason?: string;
    reset?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
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
