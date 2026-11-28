"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { PaymentMethodType } from "@prisma/client";
import { resolveHomeownerOffer } from "@/lib/offers";

const PLATFORM_COMMISSION_RATE = 0.12; // 12% (rango de negocio: 10% - 15%)

export interface CreateServiceOrderInput {
  providerId: string;
  serviceIds: string[];
  scheduledDate: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  description: string;
  paymentType: "CARD" | "CASH";
  applyOffer: boolean;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  orderId?: string;
  orderIds?: string[];
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function createServiceOrderAction(
  input: CreateServiceOrderInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: "Your session expired. Please sign in again.",
      };
    }

    const uniqueServiceIds = Array.from(new Set(input.serviceIds ?? []));
    if (!input.providerId || uniqueServiceIds.length === 0) {
      return {
        success: false,
        error: "Please select a provider and at least one service.",
      };
    }

    if (!input.address.trim() || !input.city.trim()) {
      return {
        success: false,
        error: "Service address and city are required.",
      };
    }

    const scheduled = new Date(input.scheduledDate);
    if (Number.isNaN(scheduled.getTime()) || scheduled <= new Date()) {
      return {
        success: false,
        error: "Please choose a valid future date and time for the service.",
      };
    }

    const minutes = scheduled.getMinutes();
    if (minutes !== 0 && minutes !== 30) {
      return {
        success: false,
        error:
          "Appointments can only be booked in 30-minute intervals (:00 or :30).",
      };
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      include: {
        homeowner: {
          select: { id: true },
        },
      },
    });

    if (!dbUser) {
      return { success: false, error: "User profile not found in database." };
    }

    const homeowner =
      dbUser.homeowner ??
      (await prisma.homeowner.create({
        data: { userId: dbUser.id },
        select: { id: true },
      }));

    const nonCancelledOrdersCount = await prisma.serviceOrder.count({
      where: {
        clientId: homeowner.id,
        status: { not: "CANCELLED" },
      },
    });

    const activeOffer = resolveHomeownerOffer(nonCancelledOrdersCount);

    const services = await prisma.providerService.findMany({
      where: {
        id: { in: uniqueServiceIds },
        providerId: input.providerId,
        isActive: true,
        provider: {
          user: { status: "ACTIVE" },
        },
      },
      include: {
        provider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (services.length !== uniqueServiceIds.length) {
      return {
        success: false,
        error:
          "One or more selected services or the provider are currently unavailable.",
      };
    }

    const providerUser = services[0].provider.user;
    const discountRate =
      input.applyOffer && activeOffer ? activeOffer.discountRate : 0;

    const paymentEnum: PaymentMethodType =
      input.paymentType === "CASH" ? "CASH" : "CARD";

    const createdOrderIds = await prisma.$transaction(async (tx) => {
      const orderIds: string[] = [];
      let grandTotal = 0;
      let totalPlatformCommission = 0;
      let totalProviderNet = 0;

      for (const service of services) {
        const basePrice = roundMoney(Number(service.hourlyRate));
        const discountAmount = roundMoney(basePrice * discountRate);
        const totalAmount = roundMoney(Math.max(basePrice - discountAmount, 0));
        const platformComission = roundMoney(
          totalAmount * PLATFORM_COMMISSION_RATE
        );
        const providerNetAmount = roundMoney(totalAmount - platformComission);

        grandTotal = roundMoney(grandTotal + totalAmount);
        totalPlatformCommission = roundMoney(
          totalPlatformCommission + platformComission
        );
        totalProviderNet = roundMoney(totalProviderNet + providerNetAmount);

        const location = await tx.location.create({
          data: {
            address: input.address.trim(),
            city: input.city.trim(),
            state: input.state.trim() || null,
            zipCode: input.zipCode.trim() || null,
          },
        });

        const order = await tx.serviceOrder.create({
          data: {
            clientId: homeowner.id,
            providerId: service.providerId,
            serviceId: service.id,
            locationId: location.id,
            status: "PENDING",
            scheduledDate: scheduled,
            description: input.description.trim() || null,
          },
        });

        // Tanto CARD como CASH inician en PENDING; CARD pasa a SUCCESS en /homeowner/checkout
        await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            paymentType: paymentEnum,
            totalAmount: totalAmount.toFixed(2),
            commissionRate: PLATFORM_COMMISSION_RATE.toFixed(2),
            platformComission: platformComission.toFixed(2),
            providerNetAmount: providerNetAmount.toFixed(2),
            status: "PENDING",
          },
        });

        orderIds.push(order.id);
      }

      // Si es CASH notificamos de inmediato; si es CARD notificamos al confirmar la tarjeta
      if (paymentEnum === "CASH") {
        const serviceTitles = services.map((s) => s.title).join(", ");

        await tx.notification.create({
          data: {
            userId: dbUser.id,
            title: "Service request sent",
            message: `Your request for "${serviceTitles}" with ${providerUser.firstName} ${providerUser.lastName} has been submitted.`,
            metadata: {
              orderIds,
              totalAmount: grandTotal,
              platformComission: totalPlatformCommission,
              providerNetAmount: totalProviderNet,
              paymentType: paymentEnum,
              appliedOfferCode:
                input.applyOffer && activeOffer ? activeOffer.code : null,
            },
          },
        });

        await tx.notification.create({
          data: {
            userId: providerUser.id,
            title: "New service request",
            message: `${dbUser.firstName} ${dbUser.lastName} requested "${serviceTitles}".`,
            metadata: {
              orderIds,
              providerNetAmount: totalProviderNet,
            },
          },
        });
      }

      return orderIds;
    });

    revalidatePath("/homeowner/dashboard");
    revalidatePath("/homeowner/orders");

    return {
      success: true,
      orderId: createdOrderIds[0],
      orderIds: createdOrderIds,
    };
  } catch (error) {
    console.error("[createServiceOrderAction] Error:", error);
    return {
      success: false,
      error: "Unexpected error while creating your service request.",
    };
  }
}

