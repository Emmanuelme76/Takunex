"use client";

import { useState } from "react";
import Image from "next/image";
import { uploadFile, ALLOWED_IMAGE } from "@/lib/supabase/upload";
import type { ProfileData, ServiceOption } from "./types";
import { profileMissing } from "./types";

interface Props {
  data: ProfileData;
  onChange: (data: ProfileData) => void;
  services: ServiceOption[];
  showErrors: boolean;
}

export const fieldClass =
  "block w-full rounded-lg border border-tx-gray-light bg-white px-4 py-2.5 text-sm text-tx-ink " +
  "placeholder:text-tx-gray focus:outline-none focus:ring-2 focus:ring-tx-sky";

export function StepProfile({ data, onChange, services, showErrors }: Props) {
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const missing = profileMissing(data);

  const handleAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setAvatarError(null);

    try {
      const { path, error } = await uploadFile({
        bucket: "avatars",
        name: "avatar",
        file,
        allowed: ALLOWED_IMAGE,
      });

      if (error || !path) {
        setAvatarError(error ?? "Upload failed. Please try again.");
        return;
      }

      onChange({ ...data, avatarPath: path, avatarPreview: URL.createObjectURL(file) });
    } finally {
      setUploading(false); // se ejecuta siempre, haya éxito o error
    }
  };

  const handleGps = () => {
    setGpsDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        onChange({ ...data, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsDenied(true)
    );
  };

  const toggleService = (id: string) =>
    onChange({
      ...data,
      serviceIds: data.serviceIds.includes(id)
        ? data.serviceIds.filter((s) => s !== id)
        : [...data.serviceIds, id],
    });

  return (
    <div className="space-y-8">
      {/* Foto de perfil */}
      <div className="flex flex-col items-center gap-3">
        <div
          className={`relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-tx-gray-light ${
            showErrors && missing.avatar ? "ring-2 ring-red-500" : ""
          }`}
        >
          {data.avatarPreview ? (
            <Image src={data.avatarPreview} alt="Profile picture preview" fill unoptimized className="object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-12 w-12 text-tx-ink" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          )}
        </div>
        <label className="cursor-pointer rounded-full bg-tx-navy px-5 py-2 text-xs font-semibold text-white transition hover:brightness-110">
          {uploading ? "Uploading..." : "Upload profile picture"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleAvatar(e.target.files?.[0])}
          />
        </label>
        {avatarError && <p className="text-xs font-medium text-red-600" role="alert">{avatarError}</p>}
        {showErrors && missing.avatar && !avatarError && (
          <p className="text-xs font-medium text-red-600">A profile picture is required.</p>
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Zona de trabajo */}
        <div>
          <h3 className="mb-3 text-base font-bold text-tx-navy">Select Work Area</h3>
          <button
            type="button"
            onClick={handleGps}
            className="w-full rounded-full bg-tx-sky px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            {data.lat !== null ? "Location saved ✓ (tap to update)" : "Use my current location"}
          </button>
          {gpsDenied && (
            <p className="mt-2 text-xs font-medium text-red-600" role="alert">
              Location access was denied. Please enter your address or ZIP code manually.
            </p>
          )}
          <label htmlFor="manualAddress" className="mb-1.5 mt-4 block text-xs font-semibold text-tx-black">
            Or enter your address / ZIP code
          </label>
          <input
            id="manualAddress"
            type="text"
            value={data.manualAddress}
            onChange={(e) => onChange({ ...data, manualAddress: e.target.value })}
            placeholder="e.g. Guadalajara, Jalisco 44100"
            className={`${fieldClass} ${showErrors && missing.location ? "border-red-500" : ""}`}
          />
          {showErrors && missing.location && (
            <p className="mt-1 text-xs font-medium text-red-600">Please set your work area.</p>
          )}
        </div>

        {/* Servicios */}
        <div>
          <h3 className="mb-3 text-base font-bold text-tx-navy">Select Services</h3>
          <div className="flex flex-wrap gap-3">
            {services.map((s) => {
              const active = data.serviceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  aria-pressed={active}
                  className={`rounded-full px-5 py-2 text-xs font-semibold shadow-md transition ${
                    active ? "bg-tx-sky text-white" : "bg-white text-tx-ink hover:bg-tx-bg"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
          {showErrors && missing.services && (
            <p className="mt-2 text-xs font-medium text-red-600">Select at least one service.</p>
          )}
        </div>
      </div>
    </div>
  );
}