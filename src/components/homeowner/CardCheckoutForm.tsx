"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirmSimulatedCardPaymentAction } from "@/actions/booking.actions";

export interface CheckoutOrderSummary {
  id: string;
  serviceTitle: string;
  providerName: string;
  scheduledDateLabel: string;
  totalAmount: number;
}

interface CardCheckoutFormProps {
  orders: CheckoutOrderSummary[];
  grandTotal: number;
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

export function CardCheckoutForm({
  orders,
  grandTotal,
}: CardCheckoutFormProps) {
  const router = useRouter();
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const rawDigits = cardNumber.replace(/\D/g, "");
  const last4 = rawDigits.length >= 4 ? rawDigits.slice(-4) : "••••";

  const handleOpenConfirmModal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!cardholderName.trim()) {
      setFormError("Please enter the cardholder name.");
      return;
    }

    if (rawDigits.length < 15 || rawDigits.length > 16) {
      setFormError("Please enter a valid 15 or 16-digit card number.");
      return;
    }

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
      setFormError("Please enter a valid expiration date (MM/YY).");
      return;
    }

    const cleanCvv = cvv.replace(/\D/g, "");
    if (cleanCvv.length < 3 || cleanCvv.length > 4) {
      setFormError("Please enter a valid 3 or 4-digit CVV.");
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmPayment = () => {
    setFormError(null);
    startTransition(async () => {
      const result = await confirmSimulatedCardPaymentAction({
        orderIds: orders.map((o) => o.id),
        cardholderName,
        cardNumber,
        expiry,
        cvv,
      });

      if (!result.success) {
        setIsConfirmModalOpen(false);
        setFormError(result.error ?? "Payment could not be processed.");
        return;
      }

      router.push("/homeowner/orders?created=1");
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/homeowner/orders"
          className="text-xs font-semibold text-tx-sky hover:underline"
        >
          &larr; View Pending Orders
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold text-tx-black">
          Simulated Card Checkout
        </h1>
        <p className="text-sm text-tx-gray-dark">
          Enter simulated card details to complete your booking payment. No real
          charges will be made.
        </p>
      </div>

      {formError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
          role="alert"
        >
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna izquierda: Vista previa de tarjeta + Formulario */}
        <div className="space-y-6 lg:col-span-2">
          {/* Tarjeta visual simulada */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-tx-ink via-tx-navy to-tx-teal p-6 text-white shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-white/80">
                Takunex Pay • Simulated
              </span>
              <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold">
                {rawDigits.startsWith("4")
                  ? "VISA"
                  : rawDigits.startsWith("5")
                    ? "MASTERCARD"
                    : "CARD"}
              </span>
            </div>

            <div className="mt-8 font-mono text-xl tracking-widest sm:text-2xl">
              {cardNumber || "•••• •••• •••• ••••"}
            </div>

            <div className="mt-6 flex items-end justify-between text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/70">
                  Cardholder
                </p>
                <p className="mt-0.5 font-semibold uppercase">
                  {cardholderName.trim() || "YOUR FULL NAME"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-white/70">
                  Expires
                </p>
                <p className="mt-0.5 font-mono font-semibold">
                  {expiry || "MM/YY"}
                </p>
              </div>
            </div>
          </div>

          {/* Formulario de captura */}
          <form
            onSubmit={handleOpenConfirmModal}
            className="space-y-4 rounded-2xl bg-white p-6 shadow-xs"
          >
            <h2 className="text-base font-bold text-tx-black">
              Card Information
            </h2>

            <div>
              <label
                htmlFor="cardholderName"
                className="block text-xs font-semibold text-tx-ink"
              >
                Cardholder Name
              </label>
              <input
                id="cardholderName"
                type="text"
                required
                autoComplete="cc-name"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                placeholder="Yahir Alejandro"
                className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black placeholder-tx-gray-muted focus:border-tx-sky focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cardNumber"
                className="block text-xs font-semibold text-tx-ink"
              >
                Card Number
              </label>
              <input
                id="cardNumber"
                type="text"
                inputMode="numeric"
                required
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(e) =>
                  setCardNumber(formatCardNumber(e.target.value))
                }
                placeholder="4532 0151 1283 0366"
                className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 font-mono text-sm text-tx-black placeholder-tx-gray-muted focus:border-tx-sky focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="expiry"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  Expiration Date (MM/YY)
                </label>
                <input
                  id="expiry"
                  type="text"
                  inputMode="numeric"
                  required
                  autoComplete="cc-exp"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="09/29"
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 font-mono text-sm text-tx-black placeholder-tx-gray-muted focus:border-tx-sky focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="cvv"
                  className="block text-xs font-semibold text-tx-ink"
                >
                  Security Code (CVV)
                </label>
                <input
                  id="cvv"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  autoComplete="cc-csc"
                  value={cvv}
                  onChange={(e) =>
                    setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="123"
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 font-mono text-sm text-tx-black placeholder-tx-gray-muted focus:border-tx-sky focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full rounded-full bg-tx-sky py-3 text-sm font-bold text-white shadow-xs transition hover:bg-tx-teal cursor-pointer"
              >
                Pay ${grandTotal.toFixed(2)} Now
              </button>
            </div>
          </form>
        </div>

        {/* Columna derecha: Resumen de órdenes a pagar */}
        <div>
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-tx-black">
              Booking Summary
            </h2>

            <p className="text-xs text-tx-gray-dark">
              Provider:{" "}
              <span className="font-semibold text-tx-ink">
                {orders[0]?.providerName}
              </span>
              <br />
              Scheduled:{" "}
              <span className="font-semibold text-tx-ink">
                {orders[0]?.scheduledDateLabel}
              </span>
            </p>

            <div className="space-y-2 border-t border-tx-canvas pt-3 text-xs">
              {orders.map((ord) => (
                <div key={ord.id} className="flex justify-between gap-2">
                  <span className="text-tx-ink">{ord.serviceTitle}</span>
                  <span className="shrink-0 font-semibold text-tx-black">
                    ${ord.totalAmount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between border-t border-tx-canvas pt-3 text-base font-extrabold text-tx-navy">
              <span>Total Charge</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </section>
        </div>
      </div>

      {/* Modal de Confirmación ("¿Estás seguro de continuar?") */}
      {isConfirmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-tx-ink/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-payment-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-tx-gray-light bg-white p-6 shadow-xl">
            <h3
              id="confirm-payment-modal-title"
              className="text-lg font-extrabold text-tx-ink"
            >
              Confirm Simulated Payment
            </h3>
            <p className="mt-2 text-sm text-tx-gray-dark">
              Are you sure you want to proceed with this simulated payment of{" "}
              <span className="font-bold text-tx-navy">
                ${grandTotal.toFixed(2)}
              </span>{" "}
              using card ending in{" "}
              <span className="font-mono font-bold text-tx-ink">{last4}</span>?
            </p>

            <div className="mt-4 rounded-xl bg-tx-canvas/80 p-3 text-xs text-tx-ink">
              <p className="font-semibold text-tx-navy">
                What happens next:
              </p>
              <p className="mt-1 text-tx-gray-dark">
                Your order will be marked as paid and sent immediately to{" "}
                <span className="font-semibold text-tx-ink">
                  {orders[0]?.providerName}
                </span>
                .
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsConfirmModalOpen(false)}
                className="rounded-lg border border-tx-gray-light bg-white px-4 py-2 text-sm font-medium text-tx-ink transition hover:bg-tx-canvas disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmPayment}
                className="rounded-lg bg-tx-sky px-5 py-2 text-sm font-bold text-white transition hover:bg-tx-teal disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Processing..." : "Yes, continue & pay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}