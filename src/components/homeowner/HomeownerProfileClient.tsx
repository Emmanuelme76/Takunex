"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  addSavedCardAction,
  removePaymentMethodAction,
  setDefaultPaymentMethodAction,
  switchUserRoleAction,
  updateHomeownerProfileAction,
} from "@/actions/homeowner.actions";

export interface SavedCardItem {
  id: string;
  isDefault: boolean;
  cardholderName: string;
  last4Digits: string;
  cardBrand: string;
  expirationDate: string;
}

export interface ProfileReviewItem {
  id: string;
  starRating: number;
  comment: string | null;
  feedbackDateLabel: string;
  serviceTitle: string;
  counterpartyName: string;
}

interface HomeownerProfileClientProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    activeRole: "HOMEOWNER" | "PROVIDER" | "ADMIN" | "SUPER_ADMIN";
    hasProviderProfile: boolean;
    providerRating: number;
    providerTotalReviews: number;
  };
  stats: {
    totalOrders: number;
    completedOrders: number;
    reviewsWritten: number;
  };
  savedCards: SavedCardItem[];
  reviewsWrittenList: ProfileReviewItem[];
  reviewsReceivedList: ProfileReviewItem[];
}

export function HomeownerProfileClient({
  user,
  stats,
  savedCards,
  reviewsWrittenList,
  reviewsReceivedList,
}: HomeownerProfileClientProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [profileMsg, setProfileMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [isSavingProfile, startSavingProfile] = useTransition();

  // Estado para cambio de rol
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isSwitchingRole, startSwitchingRole] = useTransition();

  // Pestaña activa en reseñas
  const [reviewTab, setReviewTab] = useState<"written" | "received">("written");

  // Estado para nueva tarjeta simulada
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isSavingCard, startSavingCard] = useTransition();

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  const handleSwitchRole = (targetRole: "HOMEOWNER" | "PROVIDER") => {
    if (user.activeRole === targetRole) return;
    setRoleError(null);

    startSwitchingRole(async () => {
      const res = await switchUserRoleAction(targetRole);
      if (!res.ok) {
        setRoleError(res.error);
        return;
      }

      // Refrescamos la sesión en el cliente para actualizar el JWT en cookies
      const supabase = createClient();
      await supabase.auth.refreshSession();

      window.location.href =
        res.redirectTo ??
        (targetRole === "PROVIDER"
          ? "/provider/dashboard"
          : "/homeowner/dashboard");
    });
  };

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileMsg({ type: "err", text: "Please select an image file." });
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setProfileMsg({
        type: "err",
        text: "Image size must be smaller than 3 MB.",
      });
      return;
    }

    try {
      setIsUploadingAvatar(true);
      setProfileMsg(null);

      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setProfileMsg({
          type: "err",
          text: "Session expired. Please sign in again.",
        });
        return;
      }

      const fileExt = file.name.split(".").pop() || "png";
      const filePath = `${authUser.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        setProfileMsg({ type: "err", text: uploadError.message });
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(publicUrl);

      const res = await updateHomeownerProfileAction({
        firstName,
        lastName,
        phoneNumber,
        avatarUrl: publicUrl,
      });

      if (!res.ok) {
        setProfileMsg({ type: "err", text: res.error });
      } else {
        setProfileMsg({
          type: "ok",
          text: "Profile photo updated successfully.",
        });
        router.refresh();
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    startSavingProfile(async () => {
      const res = await updateHomeownerProfileAction({
        firstName,
        lastName,
        phoneNumber,
        avatarUrl,
      });

      if (!res.ok) {
        setProfileMsg({ type: "err", text: res.error });
      } else {
        setProfileMsg({
          type: "ok",
          text: res.message ?? "Profile updated.",
        });
        router.refresh();
      }
    });
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    setCardError(null);

    startSavingCard(async () => {
      const res = await addSavedCardAction({
        cardholderName,
        cardNumber,
        expirationDate,
        setAsDefault,
      });

      if (!res.ok) {
        setCardError(res.error);
      } else {
        setShowAddCard(false);
        setCardholderName("");
        setCardNumber("");
        setExpirationDate("");
      }
    });
  };

  const activeReviewsList =
    reviewTab === "written" ? reviewsWrittenList : reviewsReceivedList;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-tx-black">My Profile</h1>
        <p className="text-sm text-tx-gray-dark">
          Manage your personal details, active role, reviews, and saved payment
          methods.
        </p>
      </div>

      {/* Tarjeta superior con avatar y métricas */}
      <section className="flex flex-col justify-between gap-6 rounded-2xl bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${firstName} ${lastName}`}
                className="h-20 w-20 rounded-full border-2 border-tx-sky object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-tx-navy text-xl font-bold text-white">
                {initials || "TX"}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-tx-black">
              {firstName} {lastName}
            </h2>
            <p className="text-xs text-tx-gray-dark">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  user.emailVerified
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {user.emailVerified ? "Email Verified" : "Email Unverified"}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  user.phoneVerified
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-tx-canvas text-tx-gray-dark"
                }`}
              >
                {user.phoneVerified ? "Phone Verified" : "Phone Unverified"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <label className="cursor-pointer rounded-full border border-tx-sky px-4 py-2 text-xs font-bold text-tx-navy transition hover:bg-tx-sky/10">
            {isUploadingAvatar ? "Uploading photo..." : "Change Profile Photo"}
            <input
              type="file"
              accept="image/*"
              disabled={isUploadingAvatar}
              onChange={handleAvatarFileChange}
              className="hidden"
            />
          </label>
          <span className="text-[11px] text-tx-gray-dark">
            JPG, PNG or WebP (max 3 MB)
          </span>
        </div>
      </section>

      {/* Selector de Rol (Homeowner <-> Provider) */}
      {(user.activeRole === "HOMEOWNER" || user.activeRole === "PROVIDER") && (
        <section className="rounded-2xl bg-white p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-tx-black">
                  Account Mode
                </h3>
                <span className="rounded-full bg-tx-sky/15 px-2.5 py-0.5 text-[11px] font-bold text-tx-navy">
                  {user.activeRole === "HOMEOWNER"
                    ? "Homeowner Mode"
                    : "Provider Mode"}
                </span>
              </div>
              <p className="text-xs text-tx-gray-dark">
                Switch between hiring home services as a Homeowner or offering
                your services as a Provider without losing your history.
              </p>
            </div>

            <div className="inline-flex shrink-0 rounded-full border border-tx-gray-light bg-tx-canvas p-1">
              <button
                type="button"
                disabled={isSwitchingRole || user.activeRole === "HOMEOWNER"}
                onClick={() => handleSwitchRole("HOMEOWNER")}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  user.activeRole === "HOMEOWNER"
                    ? "bg-tx-navy text-white shadow-xs"
                    : "text-tx-gray-dark hover:text-tx-black cursor-pointer"
                }`}
              >
                Homeowner
              </button>
              <button
                type="button"
                disabled={isSwitchingRole || user.activeRole === "PROVIDER"}
                onClick={() => handleSwitchRole("PROVIDER")}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  user.activeRole === "PROVIDER"
                    ? "bg-tx-sky text-white shadow-xs"
                    : "text-tx-gray-dark hover:text-tx-black cursor-pointer"
                }`}
              >
                {isSwitchingRole
                  ? "Switching..."
                  : user.hasProviderProfile
                    ? "Switch to Provider"
                    : "Become a Provider"}
              </button>
            </div>
          </div>

          {roleError && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
              {roleError}
            </p>
          )}
        </section>
      )}

      {/* Estadísticas del Homeowner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-tx-gray-muted">
            Total Requests
          </p>
          <p className="mt-1 text-2xl font-extrabold text-tx-navy">
            {stats.totalOrders}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-tx-gray-muted">
            Completed Services
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">
            {stats.completedOrders}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-tx-gray-muted">
            Reviews Written
          </p>
          <p className="mt-1 text-2xl font-extrabold text-tx-sky">
            {stats.reviewsWritten}
          </p>
        </div>
      </div>

      {/* Formulario de Información Personal */}
      <form
        onSubmit={handleProfileSubmit}
        className="space-y-4 rounded-2xl bg-white p-6 shadow-xs"
      >
        <h3 className="text-base font-bold text-tx-black">
          Personal Information
        </h3>

        {profileMsg && (
          <div
            className={`rounded-xl px-4 py-3 text-xs font-medium ${
              profileMsg.type === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {profileMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="firstName"
              className="block text-xs font-semibold text-tx-ink"
            >
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="block text-xs font-semibold text-tx-ink"
            >
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="emailReadOnly"
              className="block text-xs font-semibold text-tx-ink"
            >
              Email Address
            </label>
            <input
              id="emailReadOnly"
              type="email"
              disabled
              value={user.email}
              className="mt-1.5 w-full rounded-xl border border-tx-gray-light bg-tx-canvas/70 px-3.5 py-2.5 text-sm text-tx-gray-dark"
            />
          </div>

          <div>
            <label
              htmlFor="phoneNumber"
              className="block text-xs font-semibold text-tx-ink"
            >
              Phone Number
            </label>
            <input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+52 33 1234 5678"
              className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSavingProfile}
            className="rounded-full bg-tx-sky px-6 py-2.5 text-sm font-bold text-white transition hover:bg-tx-teal disabled:opacity-60 cursor-pointer"
          >
            {isSavingProfile ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Apartado de Reseñas (Escritas y Recibidas) */}
      <section className="space-y-4 rounded-2xl bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold text-tx-black">
              Reviews &amp; Reputation
            </h3>
            <p className="text-xs text-tx-gray-dark">
              Feedback you have left for providers and reviews written about
              your work.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReviewTab("written")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                reviewTab === "written"
                  ? "bg-tx-navy text-white"
                  : "bg-tx-canvas text-tx-gray-dark hover:text-tx-black"
              }`}
            >
              Reviews I Left ({reviewsWrittenList.length})
            </button>
            <button
              type="button"
              onClick={() => setReviewTab("received")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                reviewTab === "received"
                  ? "bg-tx-navy text-white"
                  : "bg-tx-canvas text-tx-gray-dark hover:text-tx-black"
              }`}
            >
              Reviews Received ({reviewsReceivedList.length})
            </button>
          </div>
        </div>

        {reviewTab === "received" && user.hasProviderProfile && (
          <div className="flex items-center gap-3 rounded-xl bg-tx-canvas/70 px-4 py-2.5 text-xs">
            <span className="font-bold text-tx-navy">
              Provider Rating: {user.providerRating.toFixed(1)} ★
            </span>
            <span className="text-tx-gray-dark">
              ({user.providerTotalReviews}{" "}
              {user.providerTotalReviews === 1 ? "review" : "reviews"} total)
            </span>
          </div>
        )}

        {activeReviewsList.length === 0 ? (
          <p className="rounded-xl border border-dashed border-tx-gray-light p-6 text-center text-xs text-tx-gray-dark">
            {reviewTab === "written"
              ? "You haven't written any reviews yet. After a service is completed, you can rate your provider from Orders or History."
              : "No client reviews received yet. Switch to Provider mode to offer services and collect ratings."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeReviewsList.map((rev) => (
              <div
                key={rev.id}
                className="space-y-2 rounded-xl border border-tx-gray-light/90 bg-tx-canvas/40 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-tx-black">
                      {rev.serviceTitle}
                    </p>
                    <p className="text-[11px] font-medium text-tx-teal">
                      {reviewTab === "written"
                        ? `Provider: ${rev.counterpartyName}`
                        : `Client: ${rev.counterpartyName}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-0.5 text-sm">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={
                          star <= rev.starRating
                            ? "text-tx-star"
                            : "text-tx-gray-light"
                        }
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>

                {rev.comment && (
                  <p className="text-xs italic text-tx-ink">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                )}

                <p className="text-[11px] text-tx-gray-muted">
                  {rev.feedbackDateLabel}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Métodos de Pago Guardados */}
      <section className="space-y-4 rounded-2xl bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-tx-black">
              Saved Payment Methods
            </h3>
            <p className="text-xs text-tx-gray-dark">
              Only the last 4 digits and tokenized reference are stored.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAddCard((prev) => !prev);
              setCardError(null);
            }}
            className="rounded-full bg-tx-navy px-4 py-2 text-xs font-bold text-white transition hover:bg-tx-ink cursor-pointer"
          >
            {showAddCard ? "Close Form" : "+ Add Card"}
          </button>
        </div>

        {showAddCard && (
          <form
            onSubmit={handleAddCard}
            className="space-y-3 rounded-xl border border-tx-gray-light bg-tx-canvas/50 p-4"
          >
            {cardError && (
              <p className="text-xs font-medium text-red-600">{cardError}</p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-tx-ink">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  required
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  placeholder="Yahir Alejandro"
                  className="mt-1 w-full rounded-lg border border-tx-gray-light bg-white px-3 py-2 text-xs text-tx-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-tx-ink">
                  Card Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={cardNumber}
                  onChange={(e) =>
                    setCardNumber(
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 16)
                        .replace(/(\d{4})(?=\d)/g, "$1 ")
                    )
                  }
                  placeholder="4532 0151 1283 0366"
                  className="mt-1 w-full rounded-lg border border-tx-gray-light bg-white px-3 py-2 font-mono text-xs text-tx-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-tx-ink">
                  Expiration (MM/YY)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={expirationDate}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setExpirationDate(
                      d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
                    );
                  }}
                  placeholder="08/29"
                  className="mt-1 w-full rounded-lg border border-tx-gray-light bg-white px-3 py-2 font-mono text-xs text-tx-black"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-tx-ink">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="accent-tx-sky"
                />
                Set as default payment method
              </label>

              <button
                type="submit"
                disabled={isSavingCard}
                className="rounded-lg bg-tx-sky px-4 py-2 text-xs font-bold text-white hover:bg-tx-teal disabled:opacity-50 cursor-pointer"
              >
                {isSavingCard ? "Saving..." : "Save Card"}
              </button>
            </div>
          </form>
        )}

        {savedCards.length === 0 ? (
          <p className="rounded-xl border border-dashed border-tx-gray-light p-6 text-center text-xs text-tx-gray-dark">
            No saved cards yet. Add a card above for faster checkout.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {savedCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between rounded-xl border border-tx-gray-light p-4"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-tx-ink">
                      {card.cardBrand} •••• {card.last4Digits}
                    </span>
                    {card.isDefault && (
                      <span className="rounded-full bg-tx-sky/15 px-2 py-0.5 text-[10px] font-bold text-tx-navy">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-tx-gray-dark">
                    {card.cardholderName} • Exp {card.expirationDate}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!card.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultPaymentMethodAction(card.id)}
                      className="text-xs font-semibold text-tx-sky hover:underline cursor-pointer"
                    >
                      Make default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removePaymentMethodAction(card.id)}
                    className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}