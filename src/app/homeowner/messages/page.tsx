import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/homeowner.actions";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function MessagesContent() {
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
    include: {
      homeowner: { select: { id: true } },
      notifications: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  const activeOrders = dbUser.homeowner
    ? await prisma.serviceOrder.findMany({
        where: {
          clientId: dbUser.homeowner.id,
          status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
        },
        include: {
          service: { select: { title: true } },
          provider: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const unreadCount = dbUser.notifications.filter((n) => !n.isRead).length;

  async function handleMarkAllRead() {
    "use server";
    await markAllNotificationsReadAction();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-tx-black">
            Messages &amp; Alerts
          </h1>
          <p className="text-sm text-tx-gray-dark">
            Order updates, payment receipts, and direct contact with your active
            providers.
          </p>
        </div>

        {unreadCount > 0 && (
          <form action={handleMarkAllRead}>
            <button
              type="submit"
              className="rounded-full bg-tx-navy px-4 py-2 text-xs font-bold text-white transition hover:bg-tx-ink cursor-pointer"
            >
              Mark all as read ({unreadCount})
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna izquierda: Bandeja de Notificaciones */}
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-tx-navy">
            Activity Feed ({dbUser.notifications.length})
          </h2>

          {dbUser.notifications.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-xs">
              <p className="text-base font-bold text-tx-ink">
                No notifications yet
              </p>
              <p className="mt-1 text-xs text-tx-gray-dark">
                Booking confirmations, receipts, and status updates will appear
                here.
              </p>
            </div>
          ) : (
            dbUser.notifications.map((notif) => {
              async function handleMarkOneRead() {
                "use server";
                await markNotificationReadAction(notif.id);
              }

              return (
                <article
                  key={notif.id}
                  className={`rounded-2xl border p-4 shadow-xs transition ${
                    notif.isRead
                      ? "border-tx-gray-light/70 bg-white"
                      : "border-tx-sky bg-sky-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {!notif.isRead && (
                          <span className="h-2 w-2 rounded-full bg-tx-sky" />
                        )}
                        <h3 className="text-sm font-bold text-tx-ink">
                          {notif.title}
                        </h3>
                      </div>
                      <p className="text-xs leading-relaxed text-tx-gray-dark">
                        {notif.message}
                      </p>
                      <p className="pt-1 text-[11px] text-tx-gray-muted">
                        {formatDateTime(notif.createdAt)}
                      </p>
                    </div>

                    {!notif.isRead && (
                      <form action={handleMarkOneRead}>
                        <button
                          type="submit"
                          className="shrink-0 text-xs font-semibold text-tx-sky hover:underline cursor-pointer"
                        >
                          Mark read
                        </button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Columna derecha: Contacto directo con proveedores de órdenes activas */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-tx-navy">
            Active Service Contacts
          </h2>

          {activeOrders.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center shadow-xs">
              <p className="text-xs text-tx-gray-dark">
                No active bookings right now. Hire a provider to unlock direct
                contact details.
              </p>
              <Link
                href="/homeowner/dashboard"
                className="mt-3 inline-block rounded-full bg-tx-sky px-4 py-2 text-xs font-bold text-white hover:bg-tx-teal"
              >
                Find Providers
              </Link>
            </div>
          ) : (
            activeOrders.map((ord) => {
              const pUser = ord.provider.user;
              const fullName = `${pUser.firstName} ${pUser.lastName}`.trim();
              return (
                <div
                  key={ord.id}
                  className="space-y-2 rounded-2xl bg-white p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-tx-ink">{fullName}</p>
                    <span className="rounded-full bg-tx-canvas px-2.5 py-0.5 text-[10px] font-bold text-tx-navy">
                      {ord.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-tx-teal">
                    {ord.service.title}
                  </p>
                  <div className="space-y-1 border-t border-tx-canvas pt-2 text-xs text-tx-gray-dark">
                    <p>
                      <span className="font-semibold text-tx-ink">Email:</span>{" "}
                      {pUser.email}
                    </p>
                    <p>
                      <span className="font-semibold text-tx-ink">Phone:</span>{" "}
                      {pUser.phoneNumber ?? "Not provided"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-10 w-64 rounded-xl bg-white" />
          <div className="h-72 rounded-2xl bg-white" />
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}