import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GENDER_LABEL, type Gender } from "@/lib/types";

const TONES = {
  rose: "border-tone-rose/25 bg-tone-rose/10 text-tone-rose",
  amber: "border-tone-amber/25 bg-tone-amber/10 text-tone-amber",
  emerald: "border-tone-emerald/25 bg-tone-emerald/10 text-tone-emerald",
  sky: "border-tone-sky/25 bg-tone-sky/10 text-tone-sky",
  violet: "border-tone-violet/25 bg-tone-violet/10 text-tone-violet",
  teal: "border-tone-teal/25 bg-tone-teal/10 text-tone-teal",
  orange: "border-tone-orange/25 bg-tone-orange/10 text-tone-orange",
  slate: "border-tone-slate/25 bg-tone-slate/10 text-tone-slate",
} as const;
export type Tone = keyof typeof TONES;
const ORDER = Object.keys(TONES) as Tone[];

function hashTone(s: string): Tone {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ORDER[h % ORDER.length] ?? "slate";
}

const CONDITION_TONE: Record<string, Tone> = {
  Hypertension: "rose",
  Arrhythmia: "rose",
  Diabetes: "amber",
  Migraine: "violet",
  Epilepsy: "violet",
  Asthma: "sky",
  Fracture: "orange",
  Arthritis: "orange",
  Anxiety: "teal",
  Depression: "slate",
  Eczema: "emerald",
  Psoriasis: "emerald",
};
const SPEC_TONE: Record<string, Tone> = {
  Cardiology: "rose",
  Neurology: "violet",
  Pediatrics: "sky",
  Orthopedics: "orange",
  Dermatology: "emerald",
  Oncology: "amber",
  Psychiatry: "teal",
  Radiology: "slate",
};
const GENDER_TONE: Record<Gender, Tone> = { MALE: "sky", FEMALE: "rose", OTHER: "violet" };

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <Badge variant="outline" className={cn("rounded-md font-medium", TONES[tone], className)}>
      {children}
    </Badge>
  );
}

export function ConditionBadge({
  condition,
  className,
}: {
  condition: string;
  className?: string | undefined;
}) {
  return (
    <ToneBadge tone={CONDITION_TONE[condition] ?? hashTone(condition)} className={className}>
      {condition}
    </ToneBadge>
  );
}

export function SpecializationBadge({
  specialization,
  className,
}: {
  specialization: string;
  className?: string | undefined;
}) {
  return (
    <ToneBadge tone={SPEC_TONE[specialization] ?? hashTone(specialization)} className={className}>
      {specialization}
    </ToneBadge>
  );
}

export function GenderBadge({ gender }: { gender: Gender }) {
  return <ToneBadge tone={GENDER_TONE[gender]}>{GENDER_LABEL[gender]}</ToneBadge>;
}
