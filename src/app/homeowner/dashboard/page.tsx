import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

interface DashboardPageProps {
  searchParams: Promise<{ q?: string; promo?: string }>;
}

interface ProviderCardData {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  rating: number;
  categoriesLabel: string;
  featuredReview: string;
  isDemo?: boolean;
}

const DEMO_NEAR_PROVIDERS: ProviderCardData[] = [
  {
    id: "demo-alejandro",
    fullName: "Alejandro Mendoza",
    avatarUrl: null,
    rating: 4.5,
    categoriesLabel: "Carpenter",
    featuredReview: "Puntual, limpio y con excelentes acabados en madera.",
    isDemo: true,
  },
  {
    id: "demo-carlos",
    fullName: "Carlos Ramirez",
    avatarUrl: null,
    rating: 4.1,
    categoriesLabel: "Plumbing, Electrical",
    featuredReview: "Resolvió una fuga urgente el mismo día sin contratiempos.",
    isDemo: true,
  },
  {
    id: "demo-genesis",
    fullName: "Génesis Torres",
    avatarUrl: null,
    rating: 4.9,
    categoriesLabel: "Cleaning",
    featuredReview: "Servicio impecable y muy profesional en cada detalle.",
    isDemo: true,
  },
];

const DEMO_TOP_PROVIDERS: ProviderCardData[] = [
  {
    id: "demo-diego",
    fullName: "Diego García",
    avatarUrl: null,
    rating: 5.0,
    categoriesLabel: "Plumbing",
    featuredReview: "Professional, fast, and completely reliable. Great job!",
    isDemo: true,
  },
  {
    id: "demo-ana",
    fullName: "Ana Tejeda",
    avatarUrl: null,
    rating: 4.9,
    categoriesLabel: "Cleaning",
    featuredReview:
      "Excellent work. Cleaned everything fast but thoroughly. My house has never looked this good.",
    isDemo: true,
  },
];

function ProviderAvatar({
  name,
  avatarUrl,
  sizeClass,
}: {
  name: string;
  avatarUrl: string | null;
  sizeClass: string;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover border border-tx-gray-light`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-tx-navy text-lg font-bold text-white`}
      aria-hidden="true"
    >
      {initials || "TX"}
    </div>
  );
}

