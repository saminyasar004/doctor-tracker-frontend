import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX = 2 * 1024 * 1024;

export function AvatarUpload({
  value,
  onChange,
}: {
  value?: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image file");
    if (file.size > MAX) return setError("Image must be under 2 MB");
    setError(null);
    const r = new FileReader();
    r.onload = () => onChange(String(r.result));
    r.readAsDataURL(file);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload avatar"
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          read(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer items-center gap-4 rounded-xl border border-dashed p-3 transition-colors hover:bg-accent/50",
          drag && "border-primary bg-primary/5",
        )}
      >
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-muted">
          {value ? (
            <img src={value} alt="Avatar preview" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <ImagePlus className="size-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{value ? "Change photo" : "Upload a photo"}</p>
          <p className="text-xs text-muted-foreground">
            Drag & drop or click · PNG, JPG up to 2 MB
          </p>
        </div>
        {value && (
          <button
            type="button"
            aria-label="Remove photo"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => read(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
