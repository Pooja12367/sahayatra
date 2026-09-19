"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Coordinates = [number, number];

const LocationPreviewMap = dynamic(
  () => import("@/components/location/location-preview-map.client"),
  {
    ssr: false,
    loading: () => (
      <div className="mt-3 flex h-72 items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground sm:h-80">
        Loading map...
      </div>
    ),
  },
);

type LocationDisplayProps = {
  address?: string | null;
  className?: string;
  coordinates?: Coordinates | null;
  label?: string;
  mapMode?: "inline" | "none";
  tone?: "default" | "muted";
};

function isValidCoordinates(
  coordinates: Coordinates | null | undefined,
): coordinates is Coordinates {
  return (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every((coordinate) => Number.isFinite(coordinate))
  );
}

export function LocationDisplay({
  address,
  className,
  coordinates,
  label = "Location",
  mapMode = "inline",
  tone = "default",
}: LocationDisplayProps) {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const hasCoordinates = isValidCoordinates(coordinates);
  const primaryText = address?.trim() || label;

  if (!hasCoordinates && !address?.trim()) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        Location unavailable
      </span>
    );
  }

  if (mapMode === "none") {
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-2 text-sm",
          tone === "muted" ? "text-muted-foreground" : "text-foreground",
          className,
        )}
      >
        <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate">{primaryText}</span>
      </span>
    );
  }

  return (
    <div className={cn("min-w-0 text-sm", className)}>
      <div
        className={cn(
          "inline-flex min-w-0 items-center gap-2",
          tone === "muted" ? "text-muted-foreground" : "text-foreground",
        )}
      >
        <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate">{primaryText}</span>
        {hasCoordinates ? (
          <button
            className="shrink-0 font-medium text-blue-700 underline-offset-4 hover:underline"
            onClick={() => setIsMapOpen((value) => !value)}
            type="button"
          >
            {isMapOpen ? "Hide map" : "Map"}
          </button>
        ) : null}
      </div>
      {hasCoordinates && isMapOpen ? (
        <LocationPreviewMap coordinates={coordinates} />
      ) : null}
    </div>
  );
}
