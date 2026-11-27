"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createServiceOrderAction } from "@/actions/booking.actions";
import { ActiveOffer } from "@/lib/offers";

export interface BookableServiceItem {
  id: string;
  title: string;
  description: string;
  categoryName: string;
  hourlyRate: number;
}

export interface BookableProviderItem {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  rating: number;
  totalReviews: number;
  aboutMe: string | null;
  services: BookableServiceItem[];
}

interface NewRequestFormProps {
  providers: BookableProviderItem[];
  initialProviderId?: string;
  initialOfferApplied: boolean;
  activeOffer: ActiveOffer | null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function NewRequestForm({
  providers,
  initialProviderId,
  initialOfferApplied,
  activeOffer,
}: NewRequestFormProps) {
  const router = useRouter();

  const defaultProvider =
    providers.find((p) => p.id === initialProviderId) ?? providers[0];

  const [selectedProviderId, setSelectedProviderId] = useState(
    defaultProvider?.id ?? ""
  );

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) ?? providers[0],
    [providers, selectedProviderId]
  );

  const [selectedServiceId, setSelectedServiceId] = useState(
    defaultProvider?.services[0]?.id ?? ""
  );
  const [estimatedHours, setEstimatedHours] = useState<number>(2);
  const [scheduledDate, setScheduledDate] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [description, setDescription] = useState("");
  const [paymentType, setPaymentType] = useState<"CARD" | "CASH">("CARD");
  const [applyOffer, setApplyOffer] = useState<boolean>(
    Boolean(activeOffer && initialOfferApplied)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleProviderChange = (newProviderId: string) => {
    setSelectedProviderId(newProviderId);
    const nextProvider = providers.find((p) => p.id === newProviderId);
    setSelectedServiceId(nextProvider?.services[0]?.id ?? "");
  };

  const selectedService = useMemo(
    () =>
      selectedProvider?.services.find((s) => s.id === selectedServiceId) ??
      selectedProvider?.services[0],
    [selectedProvider, selectedServiceId]
  );

  const financialBreakdown = useMemo(() => {
    const rate = selectedService?.hourlyRate ?? 0;
    const subtotal = roundMoney(rate * estimatedHours);
    const discount =
      applyOffer && activeOffer
        ? roundMoney(subtotal * activeOffer.discountRate)
        : 0;
    const totalAmount = roundMoney(Math.max(subtotal - discount, 0));
    const commissionRate = 0.12;
    const platformComission = roundMoney(totalAmount * commissionRate);
    const providerNetAmount = roundMoney(totalAmount - platformComission);

    return {
      rate,
      subtotal,
      discount,
      totalAmount,
      platformComission,
      providerNetAmount,
    };
  }, [selectedService, estimatedHours, applyOffer, activeOffer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProvider || !selectedService) {
      setErrorMessage("Please select a valid provider and service.");
      return;
    }

    setIsSubmitting(true);

    const result = await createServiceOrderAction({
      providerId: selectedProvider.id,
      serviceId: selectedService.id,
      estimatedHours,
      scheduledDate,
      address,
      city,
      state,
      zipCode,
      description,
      paymentType,
      applyOffer,
    });

    if (!result.success) {
      setErrorMessage(result.error ?? "Unable to submit your booking.");
      setIsSubmitting(false);
      return;
    }

    router.push("/homeowner/orders?created=1");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/homeowner/dashboard"
            className="text-xs font-semibold text-tx-sky hover:underline"
          >
            &larr; Back to Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold text-tx-black">
            Hire a Service Provider
          </h1>
          <p className="text-sm text-tx-gray-dark">
            Configure your service details, schedule, and simulated payment method.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-tx-black">
              1. Provider &amp; Service
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="providerId"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  Provider
                </label>
                <select
                  id="providerId"
                  value={selectedProvider?.id ?? ""}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light bg-white px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none"
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.fullName} ({provider.rating.toFixed(1)} ★)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="serviceId"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  Service Offering
                </label>
                <select
                  id="serviceId"
                  value={selectedService?.id ?? ""}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light bg-white px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none"
                >
                  {(selectedProvider?.services ?? []).map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.title} — ${svc.hourlyRate.toFixed(2)}/hr
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedService && (
              <div className="rounded-xl bg-tx-canvas/70 p-3.5 text-xs text-tx-ink">
                <span className="font-bold text-tx-navy">
                  [{selectedService.categoryName}]
                </span>{" "}
                {selectedService.description}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="estimatedHours"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  Estimated Duration (Hours)
                </label>
                <input
                  id="estimatedHours"
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={estimatedHours}
                  onChange={(e) =>
                    setEstimatedHours(
                      Math.min(Math.max(Number(e.target.value) || 1, 1), 12)
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="scheduledDate"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  Preferred Date &amp; Time
                </label>
                <input
                  id="scheduledDate"
                  type="datetime-local"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-tx-black">
              2. Service Location &amp; Job Details
            </h2>

            <div>
              <label
                htmlFor="address"
                className="block text-xs font-semibold text-tx-ink"
              >
                Street Address
              </label>
              <input
                id="address"
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Hidalgo 245, Col. Centro"
                className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black placeholder-tx-gray-muted focus:border-tx-sky focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="city"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Chapala"
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black placeholder-tx-gray-muted focus:border-tx-sky focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="state"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  State
                </label>
                <input
                  id="state"
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Jalisco"
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black placeholder-tx-gray-muted focus:border-tx-sky focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="zipCode"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  ZIP Code
                </label>
                <input
                  id="zipCode"
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="45900"
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black placeholder-tx-gray-muted focus:border-tx-sky focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-xs font-semibold text-tx-ink"
              >
                Additional Instructions (Optional)
              </label>
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue, access instructions, or materials needed..."
                className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black placeholder-tx-gray-muted focus:border-tx-sky focus:outline-none"
              />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-5 rounded-2xl bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-tx-black">
              3. Payment &amp; Cost Summary
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType("CARD")}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                  paymentType === "CARD"
                    ? "border-tx-sky bg-tx-sky/10 text-tx-navy"
                    : "border-tx-gray-light text-tx-gray-dark hover:border-tx-navy"
                }`}
              >
                Card (Simulated)
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("CASH")}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                  paymentType === "CASH"
                    ? "border-tx-sky bg-tx-sky/10 text-tx-navy"
                    : "border-tx-gray-light text-tx-gray-dark hover:border-tx-navy"
                }`}
              >
                Cash on Delivery
              </button>
            </div>

            {/* Oferta activa (15% primera cuenta o promoción semanal vigente) */}
            {activeOffer && (
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-tx-sky/40 bg-tx-sky/10 px-3.5 py-2.5">
                <div>
                  <span className="block text-xs font-bold text-tx-navy">
                    Apply {activeOffer.headline} ({activeOffer.code})
                  </span>
                  <span className="text-[11px] text-tx-teal">
                    {activeOffer.subheadline}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={applyOffer}
                  onChange={(e) => setApplyOffer(e.target.checked)}
                  className="h-4 w-4 accent-tx-sky"
                />
              </label>
            )}

            <div className="space-y-2.5 border-t border-tx-canvas pt-4 text-xs">
              <div className="flex justify-between text-tx-gray-dark">
                <span>
                  Rate (${financialBreakdown.rate.toFixed(2)} &times;{" "}
                  {estimatedHours}h)
                </span>
                <span className="font-semibold text-tx-black">
                  ${financialBreakdown.subtotal.toFixed(2)}
                </span>
              </div>

              {financialBreakdown.discount > 0 && activeOffer && (
                <div className="flex justify-between text-tx-teal">
                  <span>
                    {activeOffer.badgeText} ({activeOffer.code})
                  </span>
                  <span className="font-semibold">
                    -${financialBreakdown.discount.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between border-t border-tx-canvas pt-2.5 text-sm font-extrabold text-tx-black">
                <span>Total to Pay</span>
                <span>${financialBreakdown.totalAmount.toFixed(2)}</span>
              </div>

              <div className="mt-3 space-y-1 rounded-xl bg-tx-canvas p-3 text-[11px] text-tx-gray-dark">
                <p className="font-semibold text-tx-navy">
                  Takunex Commission Breakdown (12%)
                </p>
                <div className="flex justify-between">
                  <span>Platform Fee (12%):</span>
                  <span>${financialBreakdown.platformComission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Provider Net Earnings:</span>
                  <span>${financialBreakdown.providerNetAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedService}
              className="w-full rounded-full bg-tx-sky py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-tx-teal disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Confirming Booking..." : "Confirm & Hire"}
            </button>
          </section>
        </div>
      </form>
    </div>
  );
}