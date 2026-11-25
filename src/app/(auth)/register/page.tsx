"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser } from "@/actions/auth.actions";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"HOMEOWNER" | "PROVIDER">("HOMEOWNER");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const result = await registerUser({
      firstName,
      lastName,
      email,
      password,
      role,
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
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Choose how you want to use Takunex
        </p>
      </div>

      {/* Selector de Rol: Homeowner o Provider */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setRole("HOMEOWNER")}
          className={`rounded-xl border p-3 text-left transition ${
            role === "HOMEOWNER"
              ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-600"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-sm font-semibold text-slate-900">Homeowner</p>
          <p className="mt-0.5 text-xs text-slate-500">Hire trusted pros</p>
        </button>

        <button
          type="button"
          onClick={() => setRole("PROVIDER")}
          className={`rounded-xl border p-3 text-left transition ${
            role === "PROVIDER"
              ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-600"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-sm font-semibold text-slate-900">Provider</p>
          <p className="mt-0.5 text-xs text-slate-500">Offer your services</p>
        </button>
      </div>

      {errorMessage && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="firstName"
              className="block text-xs font-medium text-slate-700"
            >
              First name
            </label>
            <input
              id="firstName"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="block text-xs font-medium text-slate-700"
            >
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        {/* Casilla legal obligatoria */}
        <div className="flex items-start gap-2.5">
          <input
            id="acceptTerms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          <label htmlFor="acceptTerms" className="text-xs text-slate-600">
            I agree to Takunex&apos;s{" "}
            <span className="font-medium text-slate-900 underline">
              Terms &amp; Conditions
            </span>{" "}
            and{" "}
            <span className="font-medium text-slate-900 underline">
              Privacy Policy
            </span>
            .
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Creating account..." : "Create Account"}
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

      <GoogleAuthButton label="Sign up with Google" />

      <p className="text-center text-xs text-slate-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-blue-600 hover:text-blue-500"
        >
          Sign in
        </Link>
      </p>
      
    </div>
  );
}