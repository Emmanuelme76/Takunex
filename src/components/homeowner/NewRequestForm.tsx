"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createServiceOrderAction } from "@/actions/booking.actions";
import { ActiveOffer } from "@/lib/offers";

export interface BookableServiceItem {
  id: string;
  title: string;
  description: string;
  categoryName: string;
  rate: number;
}

export interface ProviderReviewItem {
  id: string;
  starRating: number;
  comment: string | null;
  authorName: string;
  feedbackDate: string;
}

export interface BookableProviderItem {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  rating: number;
  totalReviews: number;
  aboutMe: string | null;
  services: BookableServiceItem[];
  reviews: ProviderReviewItem[];
}

interface NewRequestFormProps {
  providers: BookableProviderItem[];
  initialProviderId?: string;
  initialOfferApplied: boolean;
  activeOffer: ActiveOffer | null;
}

interface TimeSlotOption {
  value: string; // "HH:mm"
  label: string; // "08:00 AM"
}

const HALF_HOUR_SLOTS: TimeSlotOption[] = (() => {
  const slots: TimeSlotOption[] = [];
  for (let hour = 7; hour <= 21; hour++) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const label = `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
      slots.push({ value, label });
    }
  }
  return slots;
})();

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    defaultProvider?.services[0]?.id ? [defaultProvider.services[0].id] : []
  );

  const [todayStr, setTodayStr] = useState<string>("");
  const [dateOnly, setDateOnly] = useState<string>("");
  const [timeSlot, setTimeSlot] = useState<string>("09:00");
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

  useEffect(() => {
    setTodayStr(getTodayLocalDateString());
  }, []);

  // Filtrar horarios pasados si la fecha elegida es hoy
  const availableTimeSlots = useMemo(() => {
    if (!dateOnly || !todayStr || dateOnly !== todayStr) {
      return HALF_HOUR_SLOTS;
    }
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return HALF_HOUR_SLOTS.filter((slot) => {
      const [h, m] = slot.value.split(":").map(Number);
      return h * 60 + m > currentMinutes;
    });
  }, [dateOnly, todayStr]);

  // Ajustar automáticamente el horario si el seleccionado ya expiró hoy
  useEffect(() => {
    if (
      availableTimeSlots.length > 0 &&
      !availableTimeSlots.some((s) => s.value === timeSlot)
    ) {
      setTimeSlot(availableTimeSlots[0].value);
    }
  }, [availableTimeSlots, timeSlot]);

  const handleProviderChange = (newProviderId: string) => {
    setSelectedProviderId(newProviderId);
    const nextProvider = providers.find((p) => p.id === newProviderId);
    setSelectedServiceIds(
      nextProvider?.services[0]?.id ? [nextProvider.services[0].id] : []
    );
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const selectedServices = useMemo(
    () =>
      (selectedProvider?.services ?? []).filter((s) =>
        selectedServiceIds.includes(s.id)
      ),
    [selectedProvider, selectedServiceIds]
  );

  const financialBreakdown = useMemo(() => {
    const subtotal = roundMoney(
      selectedServices.reduce((acc, svc) => acc + svc.rate, 0)
    );
    const discount =
      applyOffer && activeOffer
        ? roundMoney(subtotal * activeOffer.discountRate)
        : 0;
    const totalAmount = roundMoney(Math.max(subtotal - discount, 0));
    const commissionRate = 0.12;
    const platformComission = roundMoney(totalAmount * commissionRate);
    const providerNetAmount = roundMoney(totalAmount - platformComission);

    return {
      subtotal,
      discount,
      totalAmount,
      platformComission,
      providerNetAmount,
    };
  }, [selectedServices, applyOffer, activeOffer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProvider || selectedServices.length === 0) {
      setErrorMessage("Please select at least one service to hire.");
      return;
    }

    if (!dateOnly || !timeSlot) {
      setErrorMessage("Please select a valid date and 30-minute time slot.");
      return;
    }

    const scheduledIsoString = `${dateOnly}T${timeSlot}:00`;
    const chosenDate = new Date(scheduledIsoString);

    if (Number.isNaN(chosenDate.getTime()) || chosenDate <= new Date()) {
      setErrorMessage("Please select an upcoming date and time slot.");
      return;
    }

    setIsSubmitting(true);

    const result = await createServiceOrderAction({
      providerId: selectedProvider.id,
      serviceIds: selectedServices.map((s) => s.id),
      scheduledDate: scheduledIsoString,
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

    if (
      paymentType === "CARD" &&
      result.orderIds &&
      result.orderIds.length > 0
    ) {
      router.push(
        `/homeowner/checkout?orders=${encodeURIComponent(result.orderIds.join(","))}`
      );
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
            Configure your services, schedule, and simulated payment method.
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
          {/* Section 1: Provider, Multi-Service Checkboxes & 30-min Schedule */}
          <section className="space-y-5 rounded-2xl bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-tx-black">
              1. Provider, Services &amp; Schedule
            </h2>

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

            {/* Selección múltiple de servicios mediante Checkboxes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="block text-xs font-semibold text-tx-ink">
                  Services to Hire (Select one or more)
                </span>
                <span className="text-[11px] font-medium text-tx-teal">
                  {selectedServices.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {(selectedProvider?.services ?? []).map((svc) => {
                  const isChecked = selectedServiceIds.includes(svc.id);
                  return (
                    <label
                      key={svc.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                        isChecked
                          ? "border-tx-sky bg-tx-sky/10"
                          : "border-tx-gray-light bg-tx-canvas/40 hover:border-tx-navy/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleServiceSelection(svc.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded accent-tx-sky"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-bold text-tx-black">
                            {svc.title}
                          </span>
                          <span className="shrink-0 text-xs font-extrabold text-tx-navy">
                            ${svc.rate.toFixed(2)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-medium text-tx-teal">
                          {svc.categoryName}
                        </p>
                        {svc.description && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-tx-gray-dark">
                            {svc.description}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Fecha futura + Selector bloqueado de 30 en 30 minutos */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="scheduledDateOnly"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  Preferred Date
                </label>
                <input
                  id="scheduledDateOnly"
                  type="date"
                  required
                  min={todayStr}
                  value={dateOnly}
                  onChange={(e) => setDateOnly(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="scheduledTimeSlot"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  Preferred Time
                </label>
                <select
                  id="scheduledTi meSlot"
                  required
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  disabled={availableTimeSlots.length === 0}
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light bg-white px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none disabled:opacity-50"
                >
                  {availableTimeSlots.length === 0 ? (
                    <option value="">No slots left today — choose tomorrow</option>
                  ) : (
                    availableTimeSlots.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
            <p className="-mt-3 text-[11px] text-tx-gray-dark">
              Appointments are scheduled in exact 30-minute intervals (:00 or :30)
              for upcoming dates only.
            </p>
          </section>

          {/* Provider Profile & Reviews Card */}
          {selectedProvider && (
            <section className="space-y-5 rounded-2xl bg-white p-6 shadow-xs">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {selectedProvider.avatarUrl ? (
                  <img
                    src={selectedProvider.avatarUrl}
                    alt={selectedProvider.fullName}
                    className="h-16 w-16 shrink-0 rounded-full border border-tx-gray-light object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-tx-navy text-lg font-bold text-white">
                    {getInitials(selectedProvider.fullName)}
                  </div>
                )}

                <div className="space-y-1">
                  <h2 className="text-lg font-extrabold text-tx-black">
                    {selectedProvider.fullName}
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 text-base leading-none">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={
                            star <= Math.round(selectedProvider.rating)
                              ? "text-tx-star"
                              : "text-tx-gray-light"
                          }
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-sm font-bold text-tx-black">
                      {selectedProvider.rating.toFixed(1)}
                    </span>
                    <span className="text-xs text-tx-gray-dark">
                      ({selectedProvider.totalReviews}{" "}
                      {selectedProvider.totalReviews === 1 ? "review" : "reviews"})
                    </span>
                  </div>
                </div>
              </div>

              {selectedProvider.aboutMe && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-tx-navy">
                    About me
                  </h3>
                  <p className="rounded-xl bg-tx-canvas/70 p-3.5 text-xs leading-relaxed text-tx-ink">
                    {selectedProvider.aboutMe}
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-tx-navy">
                    Reviews
                  </h3>
                  <span className="text-[11px] text-tx-gray-dark">
                    {selectedProvider.reviews.length > 0
                      ? `Showing latest ${selectedProvider.reviews.length}`
                      : "No written reviews yet"}
                  </span>
                </div>

                {selectedProvider.reviews.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-tx-gray-light p-4 text-center text-xs text-tx-gray-dark">
                    This provider has no written client reviews yet.
                  </p>
                ) : (
                  <div className="grid max-h-60 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                    {selectedProvider.reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="rounded-xl border border-tx-gray-light/80 bg-tx-canvas/40 p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-0.5 text-sm">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={
                                  star <= rev.starRating
                                    ? "text-tx-star"
                                    : "text-tx-gray-light"
                                }
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="text-[11px] font-medium text-tx-gray-dark">
                            {rev.authorName}
                          </span>
                        </div>
                        {rev.comment && (
                          <p className="mt-1.5 text-xs italic text-tx-ink">
                            &ldquo;{rev.comment}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 2: Service Location & Job Details */}
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

        {/* Section 3: Payment & Cost Summary */}
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
                Card 
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
              {selectedServices.length === 0 ? (
                <p className="text-tx-gray-dark">No services selected yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedServices.map((svc) => (
                    <div
                      key={svc.id}
                      className="flex justify-between text-tx-gray-dark"
                    >
                      <span className="truncate pr-2">{svc.title}</span>
                      <span className="shrink-0 font-semibold text-tx-black">
                        ${svc.rate.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between border-t border-tx-canvas pt-2 text-tx-gray-dark">
                <span>
                  Subtotal ({selectedServices.length}{" "}
                  {selectedServices.length === 1 ? "service" : "services"})
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
              disabled={isSubmitting || selectedServices.length === 0}
              className="w-full rounded-full bg-tx-sky py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-tx-teal disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Processing..."
                : paymentType === "CARD"
                  ? `Continue to Card Payment (${selectedServices.length})`
                  : `Confirm & Hire (${selectedServices.length})`}
            </button>
          </section>
        </div>
      </form>
    </div>
  );
}