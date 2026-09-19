"use client";

import { Polyline } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { RouteCoordinates } from "@/types/routes";

function toLatLng(coordinates: RouteCoordinates): LatLngExpression {
  const [lng, lat] = coordinates;
  return [lat, lng];
}

export function RoutePolyline({
  color,
  coordinates,
}: {
  color: string;
  coordinates: RouteCoordinates[];
}) {
  if (coordinates.length < 2) {
    return null;
  }

  return (
    <Polyline
      pathOptions={{ color, opacity: 0.9, weight: 5 }}
      positions={coordinates.map(toLatLng)}
    />
  );
}
