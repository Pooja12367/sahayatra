"use client";

import L from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { createAmbulanceIcon, createHospitalIcon, createPatientIcon } from "../map/icons";

type Coordinates = [number, number];

type LocationMapPickerProps = {
  coordinates: Coordinates | null;
  onChange: (coordinates: Coordinates) => void;
  iconType?: "hospital" | "ambulance" | "patient" | "default";
};

const defaultCoordinates: Coordinates = [85.324, 27.7172];



function toLatLng([lng, lat]: Coordinates): [number, number] {
  return [lat, lng];
}

function MapClickHandler({
  onChange,
}: {
  onChange: (coordinates: Coordinates) => void;
}) {
  const map = useMapEvents({
    click(event) {
      map.setView(event.latlng, map.getZoom());
      onChange([event.latlng.lng, event.latlng.lat]);
    },
  });

  return null;
}

function SyncMapCenter({ coordinates }: { coordinates: Coordinates }) {
  const map = useMap();

  useEffect(() => {
    map.setView(toLatLng(coordinates), map.getZoom(), { animate: true });
  }, [coordinates, map]);

  return null;
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

export default function LocationMapPicker({
  coordinates,
  onChange,
  iconType = "default",
}: LocationMapPickerProps) {
  const [selectedCoordinates, setSelectedCoordinates] =
    useState<Coordinates>(coordinates ?? defaultCoordinates);

  useEffect(() => {
    if (coordinates) {
      setSelectedCoordinates(coordinates);
    }
  }, [coordinates]);

  const handleChange = useCallback((nextCoordinates: Coordinates) => {
    setSelectedCoordinates(nextCoordinates);
    onChange(nextCoordinates);
  }, [onChange]);

  const markerEventHandlers = useMemo(
    () => ({
      dragend(event: L.LeafletEvent) {
        const marker = event.target as L.Marker;
        const position = marker.getLatLng();
        handleChange([position.lng, position.lat]);
      },
    }),
    [handleChange],
  );

  return (
    <div className="relative overflow-hidden rounded-lg border">
      <MapContainer
        center={toLatLng(selectedCoordinates)}
        className="h-72 w-full"
        scrollWheelZoom
        zoom={14}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          draggable
          eventHandlers={markerEventHandlers}
          icon={
            iconType === "hospital"
              ? createHospitalIcon()
              : iconType === "ambulance"
                ? createAmbulanceIcon()
                : iconType === "patient"
                  ? createPatientIcon()
                  : createAmbulanceIcon()
          }
          position={toLatLng(selectedCoordinates)}
        />
        <MapClickHandler onChange={handleChange} />
        <RefreshMapSize />
        <SyncMapCenter coordinates={selectedCoordinates} />
      </MapContainer>
    </div>
  );
}
