"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma"; // Ajusta si tu instancia está en @/lib/db
import { createClient } from "@/lib/supabase/server";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function getAuthenticatedHomeowner() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    include: { homeowner: true },
  });

  if (!dbUser || !dbUser.homeowner) {
    return null;
  }

  return dbUser.homeowner;
}

export async function cancelHomeownerOrder(
  orderId: string
): Promise<ActionResult> {
  try {
    if (!orderId) {
      return { ok: false, error: "Invalid order ID." };
    }

    const homeowner = await getAuthenticatedHomeowner();
    if (!homeowner) {
      return { ok: false, error: "Unauthorized. Please log in again." };
    }

    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: { transaction: true },
    });

    if (!order || order.clientId !== homeowner.id) {
      return { ok: false, error: "Order not found." };
    }

    if (order.status !== "PENDING") {
      return {
        ok: false,
        error: "You can only cancel orders that are still pending.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.serviceOrder.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });

      if (order.transaction && order.transaction.paymentType === "CARD") {
        await tx.paymentTransaction.update({
          where: { id: order.transaction.id },
          data: { status: "REFUNDED" },
        });
      }
    });

    revalidatePath("/homeowner/orders");
    revalidatePath("/homeowner/history");
    revalidatePath("/homeowner/dashboard");

    return { ok: true };
  } catch (err) {
    console.error("[cancelHomeownerOrder]", err);
    return {
      ok: false,
      error: "An error occurred while cancelling the order. Please try again.",
    };
  }
}

export interface SubmitReviewInput {
  orderId: string;
  starRating: number;
  comment?: string;
}

export async function submitOrderReview(
  input: SubmitReviewInput
): Promise<ActionResult> {
  try {
    const rating = Math.round(input.starRating);
    if (!input.orderId || rating < 1 || rating > 5) {
      return {
        ok: false,
        error: "Please select a valid rating between 1 and 5 stars.",
      };
    }

    const homeowner = await getAuthenticatedHomeowner();
    if (!homeowner) {
      return { ok: false, error: "Unauthorized. Please log in again." };
    }

    const order = await prisma.serviceOrder.findUnique({
      where: { id: input.orderId },
      include: { review: true },
    });

    if (!order || order.clientId !== homeowner.id) {
      return { ok: false, error: "Order not found." };
    }

    if (order.status !== "COMPLETED") {
      return {
        ok: false,
        error: "You can only review services that have been completed.",
      };
    }

    if (order.review && !order.review.isDeleted) {
      return {
        ok: false,
        error: "You have already submitted a review for this service.",
      };
    }

    const cleanComment = input.comment?.trim() || null;

    await prisma.$transaction(async (tx) => {
      if (order.review && order.review.isDeleted) {
        await tx.review.update({
          where: { id: order.review.id },
          data: {
            starRating: rating,
            comment: cleanComment,
            isDeleted: false,
            feedbackDate: new Date(),
          },
        });
      } else {
        await tx.review.create({
          data: {
            orderId: order.id,
            authorId: homeowner.id,
            targetId: order.providerId,
            starRating: rating,
            comment: cleanComment,
          },
        });
      }

      const stats = await tx.review.aggregate({
        where: {
          targetId: order.providerId,
          isDeleted: false,
        },
        _avg: { starRating: true },
        _count: { id: true },
      });

      const averageRating = Number((stats._avg.starRating ?? 0).toFixed(2));
      const totalReviews = stats._count.id;

      await tx.provider.update({
        where: { id: order.providerId },
        data: {
          rating: averageRating,
          totalReviews,
        },
      });
    });

    revalidatePath("/homeowner/history");
    revalidatePath("/homeowner/dashboard");

    return { ok: true };
  } catch (err) {
    console.error("[submitOrderReview]", err);
    return {
      ok: false,
      error: "Could not save your review. Please try again.",
    };
  }
}