export interface ConfirmSimulatedCardInput {
  orderIds: string[];
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

export async function confirmSimulatedCardPaymentAction(
  input: ConfirmSimulatedCardInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: "Your session expired. Please sign in again.",
      };
    }

    const cleanOrderIds = Array.from(new Set(input.orderIds ?? [])).filter(Boolean);
    if (cleanOrderIds.length === 0) {
      return { success: false, error: "No orders found to process payment." };
    }

    const digitsOnly = input.cardNumber.replace(/\D/g, "");
    if (!input.cardholderName.trim() || digitsOnly.length < 15 || digitsOnly.length > 16) {
      return {
        success: false,
        error: "Please enter a valid cardholder name and 15–16 digit card number.",
      };
    }

    const expiryMatch = input.expiry.trim().match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!expiryMatch) {
      return {
        success: false,
        error: "Please enter a valid expiration date in MM/YY format.",
      };
    }

    const expMonth = Number(expiryMatch[1]);
    const expYear = 2000 + Number(expiryMatch[2]);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      return {
        success: false,
        error: "This simulated card is expired. Please enter a future MM/YY date.",
      };
    }

    const cvvDigits = input.cvv.replace(/\D/g, "");
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      return {
        success: false,
        error: "Please enter a valid 3 or 4 digit security code (CVV).",
      };
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      include: { homeowner: { select: { id: true } } },
    });

    if (!dbUser?.homeowner) {
      return { success: false, error: "Homeowner profile not found." };
    }

    const orders = await prisma.serviceOrder.findMany({
      where: {
        id: { in: cleanOrderIds },
        clientId: dbUser.homeowner.id,
        status: "PENDING",
      },
      include: {
        service: { select: { title: true } },
        transaction: true,
        provider: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (orders.length !== cleanOrderIds.length) {
      return {
        success: false,
        error: "One or more orders could not be verified or were already processed.",
      };
    }

    const invalidTx = orders.some(
      (o) => !o.transaction || o.transaction.paymentType !== "CARD"
    );
    if (invalidTx) {
      return {
        success: false,
        error: "Invalid payment method configuration for this checkout.",
      };
    }

    const last4 = digitsOnly.slice(-4);
    const providerUser = orders[0].provider.user;
    const serviceTitles = orders.map((o) => o.service.title).join(", ");

    let grandTotal = 0;
    let totalPlatformCommission = 0;
    let totalProviderNet = 0;

    for (const o of orders) {
      grandTotal = roundMoney(grandTotal + Number(o.transaction!.totalAmount));
      totalPlatformCommission = roundMoney(
        totalPlatformCommission + Number(o.transaction!.platformComission)
      );
      totalProviderNet = roundMoney(
        totalProviderNet + Number(o.transaction!.providerNetAmount)
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const o of orders) {
        await tx.paymentTransaction.update({
          where: { id: o.transaction!.id },
          data: {
            status: "SUCCESS",
            transactionDate: new Date(),
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: dbUser.id,
          title: "Card payment confirmed",
          message: `Simulated payment of $${grandTotal.toFixed(2)} (•••• ${last4}) for "${serviceTitles}" succeeded.`,
          metadata: {
            orderIds: cleanOrderIds,
            totalAmount: grandTotal,
            platformComission: totalPlatformCommission,
            providerNetAmount: totalProviderNet,
            paymentType: "CARD",
            cardLast4: last4,
          },
        },
      });

      await tx.notification.create({
        data: {
          userId: providerUser.id,
          title: "New paid service request",
          message: `${dbUser.firstName} ${dbUser.lastName} requested "${serviceTitles}".`,
          metadata: {
            orderIds: cleanOrderIds,
            providerNetAmount: totalProviderNet,
          },
        },
      });
    });

    revalidatePath("/homeowner/dashboard");
    revalidatePath("/homeowner/orders");

    return {
      success: true,
      orderIds: cleanOrderIds,
    };
  } catch (error) {
    console.error("[confirmSimulatedCardPaymentAction] Error:", error);
    return {
      success: false,
      error: "Unexpected error while confirming simulated card payment.",
    };
  }
}

export async function seedSampleProvidersAction(): Promise<ActionResult> {
  try {
    const existingProviders = await prisma.provider.count();
    if (existingProviders > 0) {
      return { success: true };
    }

    const categoriesData = [
      { name: "Plumbing", description: "Pipe repairs, leaks, and installations" },
      { name: "Electrical", description: "Wiring, outlets, and lighting" },
      { name: "Cleaning", description: "Deep home and office cleaning" },
      { name: "Carpentry", description: "Custom woodwork and furniture repair" },
    ];

    const categories: Record<string, string> = {};
    for (const cat of categoriesData) {
      const record = await prisma.serviceCategory.upsert({
        where: { name: cat.name },
        update: {},
        create: cat,
      });
      categories[cat.name] = record.id;
    }

    const sampleProviders = [
      {
        email: "alejandro.mendoza@takunex.demo",
        firstName: "Alejandro",
        lastName: "Mendoza",
        rating: 4.5,
        totalReviews: 18,
        aboutMe:
          "Specialist in residential carpentry, doors, and custom cabinetry.",
        services: [
          {
            category: "Carpentry",
            title: "Door & Cabinet Repair",
            description: "Adjustment, hinges, locks, and wood restoration.",
            hourlyRate: "32.00",
          },
          {
            category: "Carpentry",
            title: "Custom Shelving Installation",
            description: "Measuring, mounting, and finishing wooden shelves.",
            hourlyRate: "38.00",
          },
        ],
      },
      {
        email: "carlos.ramirez@takunex.demo",
        firstName: "Carlos",
        lastName: "Ramirez",
        rating: 4.1,
        totalReviews: 12,
        aboutMe:
          "Certified plumber and residential electrician with 8 years of experience.",
        services: [
          {
            category: "Plumbing",
            title: "Leak Detection & Pipe Repair",
            description:
              "Fast repair for kitchen, bathroom, and water heater leaks.",
            hourlyRate: "40.00",
          },
          {
            category: "Electrical",
            title: "Outlet & Breaker Replacement",
            description:
              "Safe diagnostics and replacement of switches and breakers.",
            hourlyRate: "45.00",
          },
        ],
      },
      {
        email: "genesis.torres@takunex.demo",
        firstName: "Génesis",
        lastName: "Torres",
        rating: 4.9,
        totalReviews: 31,
        aboutMe:
          "Detailed residential deep cleaning with eco-friendly supplies.",
        services: [
          {
            category: "Cleaning",
            title: "Full Home Deep Cleaning",
            description:
              "Kitchen, bathrooms, bedrooms, and living areas sanitization.",
            hourlyRate: "28.00",
          },
        ],
      },
      {
        email: "diego.garcia@takunex.demo",
        firstName: "Diego",
        lastName: "García",
        rating: 5.0,
        totalReviews: 42,
        aboutMe:
          "Professional, fast, and completely reliable plumbing technician.",
        services: [
          {
            category: "Plumbing",
            title: "Water Heater & Faucet Installation",
            description: "Complete installation and pressure testing.",
            hourlyRate: "42.00",
          },
        ],
      },
    ];

    for (const item of sampleProviders) {
      const user = await prisma.user.upsert({
        where: { email: item.email },
        update: {},
        create: {
          supabaseAuthId: `demo-auth-${item.email}`,
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          role: "PROVIDER",
          status: "ACTIVE",
          emailVerified: true,
          phoneVerified: true,
        },
      });

      const provider = await prisma.provider.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          aboutMe: item.aboutMe,
          operationalStatus: "ACTIVE",
          verificationStatus: "APPROVED",
          rating: item.rating,
          totalReviews: item.totalReviews,
        },
      });

      for (const svc of item.services) {
        await prisma.providerService.create({
          data: {
            providerId: provider.id,
            categoryId: categories[svc.category],
            title: svc.title,
            description: svc.description,
            hourlyRate: svc.hourlyRate,
            isActive: true,
          },
        });
      }
    }

    revalidatePath("/homeowner/dashboard");
    revalidatePath("/homeowner/new-request");

    return { success: true };
  } catch (error) {
    console.error("[seedSampleProvidersAction] Error:", error);
    return {
      success: false,
      error: "Could not seed sample providers. Check database connection.",
    };
  }
}