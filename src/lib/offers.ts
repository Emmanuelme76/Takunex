export interface ActiveOffer {
  id: string;
  code: string;
  headline: string;
  subheadline: string;
  discountRate: number; // Ej: 0.15 = 15%, 0.10 = 10%
  badgeText: string;
  isFirstServiceOnly: boolean;
}

// Ofertas generales rotativas por semana (si una semana es `null`, el cuadro desaparece)
const WEEKLY_GENERAL_OFFERS: (ActiveOffer | null)[] = [
  {
    id: "weekly-home-care",
    code: "WEEKLY10",
    headline: "10% OFF",
    subheadline: "Weekly Home Maintenance Deal",
    discountRate: 0.1,
    badgeText: "Weekly offer (10% OFF)",
    isFirstServiceOnly: false,
  },
  {
    id: "weekly-sparkle",
    code: "CLEAN12",
    headline: "12% OFF",
    subheadline: "Weekly Special on Home Services",
    discountRate: 0.12,
    badgeText: "Weekly offer (12% OFF)",
    isFirstServiceOnly: false,
  },
  null, // Semana sin promociones activas -> el banner desaparece
  {
    id: "weekly-fixit",
    code: "FIX10",
    headline: "10% OFF",
    subheadline: "Weekend & Midweek Service Deal",
    discountRate: 0.1,
    badgeText: "Weekly offer (10% OFF)",
    isFirstServiceOnly: false,
  },
];

function getIsoWeekNumber(date: Date): number {
  const temp = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function resolveHomeownerOffer(
  nonCancelledOrdersCount: number,
  referenceDate: Date = new Date()
): ActiveOffer | null {
  // 1. Cuenta nueva sin servicios contratados -> 15% OFF único
  if (nonCancelledOrdersCount === 0) {
    return {
      id: "first-service-15",
      code: "WELCOME15",
      headline: "15% OFF",
      subheadline: "On your first service",
      discountRate: 0.15,
      badgeText: "New account offer (15% OFF)",
      isFirstServiceOnly: true,
    };
  }

  // 2. Cuenta recurrente -> Oferta general de la semana actual
  if (WEEKLY_GENERAL_OFFERS.length === 0) {
    return null;
  }

  const weekNumber = getIsoWeekNumber(referenceDate);
  const index = weekNumber % WEEKLY_GENERAL_OFFERS.length;

  // 3. Si esa semana no hay oferta activa, retorna null y el cuadro desaparece
  return WEEKLY_GENERAL_OFFERS[index] ?? null;
}