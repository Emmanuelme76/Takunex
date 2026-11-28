import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  HomeownerProfileClient,
  ProfileReviewItem,
  SavedCardItem,
} from "@/components/homeowner/HomeownerProfileClient";

function formatReviewDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

async function ProfileContent() {
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
      homeowner: {
        include: {
          savedPaymentMethods: {
            include: { cardDetails: true },
          },
          reviewsWritten: {
            where: { isDeleted: false },
            orderBy: { feedbackDate: "desc" },
            include: {
              order: {
                select: {
                  service: { select: { title: true } },
                },
              },
              target: {
                select: {
                  user: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              hiredServicesHistory: true,
              reviewsWritten: { where: { isDeleted: false } },
            },
          },
        },
      },
      provider: {
        include: {
          reviewsReceived: {
            where: { isDeleted: false },
            orderBy: { feedbackDate: "desc" },
            include: {
              order: {
                select: {
                  service: { select: { title: true } },
                },
              },
              author: {
                select: {
                  user: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  const completedOrders = dbUser.homeowner
    ? await prisma.serviceOrder.count({
        where: {
          clientId: dbUser.homeowner.id,
          status: "COMPLETED",
        },
      })
    : 0;

  const savedCards: SavedCardItem[] = (
    dbUser.homeowner?.savedPaymentMethods ?? []
  )
    .filter((pm) => pm.type === "CARD" && pm.cardDetails)
    .map((pm) => ({
      id: pm.id,
      isDefault: pm.isDefault,
      cardholderName: pm.cardDetails!.cardholderName,
      last4Digits: pm.cardDetails!.last4Digits,
      cardBrand: pm.cardDetails!.cardBrand,
      expirationDate: pm.cardDetails!.expirationDate,
    }));

  const reviewsWrittenList: ProfileReviewItem[] = (
    dbUser.homeowner?.reviewsWritten ?? []
  ).map((rev) => ({
    id: rev.id,
    starRating: rev.starRating,
    comment: rev.comment,
    feedbackDateLabel: formatReviewDate(rev.feedbackDate),
    serviceTitle: rev.order.service.title,
    counterpartyName:
      `${rev.target.user.firstName} ${rev.target.user.lastName}`.trim(),
  }));

  const reviewsReceivedList: ProfileReviewItem[] = (
    dbUser.provider?.reviewsReceived ?? []
  ).map((rev) => ({
    id: rev.id,
    starRating: rev.starRating,
    comment: rev.comment,
    feedbackDateLabel: formatReviewDate(rev.feedbackDate),
    serviceTitle: rev.order.service.title,
    counterpartyName:
      `${rev.author.user.firstName} ${rev.author.user.lastName}`.trim(),
  }));

  return (
    <HomeownerProfileClient
      user={{
        id: dbUser.id,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        email: dbUser.email,
        phoneNumber: dbUser.phoneNumber ?? "",
        avatarUrl: dbUser.avatarUrl,
        emailVerified: dbUser.emailVerified,
        phoneVerified: dbUser.phoneVerified,
        activeRole: dbUser.role,
        hasProviderProfile: Boolean(dbUser.provider),
        providerRating: dbUser.provider?.rating ?? 0,
        providerTotalReviews: dbUser.provider?.totalReviews ?? 0,
      }}
      stats={{
        totalOrders: dbUser.homeowner?._count.hiredServicesHistory ?? 0,
        completedOrders,
        reviewsWritten: dbUser.homeowner?._count.reviewsWritten ?? 0,
      }}
      savedCards={savedCards}
      reviewsWrittenList={reviewsWrittenList}
      reviewsReceivedList={reviewsReceivedList}
    />
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl animate-pulse space-y-6">
          <div className="h-32 rounded-2xl bg-white" />
          <div className="h-64 rounded-2xl bg-white" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}