import { createClient } from "@/lib/supabase/client";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_DOCUMENT = [...ALLOWED_IMAGE, "application/pdf"];
export const FILE_ERROR = "Invalid file format or size exceeded.";

export interface UploadResult {
  path: string | null;
  error: string | null;
}

export async function uploadFile(params: {
  bucket: "avatars" | "provider-documents";
  name: string;
  file: File;
  allowed: string[];
}): Promise<UploadResult> {
  const { bucket, name, file, allowed } = params;

  if (!allowed.includes(file.type) || file.size > MAX_FILE_SIZE) {
    return { path: null, error: FILE_ERROR };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { path: null, error: "Session expired. Please log in again." };
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${user.id}/${name}.${ext}`; // la carpeta = ID del usuario (lo exige la RLS)

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
      console.error("Storage upload error:", error.message);
      return { path: null, error: "Upload failed. Please try again." };
    }

    return { path, error: null }; // ← este return es el que faltaba
  } catch (err) {
    console.error("Unexpected upload error:", err);
    return { path: null, error: "Upload failed. Please try again." };
  }
}
