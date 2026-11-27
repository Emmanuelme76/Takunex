"use client";

import { useState, useTransition } from "react";
import { submitOrderReview } from "@/actions/order.actions";

interface ReviewModalButtonProps {
  orderId: string;
  serviceTitle: string;
  providerName: string;
}

export function ReviewModalButton({
  orderId,
  serviceTitle,
  providerName,
}: ReviewModalButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const result = await submitOrderReview({
        orderId,
        starRating: rating,
        comment,
      });

      if (!result.ok) {
        setErrorMsg(result.error);
      } else {
        setIsOpen(false);
        setComment("");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-tx-sky px-4 py-2 text-sm font-semibold text-white transition hover:bg-tx-teal cursor-pointer"
      >
        Rate service
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-tx-ink/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`review-modal-title-${orderId}`}
        >
          <div className="w-full max-w-md rounded-2xl border border-tx-gray-light bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id={`review-modal-title-${orderId}`}
                  className="text-lg font-bold text-tx-ink"
                >
                  Rate your experience
                </h3>
                <p className="mt-0.5 text-xs text-tx-gray-dark">
                  {serviceTitle} • with{" "}
                  <span className="font-semibold text-tx-ink">
                    {providerName}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
                className="rounded-md px-2 py-1 text-sm font-bold text-tx-gray-dark hover:bg-tx-canvas hover:text-tx-ink cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-tx-gray-dark">
                  Rating
                </label>
                <div className="mt-2 flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoveredRating || rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="text-3xl leading-none transition-transform hover:scale-110 cursor-pointer"
                        aria-label={`${star} stars`}
                      >
                        <span
                          className={
                            active ? "text-tx-star" : "text-tx-gray-light"
                          }
                        >
                          ★
                        </span>
                      </button>
                    );
                  })}
                  <span className="ml-2 text-sm font-semibold text-tx-navy">
                    {rating} / 5
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor={`comment-${orderId}`}
                  className="block text-xs font-semibold uppercase tracking-wide text-tx-gray-dark"
                >
                  Comment (optional)
                </label>
                <textarea
                  id={`comment-${orderId}`}
                  rows={3}
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was the punctuality, cleanliness, and quality of work?"
                  className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-ink placeholder:text-tx-gray-muted focus:border-tx-sky focus:outline-none"
                />
              </div>

              {errorMsg && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {errorMsg}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-tx-gray-light bg-white px-4 py-2 text-sm font-medium text-tx-ink transition hover:bg-tx-canvas disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-tx-sky px-5 py-2 text-sm font-semibold text-white transition hover:bg-tx-teal disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Saving..." : "Submit review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}