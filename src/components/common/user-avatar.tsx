import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <Avatar className={cn("size-9 ring-1 ring-border", className)}>
      {src && <AvatarImage src={src} alt={name} className="object-cover" />}
      <AvatarFallback className="bg-brand text-[0.7em] font-semibold text-brand-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
