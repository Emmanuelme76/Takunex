"use client";

import { useState, useTransition } from "react";
import { cancelHomeownerOrder } from "@/actions/order.actions";

interface OrderCancelButtonProps {
  orderId: string;
  paymentType: "CARD" | "CASH" | null;
}

export function OrderCancelButton({
  orderId,
  paymentType,
}: OrderCancelButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConfirmCancel = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await cancelHomeownerOrder(orderId);
      if (!result.ok) {
        setErrorMsg(result.error);
      } else {
        setConfirming(false);
      }
    });
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 cursor-pointer"
      >
        Cancel request
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2 rounded-lg border border-red-200 bg-red-50/70 p-3 text-right">
      <p className="text-xs font-medium text-red-800">
        Are you sure you want to cancel this order?
        {paymentType === "CARD" &&
          " Card payments will be automatically marked as refunded."}
      </p>

      {errorMsg && (
        <p className="text-xs font-medium text-red-600">{errorMsg}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setConfirming(false);
            setErrorMsg(null);
          }}
          className="rounded-md border border-tx-gray-light bg-white px-3 py-1.5 text-xs font-medium text-tx-black transition hover:bg-tx-canvas disabled:opacity-50 cursor-pointer"
        >
          Keep order
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleConfirmCancel}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 cursor-pointer"
        >
          {isPending ? "Cancelling..." : "Yes, cancel"}
        </button>
      </div>
    </div>
  );
}