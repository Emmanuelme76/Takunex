"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser } from "@/actions/auth.actions";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordInput, authInputClass } from "@/components/auth/PasswordInput";

const labelClass = "mb-1.5 block text-sm font-semibold text-tx-black";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    const result = await registerUser({
      firstName,
      lastName,
      email,
      password,
      role: "HOMEOWNER", // Rol por defecto
      acceptTerms,
    });

    if (!result.success) {
      setErrorMessage(result.error ?? "Registration failed.");
      setIsLoading(false);
      return;
    }

    router.push(result.redirectTo ?? "/verify-email");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-tx-ink">Sign Up</h1>
        <p className="mt-2 text-xs text-tx-black">
          I have an{" "}
          <Link href="/login" className="text-tx-violet underline">
            account
          </Link>
        </p>
      </div>

      {errorMessage && (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="firstName" className={labelClass}>First Name</label>
          <input
            id="firstName"
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First Name"
            className={authInputClass}
          />
        </div>

        <div>
          <label htmlFor="lastName" className={labelClass}>Last Name</label>
          <input
            id="lastName"
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last Name"
            className={authInputClass}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email@example.com"
            className={authInputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>Password</label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            placeholder="Minimum 8 characters"
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className={labelClass}>Confirm Password</label>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm password"
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-start gap-2.5">
          <input
            id="acceptTerms"
            type="checkbox"
            required
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-tx-sky"
          />
          <label htmlFor="acceptTerms" className="text-xs text-tx-black">
            I agree to the{" "}
            <span className="text-tx-violet underline">Terms &amp; Conditions</span>{" "}
            and{" "}
            <span className="text-tx-violet underline">Privacy Policy</span>.
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full bg-tx-sky px-4 py-3 text-base font-bold text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-tx-teal focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-tx-gray-light" />
        <span className="text-xs text-tx-gray">or</span>
        <div className="h-px flex-1 bg-tx-gray-light" />
      </div>

      <GoogleAuthButton label="Sign up with Google" />
    </div>
  );
}