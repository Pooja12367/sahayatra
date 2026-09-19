"use client";

import L, { type LatLngExpression } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Tooltip,
  TileLayer,
  useMap,
} from "react-leaflet";
import { RoutePolyline } from "@/components/map/RoutePolyline";
import type { FullTripRoute, RouteCoordinates } from "@/types/routes";
import { createAmbulanceIcon, createHospitalIcon, createPatientIcon } from "./icons";

type TripMapClientProps = {
  ambulanceCoordinates: RouteCoordinates;
  pickupCoordinates: RouteCoordinates;
  hospitalCoordinates: RouteCoordinates;
  route: FullTripRoute | null;
  ambulanceDetails?: { code: string; driverName?: string };
  hospitalDetails?: { name: string };
  patientDetails?: { name: string; phone?: string };
  /** When true the map fills the fullscreen overlay — just changes container height */
  fullscreen?: boolean;
};

type StaticPoint = {
  id: "pickup" | "hospital";
  label: string;
  details?: string;
  coordinates: RouteCoordinates;
  color: string;
  fillColor: string;
};

function toLatLng(coordinates: RouteCoordinates): LatLngExpression {
  const [lng, lat] = coordinates;
  return [lat, lng];
}

function coordinatesOverlap(
  first: RouteCoordinates,
  second: RouteCoordinates,
) {
  const [firstLng, firstLat] = first;
  const [secondLng, secondLat] = second;

  return (
    Math.abs(firstLng - secondLng) < 0.00005 &&
    Math.abs(firstLat - secondLat) < 0.00005
  );
}


/**
 * Animated ambulance marker — uses an imperative ref so Leaflet animates the
 * position change smoothly instead of a React re-render snap.
 */
function AmbulanceMarker({
  coordinates,
  details,
}: {
  coordinates: RouteCoordinates;
  details?: { code: string; driverName?: string };
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const icon = useMemo(() => createAmbulanceIcon(), []);
  const position = toLatLng(coordinates);

  // On every coordinate update, slide marker to the new position.
  // Leaflet handles the CSS transition automatically.
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng(toLatLng(coordinates));
    }
  }, [coordinates]);

  return (
    <Marker icon={icon} position={position} ref={markerRef}>
      <Tooltip direction="top" offset={[0, -20]} opacity={1}>
        <div className="font-medium">Ambulance {details?.code ?? ""}</div>
        {details?.driverName ? <div className="text-xs text-muted-foreground">{details.driverName}</div> : null}
      </Tooltip>
      <Popup>
        <div className="font-medium">Ambulance {details?.code ?? ""}</div>
        {details?.driverName ? <div className="text-xs text-muted-foreground">{details.driverName}</div> : null}
      </Popup>
    </Marker>
  );
}

function allRouteCoordinates(route: FullTripRoute | null) {
  if (!route) {
    return [];
  }

  return [
    ...route.ambulanceToPickup.geometry.coordinates,
    ...route.pickupToHospital.geometry.coordinates,
  ];
}

/**
 * Fits map bounds only once on initial mount. After that the user can freely
 * pan/zoom without the map snapping back every time the ambulance moves.
 */
function FitMapBounds({
  coordinates,
}: {
  coordinates: RouteCoordinates[];
}) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (hasFit.current || coordinates.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(coordinates.map(toLatLng));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
    hasFit.current = true;
  }, [coordinates, map]);

  return null;
}

/**
 * When `following` is true this component pans the map to the ambulance
 * position on every coordinate update, keeping the ambulance centred.
 * Detects user drag/pan events and disables following automatically.
 */
function FollowAmbulance({
  coordinates,
  following,
  onUserDrag,
}: {
  coordinates: RouteCoordinates;
  following: boolean;
  onUserDrag: () => void;
}) {
  const map = useMap();

  // Disable following when the user manually drags/pans the map
  useEffect(() => {
    const handleDragStart = () => {
      if (following) onUserDrag();
    };
    map.on("dragstart", handleDragStart);
    return () => {
      map.off("dragstart", handleDragStart);
    };
  }, [map, following, onUserDrag]);

  useEffect(() => {
    if (!following) return;
    map.panTo(toLatLng(coordinates), { animate: true, duration: 0.6 });
  }, [coordinates, following, map]);

  return null;
}

/**
 * Custom Leaflet control rendered as a React component placed *inside*
 * MapContainer. It adds a "locate / follow ambulance" toggle button and
 * optionally a fullscreen toggle button directly on the map.
 */
