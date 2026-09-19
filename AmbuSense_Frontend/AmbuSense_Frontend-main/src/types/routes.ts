export type RouteCoordinates = [number, number];

export type RouteGeometry = {
  type: string;
  coordinates: RouteCoordinates[];
};

export type RouteLeg = {
  sourceCoordinates: RouteCoordinates;
  destinationCoordinates: RouteCoordinates;
  distanceInMeters: number;
  durationInSeconds: number;
  durationInMinutes: number;
  geometry: RouteGeometry;
};

export type FullTripRoute = {
  ambulanceToPickup: RouteLeg;
  pickupToHospital: RouteLeg;
  totalDistance: number;
  totalDuration: number;
};
