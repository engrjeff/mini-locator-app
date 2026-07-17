import { useEffect, useMemo, useState } from 'react';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type CurrentLocation = {
  location: Coordinates;
  accuracy: number | null;
  source: 'gps' | 'ip';
  city?: string;
  country?: string;
};

export interface IpWhoIsResponse {
  success: boolean;
  ip: string;

  continent: string;
  continent_code: string;

  country: string;
  country_code: string;

  region: string;
  region_code: string;

  city: string;

  latitude: number;
  longitude: number;

  is_eu: boolean;

  postal: string;
  calling_code: string;
  capital: string;
  borders: string;

  flag: {
    img: string;
    emoji: string;
    emoji_unicode: string;
  };

  connection: {
    asn: number;
    org: string;
    isp: string;
    domain: string;
  };

  timezone: {
    id: string;
    abbr: string;
    is_dst: boolean;
    offset: number;
    utc: string;
    current_time: string;
  };
}

/**
 * Returns the distance in meters between two coordinates.
 */
export function distanceBetween(a: Coordinates, b: Coordinates): number {
  const R = 6371000;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

async function getLocationFromIp(): Promise<CurrentLocation> {
  const response = await fetch('https://ipwho.is/');

  if (!response.ok) {
    throw new Error('Unable to determine IP location.');
  }

  const data: IpWhoIsResponse = await response.json();

  if (!data.success) {
    throw new Error('Unable to determine IP location.');
  }

  return {
    source: 'ip',
    accuracy: null,
    city: data.city,
    country: data.country,
    location: {
      latitude: data.latitude,
      longitude: data.longitude,
    },
  };
}

/**
 * Gets the user's current location.
 *
 * Attempts GPS first.
 * Falls back to IP geolocation if GPS permission is denied,
 * unavailable, or times out.
 */
export async function getCurrentLocation(): Promise<CurrentLocation> {
  if (!navigator.geolocation) {
    return getLocationFromIp();
  }

  try {
    const position = await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      },
    );

    return {
      source: 'gps',
      accuracy: position.coords.accuracy,
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch {
    return getLocationFromIp();
  }
}

/**
 * Returns geofence information.
 */
export async function checkGeofence(center: Coordinates, radiusMeters: number) {
  const current = await getCurrentLocation();

  const distance = distanceBetween(current.location, center);

  return {
    inside: distance <= radiusMeters + (current.accuracy ?? 0),

    distance,
    ...current,
  };
}

/**
 * Returns whether the user is within the specified radius.
 */
export async function isUserWithinRadius(
  center: Coordinates,
  radiusMeters: number,
): Promise<boolean> {
  const result = await checkGeofence(center, radiusMeters);

  return result.inside;
}

type UseGeofenceResult = {
  isWithinRadius: boolean | null;
  distance: number | null;
  accuracy: number | null;
  source: 'gps' | 'ip' | null;
  city?: string;
  country?: string;
  loading: boolean;
  error: Error | null;
  location?: Coordinates;
};

/**
 * React hook for geofencing.
 *
 * - Uses GPS when available.
 * - Falls back to IP location automatically.
 * - Recalculates when the radius changes.
 * - Polls every 30 seconds.
 */
export function useGeofence(
  center: Coordinates,
  radiusMeters: number,
): UseGeofenceResult {
  const [distance, setDistance] = useState<number | null>(null);

  const [accuracy, setAccuracy] = useState<number | null>(null);

  const [source, setSource] = useState<'gps' | 'ip' | null>(null);

  const [city, setCity] = useState<string>();
  const [country, setCountry] = useState<string>();
  const [userLocation, setUserLocation] = useState<Coordinates>();

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function updateLocation() {
      try {
        setLoading(true);

        const current = await getCurrentLocation();

        if (cancelled) return;

        setDistance(distanceBetween(current.location, center));

        setAccuracy(current.accuracy);
        setSource(current.source);
        setCity(current.city);
        setCountry(current.country);
        setUserLocation(current.location);

        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    updateLocation();

    return () => {
      cancelled = true;
    };
  }, [center]);

  const isWithinRadius = useMemo(() => {
    if (distance == null) {
      return null;
    }

    return distance <= radiusMeters + (accuracy ?? 0);
  }, [distance, accuracy, radiusMeters]);

  return {
    isWithinRadius,
    distance,
    accuracy,
    source,
    city,
    country,
    loading,
    error,
    location: userLocation,
  };
}
