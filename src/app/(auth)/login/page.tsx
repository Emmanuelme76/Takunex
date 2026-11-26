"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

const inputClass =
  "block w-full rounded-full bg-tx-gray-light/40 px-5 py-3 text-sm text-tx-ink " +
  "placeholder:italic placeholder:text-tx-gray focus:outline-none focus:ring-2 focus:ring-tx-sky";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlErrorCode = searchParams.get("error");
  const initialUrlError = urlErrorCode
    ? ERROR_MESSAGES[urlErrorCode] ?? "Authentication error. Please try again."
    : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const displayedError = formError ?? initialUrlError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    const result = await loginUser({ email, password });

    if (!result.success) {
      setFormError(result.error ?? "Invalid email or password.");
      setIsLoading(false);
      return;
    }

    router.push(result.redirectTo ?? "/homeowner/dashboard");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-tx-ink">Sign in</h1>
        <p className="mt-2 text-xs text-tx-black">
          or create a{" "}
          <Link href="/register" className="text-tx-violet underline">
            new account
          </Link>
        </p>
      </div>

      {displayedError && (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          role="alert"
        >
          {displayedError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-tx-black">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email@example.com"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-semibold text-tx-black">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-tx-black"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          <Link
            href="/forgot-password"
            className="mt-1 inline-block text-xs text-tx-violet underline"
          >
            I forgot my password
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full bg-tx-sky px-4 py-3 text-base font-bold text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-tx-teal focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Login"}
        </button>
      </form>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-tx-gray-light" />
        <span className="text-xs text-tx-gray">or</span>
        <div className="h-px flex-1 bg-tx-gray-light" />
      </div>

      <GoogleAuthButton label="Continue with Google" />
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