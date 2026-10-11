import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteImage, publicIdFromUrl, uploadImage, type UploadFolder } from "@/lib/api/uploads";

/**
 * Avatar picker backed by `POST /uploads/image`.
 *
 * Picking a file uploads it straight to the API and hands the returned delivery URL
 * back through `onChange`, which is what the doctor/patient `avatarUrl` field
 * expects — the DTOs validate it as an absolute http(s) URL, so the file can never
 * be embedded as a data URL in the record itself.
 *
 * Replacing or removing a photo deletes the previously stored asset through
 * `DELETE /uploads/image` so the CDN does not accumulate orphans. A failed delete
 * is not surfaced as an error: the record is already saved and storage backends are
 * idempotent.
 */
export function AvatarUpload({
  value,
  onChange,
  folder,
  disabled,
}: {
  value?: string | undefined;
  onChange: (v: string | undefined) => void;
  folder: UploadFolder;
  disabled?: boolean | undefined;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async (file?: File) => {
    if (!file || uploading || disabled) return;
    setError(null);
    setUploading(true);

    const previous = value;
    try {
      const uploaded = await uploadImage(file, folder);
      onChange(uploaded.url);
      // Only drop the old asset once its replacement is safely stored.
      const previousId = previous ? publicIdFromUrl(previous) : undefined;
      if (previousId) void deleteImage(previousId).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const remove = async () => {
    const current = value;
    onChange(undefined);
    setError(null);
    const currentId = current ? publicIdFromUrl(current) : undefined;
    if (currentId) void deleteImage(currentId).catch(() => undefined);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload avatar"
        aria-busy={uploading}
        aria-disabled={disabled || uploading}
        onClick={() => !disabled && !uploading && ref.current?.click()}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && !disabled && !uploading && ref.current?.click()
        }
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void read(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex items-center gap-4 rounded-xl border border-dashed p-3 transition-colors",
          !disabled && !uploading && "cursor-pointer hover:bg-accent/50",
          uploading && "opacity-70",
          drag && "border-primary bg-primary/5",
        )}
      >
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-muted">
          {value ? (
            <img src={value} alt="Avatar preview" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              {uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ImagePlus className="size-5" />
              )}
            </div>
          )}
          {uploading && value && (
            <div className="absolute inset-0 grid place-items-center bg-background/60">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">
            {uploading ? "Uploading…" : value ? "Change photo" : "Upload a photo"}
          </p>
          <p className="text-xs text-muted-foreground">
            Drag &amp; drop or click · JPG, PNG or WebP up to 5 MB
          </p>
        </div>
        {value && !uploading && (
          <button
            type="button"
            aria-label="Remove photo"
            onClick={(e) => {
              e.stopPropagation();
              void remove();
            }}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => void read(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
