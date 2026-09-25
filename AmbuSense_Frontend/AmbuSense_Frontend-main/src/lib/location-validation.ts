export const PHONE_REGEX = /^[0-9]{10}$/;

export function isValidCoordinates(
  coordinates: [number, number] | null | undefined,
): coordinates is [number, number] {
  if (!coordinates || coordinates.length !== 2) {
    return false;
  }
  const [longitude, latitude] = coordinates;
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}