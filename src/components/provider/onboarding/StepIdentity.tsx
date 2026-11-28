"use client";

import { useState } from "react";
import { uploadFile, ALLOWED_DOCUMENT } from "@/lib/supabase/upload";
import type { IdentityData } from "./types";
import { identityMissing } from "./types";

interface Props {
  data: IdentityData;
  onChange: (data: IdentityData) => void;
  showErrors: boolean;
}

function UploadBox(props: {
  title: string;
  hint: string;
  done: boolean;
  invalid: boolean;
  onFile: (file: File) => Promise<string | null>; // devuelve mensaje de error o null
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(await props.onFile(file));
    setBusy(false);
  };

  return (
    <div>
      <label
        className={`relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed bg-tx-bg px-4 py-8 text-center transition hover:bg-tx-gray-light/40 ${
          props.invalid ? "border-red-500" : "border-tx-navy"
        }`}
      >
        {props.done && (
          <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-sm text-white" aria-label="Uploaded">
            ✓
          </span>
        )}
        <span className="text-lg font-bold text-tx-navy">{props.title}</span>
        <span className="text-sm text-tx-navy">
          {busy ? "Uploading..." : props.hint}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </label>
      {error && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{error}</p>}
      {props.invalid && !error && (
        <p className="mt-1 text-xs font-medium text-red-600">This document is required.</p>
      )}
    </div>
  );
}

export function StepIdentity({ data, onChange, showErrors }: Props) {
  const missing = identityMissing(data);

  const upload = (name: "id-card" | "proof-of-address", key: keyof IdentityData) =>
    async (file: File) => {
      const { path, error } = await uploadFile({
        bucket: "provider-documents",
        name,
        file,
        allowed: ALLOWED_DOCUMENT,
      });
      if (error || !path) return error;
      onChange({ ...data, [key]: path });
      return null;
    };

  return (
    <div className="space-y-6">
      <UploadBox
        title="Upload ID Card"
        hint="Tap to upload ID Card"
        done={!!data.idCardPath}
        invalid={showErrors && missing.idCard}
        onFile={upload("id-card", "idCardPath")}
      />
      <UploadBox
        title="Upload Proof of Address"
        hint="Tap to upload Proof of Address"
        done={!!data.proofOfAddressPath}
        invalid={showErrors && missing.proof}
        onFile={upload("proof-of-address", "proofOfAddressPath")}
      />
      <p className="text-center text-xs text-tx-gray">JPG, PNG, WEBP or PDF. Max 5 MB.</p>
    </div>
  );
}