function StarIcon({ filled = true }: { filled?: boolean }) {
  return (
    <svg
      className={`h-4 w-4 ${filled ? "text-tx-star" : "text-tx-gray-light"}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export default async function HomeownerDashboardPage({
  searchParams,
}: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const searchTerm = resolvedParams.q?.trim() ?? "";
  const promoActive = resolvedParams.promo === "15off";

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    include: {
      homeowner: {
        include: {
          _count: {
            select: { hiredServicesHistory: true },
          },
        },
      },
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  const isFirstServiceEligible =
    (dbUser.homeowner?._count.hiredServicesHistory ?? 0) === 0;

  const dbProviders = await prisma.provider.findMany({
    where: {
      user: {
        status: "ACTIVE",
      },
      ...(searchTerm
        ? {
            OR: [
              {
                user: {
                  firstName: { contains: searchTerm, mode: "insensitive" },
                },
              },
              {
                user: {
                  lastName: { contains: searchTerm, mode: "insensitive" },
                },
              },
              {
                offeredServices: {
                  some: {
                    isActive: true,
                    OR: [
                      { title: { contains: searchTerm, mode: "insensitive" } },
                      {
                        category: {
                          name: { contains: searchTerm, mode: "insensitive" },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
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
        take: 1,
        select: {
          comment: true,
        },
      },
    },
    orderBy: [{ rating: "desc" }, { totalReviews: "desc" }],
    take: 12,
  });

  const mappedProviders: ProviderCardData[] = dbProviders.map((provider) => {
    const uniqueCategories = Array.from(
      new Set(provider.offeredServices.map((service) => service.category.name))
    );

    return {
      id: provider.id,
      fullName: `${provider.user.firstName} ${provider.user.lastName}`.trim(),
      avatarUrl: provider.user.avatarUrl,
      rating: provider.rating > 0 ? Number(provider.rating.toFixed(1)) : 5.0,
      categoriesLabel:
        uniqueCategories.length > 0
          ? uniqueCategories.join(", ")
          : "Home Services",
      featuredReview:
        provider.reviewsReceived[0]?.comment ??
        provider.aboutMe ??
        "Professional, fast, and completely reliable. Great job!",
    };
  });

  const usingDemoFallback = mappedProviders.length === 0 && !searchTerm;
  const nearProviders = usingDemoFallback
    ? DEMO_NEAR_PROVIDERS
    : mappedProviders.slice(0, 6);
  const topRatedProviders = usingDemoFallback
    ? DEMO_TOP_PROVIDERS
    : [...mappedProviders].sort((a, b) => b.rating - a.rating).slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Banner Promocional */}
      <section className="rounded-3xl bg-tx-sky px-8 py-8 text-white shadow-xs md:px-12 md:py-9">
        <div className="max-w-xl">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            15% OFF
            <span className="block">On your first service</span>
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={
                promoActive
                  ? "/homeowner/dashboard#providers"
                  : "/homeowner/dashboard?promo=15off#providers"
              }
              className="inline-flex min-w-[180px] items-center justify-center rounded-xl bg-white px-7 py-2.5 text-sm font-bold text-tx-navy shadow-xs transition hover:bg-tx-canvas"
            >
              {promoActive ? "15% Discount Applied" : "See Offers"}
            </Link>

            {promoActive && (
              <span className="rounded-full bg-tx-navy/25 px-3.5 py-1 text-xs font-medium text-white">
                {isFirstServiceEligible
                  ? "Eligible on your first booking"
                  : "Promo code: TAKUNEX15"}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Indicador de filtro activo en el buscador */}
      {searchTerm && (
        <div className="flex items-center justify-between rounded-xl border border-tx-gray-light bg-white px-4 py-3 text-sm">
          <p className="text-tx-ink">
            Showing results for{" "}
            <span className="font-bold text-tx-black">&ldquo;{searchTerm}&rdquo;</span>
          </p>
          <Link
            href="/homeowner/dashboard"
            className="text-xs font-semibold text-tx-sky hover:underline"
          >
            Clear search
          </Link>
        </div>
      )}

      {usingDemoFallback && (
        <div className="rounded-xl border border-tx-gray-light bg-white/80 px-4 py-2.5 text-xs text-tx-gray-dark">
          Preview mode: showing sample providers until approved providers are registered in PostgreSQL.
        </div>
      )}

      {/* Sección 1: Providers near you */}
      <section id="providers" className="space-y-4">
        <h2 className="text-base font-bold text-tx-black">Providers near you</h2>

        {nearProviders.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-tx-gray-dark shadow-xs">
            No providers matched your search. Try another name or service category.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {nearProviders.map((provider) => (
              <article
                key={provider.id}
                className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-xs transition hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <ProviderAvatar
                    name={provider.fullName}
                    avatarUrl={provider.avatarUrl}
                    sizeClass="h-20 w-20"
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-tx-black">
                      {provider.fullName}
                    </h3>

                    <div className="mt-1 flex items-center gap-1.5">
                      <StarIcon filled />
                      <span className="text-xs font-bold text-tx-black">
                        {provider.rating.toFixed(1)}
                      </span>
                    </div>

                    <p className="mt-2 truncate text-xs text-tx-gray-dark">
                      {provider.categoriesLabel}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/homeowner/new-request?providerId=${encodeURIComponent(
                    provider.id
                  )}${promoActive ? "&promo=15off" : ""}`}
                  className="mt-4 block w-full rounded-full bg-tx-sky py-1.5 text-center text-sm font-semibold text-white transition hover:bg-tx-teal"
                >
                  Hire
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Sección 2: Top rated providers */}
      {topRatedProviders.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-tx-black">
            Top rated providers
          </h2>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {topRatedProviders.map((provider) => {
              const filledStars = Math.round(provider.rating);

              return (
                <article
                  key={`top-${provider.id}`}
                  className="flex items-center gap-5 rounded-2xl bg-white p-6 shadow-xs transition hover:shadow-md"
                >
                  <ProviderAvatar
                    name={provider.fullName}
                    avatarUrl={provider.avatarUrl}
                    sizeClass="h-24 w-24 md:h-28 md:w-28"
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold text-tx-black md:text-xl">
                      {provider.fullName}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-xs italic text-tx-gray-dark">
                      &ldquo;{provider.featuredReview}&rdquo;
                    </p>

                    <div
                      className="mt-2.5 flex items-center gap-1"
                      aria-label={`Rated ${provider.rating} out of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((starIndex) => (
                        <StarIcon
                          key={starIndex}
                          filled={starIndex <= filledStars}
                        />
                      ))}
                    </div>

                    <Link
                      href={`/homeowner/new-request?providerId=${encodeURIComponent(
                        provider.id
                      )}${promoActive ? "&promo=15off" : ""}`}
                      className="mt-3.5 inline-block w-full max-w-[210px] rounded-full bg-tx-sky py-1.5 text-center text-sm font-semibold text-white transition hover:bg-tx-teal"
                    >
                      Hire
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}