import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ReviewModalButton } from "@/components/homeowner/ReviewModalButton";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

async function HistoryContent() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    include: { homeowner: true },
  });

  if (!dbUser?.homeowner) {
    redirect("/login");
  }

  const pastOrders = await prisma.serviceOrder.findMany({
    where: {
      clientId: dbUser.homeowner.id,
      status: { in: ["COMPLETED", "CANCELLED"] },
    },
    include: {
      service: true,
      transaction: true,
      review: true,
      provider: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tx-ink">Service History</h1>
        <p className="text-sm text-tx-gray-dark">
          View your completed or cancelled services and share feedback with the
          community.
        </p>
      </div>

      {pastOrders.length === 0 ? (
        <div className="rounded-2xl border border-tx-gray-light bg-white p-10 text-center shadow-xs">
          <h2 className="text-lg font-semibold text-tx-ink">
            No service history yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-tx-gray-dark">
            Once your orders are completed or cancelled, they will appear here.
          </p>
          <Link
            href="/homeowner/orders"
            className="mt-5 inline-block rounded-lg bg-tx-sky px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-tx-teal"
          >
            Go to active orders
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {pastOrders.map((order) => {
            const isCompleted = order.status === "COMPLETED";
            const providerName = `${order.provider.user.firstName} ${order.provider.user.lastName}`;
            const hasActiveReview = Boolean(
              order.review && !order.review.isDeleted
            );
            const totalAmount = order.transaction
              ? Number(order.transaction.totalAmount)
              : null;

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-tx-gray-light bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-lg font-bold text-tx-ink">
                        {/* Ajusta .title si en tu ProviderService el campo se llama .name */}
                        {order.service.title}
                      </h2>
                      <span
                        className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${
                          isCompleted
                            ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                            : "border-red-200 bg-red-100 text-red-700"
                        }`}
                      >
                        {isCompleted ? "Completed" : "Cancelled"}
                      </span>
                    </div>

                    <p className="text-sm text-tx-gray-dark">
                      Provider:{" "}
                      <span className="font-semibold text-tx-ink">
                        {providerName}
                      </span>{" "}
                      • Service date: {formatDate(order.scheduledDate)}
                    </p>
                  </div>

                  {totalAmount !== null && order.transaction && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-tx-navy">
                        {formatCurrency(totalAmount)}
                      </p>
                      <p className="text-xs text-tx-gray-dark">
                        {order.transaction.paymentType === "CARD"
                          ? "Card"
                          : "Cash"}{" "}
                        • {order.transaction.status}
                      </p>
                    </div>
                  )}
                </div>

                {/* Review section for COMPLETED orders */}
                {isCompleted && (
                  <div className="mt-4 border-t border-tx-gray-light/70 pt-4">
                    {hasActiveReview && order.review ? (
                      <div className="rounded-xl bg-tx-canvas/70 p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-base">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={
                                  star <= order.review!.starRating
                                    ? "text-tx-star"
                                    : "text-tx-gray-light"
                                }
                              >
                                ★
                              </span>
                            ))}
                            <span className="ml-1.5 text-xs font-semibold text-tx-ink">
                              Your rating ({order.review.starRating}/5)
                            </span>
                          </div>
                          <span className="text-xs text-tx-gray-dark">
                            {formatDate(order.review.feedbackDate)}
                          </span>
                        </div>

                        {order.review.comment && (
                          <p className="mt-1.5 text-sm text-tx-ink">
                            &ldquo;{order.review.comment}&rdquo;
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-tx-gray-dark">
                          How did {providerName} do? Your review helps other
                          homeowners.
                        </p>
                        <ReviewModalButton
                          orderId={order.id}
                          serviceTitle={order.service.title}
                          providerName={providerName}
                        />
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-tx-gray-light" />
      <div className="h-40 animate-pulse rounded-2xl bg-white" />
      <div className="h-40 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <HistoryContent />
    </Suspense>
  );
}