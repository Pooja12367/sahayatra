"use client";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { createAmbulanceIcon, createHospitalIcon, createPatientIcon } from "../map/icons";

type Coordinates = [number, number];

type LocationPreviewMapProps = {
  coordinates: Coordinates;
  iconType?: "hospital" | "ambulance" | "patient" | "default";
};



function toLatLng([lng, lat]: Coordinates): [number, number] {
  return [lat, lng];
}

function RefreshMapSize() {
  const map = useMap();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [map]);

  return null;
}

export default function LocationPreviewMap({
  coordinates,
  iconType = "default",
}: LocationPreviewMapProps) {
  const icon =
    iconType === "hospital"
      ? createHospitalIcon()
      : iconType === "ambulance"
        ? createAmbulanceIcon()
        : iconType === "patient"
          ? createPatientIcon()
          : createAmbulanceIcon(); // Default to ambulance for generic locations if needed, or we could keep a generic one. Let's use ambulance as default fallback for now since it's Sahayatra.

  return (
    <div className="relative z-0 mt-3 overflow-hidden rounded-lg border">
      <MapContainer
        center={toLatLng(coordinates)}
        className="h-72 w-full sm:h-80"
        dragging
        scrollWheelZoom={false}
        zoom={15}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker icon={icon} position={toLatLng(coordinates)} />
        <RefreshMapSize />
      </MapContainer>
    </div>
  );
}
