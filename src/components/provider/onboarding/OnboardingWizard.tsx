"use client";

import { useState } from "react";
import Image from "next/image";
import { submitProviderOnboarding } from "@/actions/provider.actions";
import { StepProfile } from "./StepProfile";
import { StepIdentity } from "./StepIdentity";
import { StepPayout } from "./StepPayout";
import {
  EMPTY_IDENTITY, EMPTY_PAYOUT, EMPTY_PROFILE,
  anyMissing, identityMissing, payoutMissing, profileMissing,
  type IdentityData, type PayoutData, type ProfileData, type ServiceOption,
} from "./types";

const STEPS = ["Professional Profile", "Identity Verification", "Payout Method"];

export function OnboardingWizard({ services }: { services: ServiceOption[] }) {
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [identity, setIdentity] = useState<IdentityData>(EMPTY_IDENTITY);
  const [payout, setPayout] = useState<PayoutData>(EMPTY_PAYOUT);

  const stepIsValid = () =>
    step === 0
      ? !anyMissing(profileMissing(profile))
      : step === 1
      ? !anyMissing(identityMissing(identity))
      : !anyMissing(payoutMissing(payout));

  const goBack = () => {
    setShowErrors(false);
    setStep((s) => Math.max(0, s - 1));
  };

  const goNext = async () => {
    if (!stepIsValid()) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setErrorMessage(null);

    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }

    // Último paso: enviamos todo
    setIsLoading(true);
    const { avatarPreview, ...profileToSend } = profile;
    void avatarPreview;
    const result = await submitProviderOnboarding({
      profile: profileToSend,
      identity,
      payout,
    });

    if (!result.success) {
      setErrorMessage(result.error ?? "Could not submit your information.");
      setIsLoading(false);
      return;
    }
    // Recarga completa para que el middleware lea los metadatos actualizados
    window.location.href = result.redirectTo ?? "/provider/dashboard";
  };

  return (
    <div className="min-h-screen bg-tx-bg">
      <header className="bg-tx-navy px-6 py-4">
        <Image src="/logo-tx.svg" alt="Takunex logo" width={64} height={32} priority />
      </header>

      <div className="flex flex-col md:min-h-[calc(100vh-64px)] md:flex-row">
        <nav className="bg-tx-ink p-4 md:w-64 md:py-8" aria-label="Onboarding steps">
          <ol className="flex gap-2 md:flex-col md:gap-4">
            {STEPS.map((label, i) => (
              <li
                key={label}
                aria-current={i === step ? "step" : undefined}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white md:flex-none md:text-sm ${
                  i === step ? "bg-tx-sky" : ""
                }`}
              >
                {i + 1}. {label} {i < step && "✓"}
              </li>
            ))}
          </ol>
        </nav>

        <main className="flex-1 p-6 md:p-10">
          <h1 className="text-center text-3xl font-bold text-tx-navy">Provider Onboarding</h1>
          <h2 className="mt-6 text-2xl text-tx-navy">
            Step {step + 1}: {STEPS[step]}
          </h2>

          <div className="mt-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
            {step === 0 && (
              <StepProfile data={profile} onChange={setProfile} services={services} showErrors={showErrors} />
            )}
            {step === 1 && (
              <StepIdentity data={identity} onChange={setIdentity} showErrors={showErrors} />
            )}
            {step === 2 && (
              <StepPayout data={payout} onChange={setPayout} showErrors={showErrors} />
            )}
          </div>

          {errorMessage && (
            <p className="mt-4 text-sm font-medium text-red-600" role="alert">{errorMessage}</p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              className={`rounded-full border-2 border-tx-navy px-10 py-3 text-base font-bold text-tx-navy transition hover:bg-white ${
                step === 0 ? "invisible" : ""
              }`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={isLoading}
              className="rounded-full bg-tx-sky px-10 py-3 text-base font-bold text-white shadow-md transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Submitting..." : step === STEPS.length - 1 ? "Complete Registration" : "Next"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}