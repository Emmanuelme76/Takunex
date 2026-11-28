import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  BookableProviderItem,
  NewRequestForm,
} from "@/components/homeowner/NewRequestForm";
import { seedSampleProvidersAction } from "@/actions/booking.actions";
import { resolveHomeownerOffer } from "@/lib/offers";

interface NewRequestPageProps {
  searchParams: Promise<{ providerId?: string; offer?: string }>;
}

async function NewRequestContent({ searchParams }: NewRequestPageProps) {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const providerIdParam = resolvedParams.providerId ?? "";
  const offerAppliedParam = resolvedParams.offer === "applied";

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    include: {
      homeowner: {
        select: { id: true },
      },
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  const nonCancelledOrdersCount = dbUser.homeowner
    ? await prisma.serviceOrder.count({
        where: {
          clientId: dbUser.homeowner.id,
          status: { not: "CANCELLED" },
        },
      })
    : 0;

  const activeOffer = resolveHomeownerOffer(nonCancelledOrdersCount);

  const dbProviders = await prisma.provider.findMany({
    where: {
      user: { status: "ACTIVE" },
      offeredServices: {
        some: { isActive: true },
      },
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      offeredServices: {
        where: { isActive: true },
        include: {
          category: {
            select: { name: true },
          },
        },
      },
      reviewsReceived: {
        where: { isDeleted: false },
        orderBy: { feedbackDate: "desc" },
        take: 6,
        select: {
          id: true,
          starRating: true,
          comment: true,
          feedbackDate: true,
          author: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ rating: "desc" }],
  });

  if (dbProviders.length === 0) {
    async function handleSeed() {
      "use server";
      await seedSampleProvidersAction();
      redirect("/homeowner/new-request");
    }

    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl bg-white p-8 text-center shadow-xs">
        <h1 className="text-xl font-bold text-tx-black">
          No Active Providers in Database Yet
        </h1>
        <p className="text-sm text-tx-gray-dark">
          You clicked <strong>Hire</strong> on a preview provider. Load the
          sample providers and services into PostgreSQL to test real service
          bookings and commission calculations.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <form action={handleSeed}>
            <button
              type="submit"
              className="rounded-full bg-tx-sky px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-tx-teal"
            >
              Load Sample Providers into PostgreSQL
            </button>
          </form>
          <Link
            href="/homeowner/dashboard"
            className="rounded-full border border-tx-gray-light px-5 py-2.5 text-sm font-semibold text-tx-ink hover:bg-tx-canvas"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const bookableProviders: BookableProviderItem[] = dbProviders.map((p) => ({
    id: p.id,
    fullName: `${p.user.firstName} ${p.user.lastName}`.trim(),
    avatarUrl: p.user.avatarUrl,
    rating: p.rating > 0 ? Number(p.rating.toFixed(1)) : 5.0,
    totalReviews: p.totalReviews,
    aboutMe: p.aboutMe,
    services: p.offeredServices.map((svc) => ({
      id: svc.id,
      title: svc.title,
      description: svc.description,
      categoryName: svc.category.name,
      rate: Number(svc.hourlyRate),
    })),
    reviews: p.reviewsReceived.map((rev) => ({
      id: rev.id,
      starRating: rev.starRating,
      comment: rev.comment,
      authorName: `${rev.author.user.firstName} ${rev.author.user.lastName}`.trim(),
      feedbackDate: rev.feedbackDate.toISOString(),
    })),
  }));

  return (
    <NewRequestForm
      providers={bookableProviders}
      initialProviderId={providerIdParam}
      initialOfferApplied={offerAppliedParam}
      activeOffer={activeOffer}
    />
  );
}

export default function NewRequestPage({
  searchParams,
}: NewRequestPageProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-12 w-64 rounded-xl bg-white" />
          <div className="h-96 rounded-2xl bg-white" />
        </div>
      }
    >
      <NewRequestContent searchParams={searchParams} />
    </Suspense>
  );
}