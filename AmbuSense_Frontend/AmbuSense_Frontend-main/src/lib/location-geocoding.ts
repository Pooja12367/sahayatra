export type Coordinates = [number, number];

export async function lookupLocationName([longitude, latitude]: Coordinates) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
    { headers: { Accept: 'application/json' } },
  );

  if (!response.ok) {
    throw new Error('Could not determine the selected place name.');
  }

  const data = (await response.json()) as { display_name?: string };
  const locationName = data.display_name?.trim();

  if (!locationName) {
    throw new Error('Could not determine the selected place name.');
  }

  return locationName;
}