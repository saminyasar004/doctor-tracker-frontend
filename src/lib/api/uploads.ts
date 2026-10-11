import { ApiError, apiFetch } from "./client";

/** Mirrors the backend's `UploadFolder` enum. */
export type UploadFolder = "doctors" | "patients";

export interface UploadedImage {
  /** Delivery URL of the stored image; store this in `avatarUrl`. */
  url: string;
  /** Opaque asset id; pass it back to {@link deleteImage}. */
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  folder: string;
  /** `cloudinary` in production, `local` when the API has no Cloudinary credentials. */
  storage: string;
}

/** Mirrors the API limits so the user gets an instant message instead of a 413. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** Client-side pre-check mirroring the server's multer filter and size limit. */
export function assertUploadable(file: File): void {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new UploadError("Choose a JPG, PNG or WebP image");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Image must be under 5 MB");
  }
}

/**
 * `POST /uploads/image` — stores one image and returns its delivery coordinates.
 *
 * The backend transforms everything to a 512x512 face-cropped square, so callers
 * pass the returned `url` straight into a doctor's or patient's `avatarUrl`.
 */
export async function uploadImage(file: File, folder: UploadFolder): Promise<UploadedImage> {
  assertUploadable(file);

  const formData = new FormData();
  formData.append("file", file);

  try {
    return await apiFetch<UploadedImage>(`/uploads/image?folder=${folder}`, {
      method: "POST",
      formData,
    });
  } catch (error) {
    throw toUploadError(error);
  }
}

/**
 * `DELETE /uploads/image` — destroys a previously uploaded asset by `publicId`.
 *
 * Storage backends are idempotent, so an unknown `publicId` still resolves; call
 * sites treat a failure here as non-fatal because the record itself is already saved.
 */
export async function deleteImage(
  publicId: string,
): Promise<{ deleted: boolean; publicId: string }> {
  return apiFetch(`/uploads/image?publicId=${encodeURIComponent(publicId)}`, {
    method: "DELETE",
  });
}

/**
 * Recovers the `publicId` from an avatar URL so an edit form can delete the image it
 * is about to replace. Understands the two shapes the API returns:
 * - Cloudinary: `<base>/image/upload/<transform>/<version>/<folder>/<publicId>.<ext>`
 * - local dev:  `<api>/uploads/<folder>/<publicId>.<ext>`
 *
 * Returns `undefined` for anything the API did not store, so an externally hosted
 * avatar is never sent to `DELETE /uploads/image`.
 */
export function publicIdFromUrl(url: string): string | undefined {
  if (!url) return undefined;
  // Only our own uploads can be deleted; never touch an externally hosted URL.
  if (!url.includes("res.cloudinary.com") && !url.includes("/uploads/")) return undefined;

  const withoutQuery = url.split("?")[0] ?? "";
  const marker = "/image/upload/";
  if (withoutQuery.includes(marker)) {
    const tail = withoutQuery.slice(withoutQuery.indexOf(marker) + marker.length);
    const withoutNoise = tail
      .split("/")
      .filter((segment) => segment !== "")
      // Transformation segment: `c_fill,g_face,w_512,h_512,q_auto,f_auto`.
      .filter((segment) => !segment.includes(","))
      // Version segment: `v1791658672`.
      .filter((segment) => !/^v\d+$/.test(segment))
      .join("/");
    return withoutNoise.replace(/\.[a-z0-9]+$/i, "") || undefined;
  }

  // The local fallback mirrors the publicId in the path, so it needs no reshaping.
  const rest = withoutQuery.slice(withoutQuery.indexOf("/uploads/") + "/uploads/".length);
  return rest.replace(/\.[a-z0-9]+$/i, "") || undefined;
}

function toUploadError(error: unknown): Error {
  if (error instanceof UploadError) return error;
  if (error instanceof ApiError) {
    if (error.status === 413) return new UploadError("Image must be under 5 MB");
    if (error.status === 400)
      return new UploadError(error.message || "That file cannot be uploaded");
    return new UploadError(error.message);
  }
  return new UploadError("Upload failed. Please try again.");
}
