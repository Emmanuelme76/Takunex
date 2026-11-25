"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  logoutUser,
} from "@/actions/auth.actions";

export default function VerifyPhonePage() {
  const router = useRouter();
  const [step, setStep] = useState<"ENTER_PHONE" | "ENTER_CODE">("ENTER_PHONE");
  const [phoneNumber, setPhoneNumber] = useState("+52");
  const [otpCode, setOtpCode] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const result = await sendPhoneOtp(phoneNumber);

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error ?? "Could not send SMS.");
      return;
    }

    setStep("ENTER_CODE");
    setInfoMessage(`We sent a 6-digit verification code to ${phoneNumber}.`);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const result = await verifyPhoneOtp(otpCode);

    if (!result.success) {
      setErrorMessage(result.error ?? "Invalid verification code.");
      setIsLoading(false);
      return;
    }

    router.push(result.redirectTo ?? "/homeowner/dashboard");
    router.refresh();
  };

  const handleSignOut = async () => {
    await logoutUser();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">
          Verify your phone number
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {step === "ENTER_PHONE"
            ? "Enter your mobile number to receive a 6-digit SMS code."
            : "Enter the 6-digit PIN sent to your phone."}
        </p>
      </div>

      {errorMessage && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {infoMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
          {infoMessage}
        </div>
      )}

      {step === "ENTER_PHONE" ? (
        <form onSubmit={handleSendSms} className="space-y-4">
          <div>
            <label
              htmlFor="phone"
              className="block text-xs font-medium text-slate-700"
            >
              Mobile phone number (international format)
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+523312345678"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <p className="mt-1 text-xs text-slate-500">
              Include country code (e.g., +52 for Mexico, +1 for US).
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Sending SMS..." : "Send Verification Code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label
              htmlFor="otpCode"
              className="block text-xs font-medium text-slate-700"
            >
              6-Digit Verification Code
            </label>
            <input
              id="otpCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg font-bold tracking-[0.4em] text-slate-900 placeholder-slate-300 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || otpCode.length !== 6}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Verifying..." : "Verify & Continue"}
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setStep("ENTER_PHONE");
              setOtpCode("");
              setErrorMessage(null);
              setInfoMessage(null);
            }}
            className="w-full text-center text-xs font-medium text-blue-600 hover:text-blue-500"
          >
            Change phone number or resend code
          </button>
        </form>
      )}

      <div className="border-t border-slate-100 pt-4 text-center">
        <button
          type="button"
          onClick={handleSignOut}
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}