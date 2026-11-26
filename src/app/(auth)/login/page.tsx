"use client";

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginUser } from "@/actions/auth.actions";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

const ERROR_MESSAGES: Record<string, string> = {
  admin_google_blocked:
    "Admin accounts cannot authenticate via Google. Please use your email and password.",
  account_suspended: "Your account has been suspended by an administrator.",
  account_deleted: "This account has been deactivated.",
  auth_callback_failed: "Authentication failed. Please try again.",
  invalid_or_expired_link: "The verification link is invalid or has expired.",
};

function LoginFormContent() {
  const searchParams = useSearchParams();
  const urlErrorCode = searchParams.get("error");
  const initialUrlError = urlErrorCode
    ? ERROR_MESSAGES[urlErrorCode] ?? "Authentication error. Please try again."
    : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const displayedError = formError ?? initialUrlError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsLoading(true);

    try {
      const result = await loginUser({ email, password });

      if (!result.success) {
        setFormError(result.error ?? "Invalid email or password.");
        setIsLoading(false);
        return;
      }

      // Navegación completa para que proxy.ts/middleware lea las cookies recién creadas
      window.location.href = result.redirectTo ?? "/homeowner/dashboard";
    } catch {
      setFormError("Connection error while signing in. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sign in to your Takunex account
        </p>
      </div>

      {displayedError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          role="alert"
        >
          {displayedError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-slate-700"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-400">Or</span>
        </div>
      </div>

      <GoogleAuthButton label="Sign in with Google" />

      <p className="text-center text-xs text-slate-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-blue-600 hover:text-blue-500"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormContent />
    </Suspense>
  );
}