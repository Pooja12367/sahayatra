"use client";

import dynamic from "next/dynamic";
import { Crosshair } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationDisplay } from "@/components/location/location-display";
import { isValidCoordinates } from "@/lib/location-validation";
import { lookupLocationName } from "@/lib/location-geocoding";

type Coordinates = [number, number];

const LocationMapPicker = dynamic(
  () => import("@/components/location/location-map-picker.client"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
        Loading map...
      </div>
    ),
  },
);

type LocationInputProps = {
  address?: string | null;
  onAddressChange?: (value: string) => void;
  latitude: string;
  longitude: string;
  onCoordinatesChange?: (coordinates: {
    latitude: string;
    longitude: string;
  }) => void;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  title: string;
  iconType?: "hospital" | "ambulance" | "patient" | "default";
};

function toCoordinateStrings([lng, lat]: Coordinates) {
  return {
    latitude: String(Number(lat.toFixed(6))),
    longitude: String(Number(lng.toFixed(6))),
  };
}

function validCoordinates(
  longitude: string,
  latitude: string,
): Coordinates | null {
  const lng = Number(longitude);
  const lat = Number(latitude);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return [lng, lat];
}

export function LocationInput({
  address,
  latitude,
  longitude,
  onCoordinatesChange,
  onAddressChange,
  onLatitudeChange,
  onLongitudeChange,
  title,
  iconType = "default",
}: LocationInputProps) {
  const coordinates = validCoordinates(longitude, latitude);
  const [message, setMessage] = useState<string | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [pendingCoordinates, setPendingCoordinates] =
    useState<Coordinates | null>(coordinates);

  function applyCoordinates(nextCoordinates: Coordinates) {
    const next = toCoordinateStrings(nextCoordinates);
    if (onCoordinatesChange) {
      onCoordinatesChange(next);
      return;
    }

    onLongitudeChange(next.longitude);
    onLatitudeChange(next.latitude);
  }

  function applyAddress(nextCoordinates: Coordinates) {
    if (!onAddressChange) {
      return;
    }

    void lookupLocationName(nextCoordinates)
      .then(onAddressChange)
      .catch(() => onAddressChange(""));
  }

  function commitCoordinates(nextCoordinates: Coordinates) {
    setPendingCoordinates(nextCoordinates);
    applyCoordinates(nextCoordinates);
    applyAddress(nextCoordinates);
  }

  function toggleMap() {
    if (isMapOpen) {
      setIsMapOpen(false);
      return;
    }

    setPendingCoordinates(coordinates);
    setIsMapOpen(true);
  }

  function handleUseCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setMessage("Current location is unavailable in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        commitCoordinates([
          position.coords.longitude,
          position.coords.latitude,
        ]);
        setIsMapOpen(true);
        setMessage("Current location applied.");
      },
      (error) => {
        setMessage(error.message || "Could not read current location.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Label>{title}</Label>
          <div className="mt-2">
            <LocationDisplay
              address={address}
              coordinates={coordinates}
              label={title}
              mapMode="none"
            />
          </div>
        </div>
        <Button onClick={handleUseCurrentLocation} type="button" variant="outline">
          <Crosshair className="size-4" />
          Use current
        </Button>
      </div>

      <div className="rounded-lg border bg-background p-3">
        <button
          className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium"
          onClick={toggleMap}
          type="button"
        >
          <span>Pick from map</span>
          <span className="text-xs text-muted-foreground">
            {isMapOpen ? "Hide map" : "Open map"}
          </span>
        </button>
        {isMapOpen ? (
          <div className="mt-3 space-y-2">
            <LocationMapPicker
              coordinates={pendingCoordinates}
              iconType={iconType}
              onChange={(nextCoordinates) => {
                setPendingCoordinates(nextCoordinates);
                applyCoordinates(nextCoordinates);
                applyAddress(nextCoordinates);
                setMessage("Map location selected.");
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <LocationDisplay
                coordinates={pendingCoordinates}
                label="Pending location"
                mapMode="none"
              />
              <Button
                disabled={!isValidCoordinates(pendingCoordinates)}
                onClick={() => {
                  if (!pendingCoordinates) return;
                  commitCoordinates(pendingCoordinates);
                  setIsMapOpen(false);
                  setMessage("Location selected.");
                }}
                type="button"
              >
                Select location
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Drag the marker to adjust the location. You can also click or tap
              the map to move the marker there.
            </p>
          </div>
        ) : null}
      </div>

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

      <details className="rounded-lg border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Advanced coordinate entry
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input
              onBlur={() => {
                if (coordinates) applyAddress(coordinates);
              }}
              onChange={(event) => {
                onLongitudeChange(event.target.value);
                onAddressChange?.("");
              }}
              value={longitude}
            />
          </div>
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input
              onBlur={() => {
                if (coordinates) applyAddress(coordinates);
              }}
              onChange={(event) => {
                onLatitudeChange(event.target.value);
                onAddressChange?.("");
              }}
              value={latitude}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
