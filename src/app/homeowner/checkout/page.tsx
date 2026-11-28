import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  CardCheckoutForm,
  CheckoutOrderSummary,
} from "@/components/homeowner/CardCheckoutForm";

interface CheckoutPageProps {
  searchParams: Promise<{ orders?: string }>;
}

async function CheckoutContent({ searchParams }: CheckoutPageProps) {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const orderIds = (resolvedParams.orders ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (orderIds.length === 0) {
    redirect("/homeowner/orders");
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    include: { homeowner: { select: { id: true } } },
  });

  if (!dbUser?.homeowner) {
    redirect("/login");
  }

  const orders = await prisma.serviceOrder.findMany({
    where: {
      id: { in: orderIds },
      clientId: dbUser.homeowner.id,
      status: "PENDING",
      transaction: {
        paymentType: "CARD",
        status: "PENDING",
      },
    },
    include: {
      service: { select: { title: true } },
      transaction: { select: { totalAmount: true } },
      provider: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (orders.length === 0) {
    redirect("/homeowner/orders");
  }

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  let grandTotal = 0;
  const summaries: CheckoutOrderSummary[] = orders.map((order) => {
    const amount = Number(order.transaction?.totalAmount ?? 0);
    grandTotal = Math.round((grandTotal + amount + Number.EPSILON) * 100) / 100;

    return {
      id: order.id,
      serviceTitle: order.service.title,
      providerName: `${order.provider.user.firstName} ${order.provider.user.lastName}`.trim(),
      scheduledDateLabel: dateFormatter.format(order.scheduledDate),
      totalAmount: amount,
    };
  });

  return <CardCheckoutForm orders={summaries} grandTotal={grandTotal} />;
}

export default function CheckoutPage({ searchParams }: CheckoutPageProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl animate-pulse space-y-6">
          <div className="h-10 w-64 rounded-xl bg-white" />
          <div className="h-80 rounded-2xl bg-white" />
        </div>
      }
    >
      <CheckoutContent searchParams={searchParams} />
    </Suspense>
  );
}