function MapControls({
  following,
  onFollowToggle,
  onFullscreenToggle,
  fullscreen,
}: {
  following: boolean;
  onFollowToggle: () => void;
  onFullscreenToggle: () => void;
  fullscreen: boolean;
}) {
  return (
    <>
      {/* Follow-ambulance button */}
      <div
        style={{
          position: "absolute",
          bottom: "24px",
          right: "12px",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <button
          onClick={onFollowToggle}
          title={following ? "Stop following ambulance" : "Follow ambulance"}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            border: "2px solid rgba(255,255,255,0.9)",
            background: following
              ? "linear-gradient(135deg,#059669,#047857)"
              : "rgba(255,255,255,0.95)",
            color: following ? "#fff" : "#374151",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            transition: "all 0.2s ease",
          }}
        >
          {/* Locate / crosshair SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>

        {/* Fullscreen toggle button */}
        <button
          onClick={onFullscreenToggle}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen map"}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            border: "2px solid rgba(255,255,255,0.9)",
            background: fullscreen
              ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
              : "rgba(255,255,255,0.95)",
            color: fullscreen ? "#fff" : "#374151",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            transition: "all 0.2s ease",
          }}
        >
          {fullscreen ? (
            /* Minimize icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            /* Maximize icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}

export default function TripMapClient({
  ambulanceCoordinates,
  hospitalCoordinates,
  pickupCoordinates,
  route,
  ambulanceDetails,
  hospitalDetails,
  patientDetails,
  fullscreen = false,
  onFullscreenToggle,
}: TripMapClientProps & { onFullscreenToggle?: () => void }) {
  const [following, setFollowing] = useState(false);

  // Auto-enable following whenever fullscreen is activated so the ambulance
  // stays centred in the fullscreen view without the user pressing the button.
  useEffect(() => {
    if (fullscreen) {
      setFollowing(true);
    }
  }, [fullscreen]);

  const staticPoints = useMemo<StaticPoint[]>(
    () => [
      {
        id: "pickup",
        label: "Patient",
        details: patientDetails?.name ? `${patientDetails.name}${patientDetails.phone ? ` (${patientDetails.phone})` : ""}` : "",
        coordinates: pickupCoordinates,
        color: "#7e22ce",
        fillColor: "#a855f7",
      },
      {
        id: "hospital",
        label: "Hospital",
        details: hospitalDetails?.name ?? "",
        coordinates: hospitalCoordinates,
        color: "#dc2626",
        fillColor: "#ef4444",
      },
    ],
    [hospitalCoordinates, pickupCoordinates, patientDetails, hospitalDetails],
  );

  const boundsCoordinates = useMemo(
    () => [
      ambulanceCoordinates,
      pickupCoordinates,
      hospitalCoordinates,
      ...allRouteCoordinates(route),
    ],
    // Only recalculate when the route changes, not when ambulance moves
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickupCoordinates, hospitalCoordinates, route],
  );

  // Group static points that overlap so their labels merge in popups
  const staticGroups = useMemo(() => {
    return staticPoints.reduce<StaticPoint[][]>((groups, point) => {
      const group = groups.find((items) =>
        coordinatesOverlap(items[0].coordinates, point.coordinates),
      );
      if (group) {
        group.push(point);
        return groups;
      }
      groups.push([point]);
      return groups;
    }, []);
  }, [staticPoints]);

  const mapHeight = fullscreen ? "100%" : "min(60vh, 500px)";

  return (
    <MapContainer
      center={toLatLng(ambulanceCoordinates)}
      style={{ height: mapHeight, width: "100%", minHeight: fullscreen ? "100%" : "400px" }}
      scrollWheelZoom
      zoom={13}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {route ? (
        <>
          <RoutePolyline
            color="#2563eb"
            coordinates={route.ambulanceToPickup.geometry.coordinates}
          />
          <RoutePolyline
            color="#0f766e"
            coordinates={route.pickupToHospital.geometry.coordinates}
          />
        </>
      ) : null}

      {/* Animated ambulance marker — slides smoothly as GPS updates */}
      <AmbulanceMarker coordinates={ambulanceCoordinates} details={ambulanceDetails} />

      {/* Static circle markers for pickup and hospital */}
      {staticGroups.map((group) =>
        group.map((point, index) => {
          const spread = 0.00012;
          const angle =
            group.length === 1
              ? 0
              : (2 * Math.PI * index) / group.length - Math.PI / 2;
          const [lng, lat] = point.coordinates;
          const center: LatLngExpression =
            group.length === 1
              ? toLatLng(point.coordinates)
              : [
                  lat + Math.sin(angle) * spread,
                  lng + Math.cos(angle) * spread,
                ];

          const icon = point.id === "pickup" ? createPatientIcon() : createHospitalIcon();

          return (
            <Marker
              position={center}
              key={point.id}
              icon={icon}
            >
              <Tooltip direction="top" offset={[0, -20]} opacity={1}>
                {group.map((p, i) => (
                  <div key={i}>
                    <div className="font-medium">{p.label}</div>
                    {p.details ? <div className="text-xs text-muted-foreground">{p.details}</div> : null}
                  </div>
                ))}
              </Tooltip>
              <Popup>
                {group.map((p, i) => (
                  <div key={i} className="mb-1 last:mb-0">
                    <div className="font-medium">{p.label}</div>
                    {p.details ? <div className="text-xs text-muted-foreground">{p.details}</div> : null}
                  </div>
                ))}
              </Popup>
            </Marker>
          );
        }),
      )}

      <FitMapBounds coordinates={boundsCoordinates} />

      {/* Auto-follow the ambulance when enabled; stop following on manual drag */}
      <FollowAmbulance
        coordinates={ambulanceCoordinates}
        following={following}
        onUserDrag={() => setFollowing(false)}
      />

      {/* Custom map controls (follow + fullscreen) */}
      <MapControls
        following={following}
        onFollowToggle={() => setFollowing((f) => !f)}
        onFullscreenToggle={onFullscreenToggle ?? (() => {})}
        fullscreen={fullscreen}
      />
    </MapContainer>
  );
}
