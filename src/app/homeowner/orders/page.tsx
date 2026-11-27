import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { OrderCancelButton } from "@/components/homeowner/OrderCancelButton";

interface OrdersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const STATUS_BADGE: Record<
  Exclude<OrderStatus, "COMPLETED" | "CANCELLED">,
  { label: string; classes: string }
> = {
  PENDING: {
    label: "Pending confirmation",
    classes: "bg-amber-100 text-amber-800 border-amber-200",
  },
  ACCEPTED: {
    label: "Accepted by provider",
    classes: "bg-sky-100 text-tx-navy border-sky-200",
  },
  IN_PROGRESS: {
    label: "In progress",
    classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function OrdersContent({ searchParams }: OrdersPageProps) {
  await connection();

  const resolvedParams = await searchParams;
  const isJustCreated = resolvedParams.created === "1";

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

  const activeOrders = await prisma.serviceOrder.findMany({
    where: {
      clientId: dbUser.homeowner.id,
      status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
    },
    include: {
      service: true,
      location: true,
      transaction: true,
      provider: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tx-ink">Active Orders</h1>
          <p className="text-sm text-tx-gray-dark">
            Track your pending requests and ongoing home services.
          </p>
        </div>

        <Link
          href="/homeowner/dashboard"
          className="rounded-lg bg-tx-sky px-4 py-2 text-sm font-semibold text-white transition hover:bg-tx-teal"
        >
          + Hire a service
        </Link>
      </div>

      {/* Confirmation banner after hiring (?created=1) */}
      {isJustCreated && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-tx-sky/40 bg-sky-50 p-4 text-tx-navy shadow-xs">
          <div className="space-y-1">
            <p className="text-sm font-bold">
              Request submitted successfully!
            </p>
            <p className="text-xs text-tx-navy/80">
              Your order has been registered and the provider has been notified.
              You can cancel it at no cost while it remains{" "}
              <span className="font-semibold">Pending</span>.
            </p>
          </div>
          <Link
            href="/homeowner/orders"
            className="shrink-0 text-xs font-semibold text-tx-sky hover:text-tx-teal"
          >
            Dismiss
          </Link>
        </div>
      )}

      {activeOrders.length === 0 ? (
        <div className="rounded-2xl border border-tx-gray-light bg-white p-10 text-center shadow-xs">
          <h2 className="text-lg font-semibold text-tx-ink">
            No active orders
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-tx-gray-dark">
            Browse top providers near you and schedule your next home service.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href="/homeowner/dashboard"
              className="rounded-lg bg-tx-sky px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-tx-teal"
            >
              Explore providers
            </Link>
            <Link
              href="/homeowner/history"
              className="rounded-lg border border-tx-gray-light bg-white px-5 py-2.5 text-sm font-medium text-tx-ink transition hover:bg-tx-canvas"
            >
              View history
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {activeOrders.map((order) => {
            const badge =
              STATUS_BADGE[
                order.status as Exclude<OrderStatus, "COMPLETED" | "CANCELLED">
              ];
            const providerFullName = `${order.provider.user.firstName} ${order.provider.user.lastName}`;
            const totalAmount = order.transaction
              ? Number(order.transaction.totalAmount)
              : null;

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-tx-gray-light bg-white p-5 shadow-xs transition hover:border-tx-sky/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-tx-gray-light/70 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-lg font-bold text-tx-ink">
                        {/* Ajusta .title si en tu ProviderService el campo se llama .name */}
                        {order.service.title}
                      </h2>
                      <span
                        className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-tx-gray-dark">
                      Order ID:{" "}
                      <span className="font-mono">{order.id.slice(0, 8)}</span>{" "}
                      • Created on {formatDate(order.createdAt)}
                    </p>
                  </div>

                  {totalAmount !== null && order.transaction && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-tx-navy">
                        {formatCurrency(totalAmount)}
                      </p>
                      <p className="text-xs text-tx-gray-dark">
                        Payment:{" "}
                        <span className="font-medium text-tx-ink">
                          {order.transaction.paymentType === "CARD"
                            ? "Card"
                            : "Cash"}
                        </span>{" "}
                        ({order.transaction.status})
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-tx-gray-muted">
                      Provider
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-tx-ink">
                      {providerFullName}
                    </p>
                    <p className="text-xs text-tx-gray-dark">
                      <span className="text-tx-star">★</span>{" "}
                      {order.provider.rating.toFixed(1)} (
                      {order.provider.totalReviews} reviews)
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-tx-gray-muted">
                      Scheduled date
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-tx-ink">
                      {formatDate(order.scheduledDate)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-tx-gray-muted">
                      Service address
                    </p>
                    <p className="mt-0.5 text-sm text-tx-ink">
                      {/* Ajusta .address si en tu Location el campo se llama .street / .city */}
                      {order.location.address}
                    </p>
                  </div>
                </div>

                {order.description && (
                  <div className="mt-4 rounded-lg bg-tx-canvas/70 px-3.5 py-2.5 text-xs text-tx-ink">
                    <span className="font-semibold">Notes: </span>
                    {order.description}
                  </div>
                )}

                {order.status === "PENDING" && (
                  <div className="mt-4 flex justify-end border-t border-tx-gray-light/70 pt-4">
                    <OrderCancelButton
                      orderId={order.id}
                      paymentType={order.transaction?.paymentType ?? null}
                    />
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

function OrdersSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-tx-gray-light" />
      <div className="h-44 animate-pulse rounded-2xl bg-white" />
      <div className="h-44 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}

export default function OrdersPage(props: OrdersPageProps) {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersContent {...props} />
    </Suspense>
  );
}