import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type AdminStatCardProps = {
  title: string;
  value: number;
  description: string;
  href?: string;
  icon: LucideIcon;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
};

const toneClasses = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-700",
};

export function AdminStatCard({
  title,
  value,
  description,
  href,
  icon: Icon,
  tone = "blue",
}: AdminStatCardProps) {
  const card = (
    <Card className="h-full border-blue-100/80 bg-white/90 shadow-lg shadow-blue-950/5 transition hover:border-blue-200 hover:bg-white hover:shadow-xl hover:shadow-blue-950/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {value}
            </p>
          </div>
          <div className={`rounded-lg p-2 ${toneClasses[tone]}`}>
            <Icon className="size-5" />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  if (!href) {
    return card;
  }

  return (
    <Link
      aria-label={`Open ${title.toLowerCase()}`}
      className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-blue-500/25"
      href={href}
    >
      {card}
    </Link>
  );
}
