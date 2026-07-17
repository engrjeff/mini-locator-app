import { useCallback, useEffect, useMemo, useState } from 'react';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type GpsQuality = 'excellent' | 'good' | 'fair' | 'poor';

export type CurrentLocation = {
  location: Coordinates;
  accuracy: number | null;
  quality: GpsQuality;
  source: 'gps' | 'ip';
  city?: string;
  country?: string;
};

export type GetCurrentLocationOptions = {
  targetAccuracy?: number;
  timeout?: number;
  fallbackToIp?: boolean;
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

type LocationState = {
  loading: boolean;
  error: Error | null;
  current: CurrentLocation | null;
};

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

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

function getGpsQuality(accuracy: number | null): GpsQuality {
  if (accuracy == null) return 'poor';

  if (accuracy <= 10) return 'excellent';

  if (accuracy <= 20) return 'good';

  if (accuracy <= 50) return 'fair';

  return 'poor';
}

/* -------------------------------------------------------------------------- */
/*                              IP Location Fallback                          */
/* -------------------------------------------------------------------------- */

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
    quality: 'poor',

    city: data.city,
    country: data.country,

    location: {
      latitude: data.latitude,
      longitude: data.longitude,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                             GPS (Best Location)                            */
/* -------------------------------------------------------------------------- */

/**
 * Uses watchPosition instead of getCurrentPosition.
 *
 * Waits until:
 *
 * - desired accuracy is achieved
 * OR
 * - timeout expires
 *
 * Returns the best reading collected.
 */
export async function getCurrentLocation(
  options: GetCurrentLocationOptions = {},
): Promise<CurrentLocation> {
  const { targetAccuracy = 20, timeout = 5000, fallbackToIp = true } = options;

  if (!navigator.geolocation) {
    if (fallbackToIp) {
      return getLocationFromIp();
    }

    throw new Error('Geolocation is not supported.');
  }

  try {
    const position = await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        let bestPosition: GeolocationPosition | null = null;

        let finished = false;

        const finish = (position?: GeolocationPosition, error?: Error) => {
          if (finished) return;

          finished = true;

          navigator.geolocation.clearWatch(watchId);

          if (position) {
            resolve(position);
          } else {
            reject(error ?? new Error('Unable to determine location.'));
          }
        };

        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (
              !bestPosition ||
              position.coords.accuracy < bestPosition.coords.accuracy
            ) {
              bestPosition = position;
            }

            if (position.coords.accuracy <= targetAccuracy) {
              finish(position);
            }
          },
          (error) => {
            finish(undefined, new Error(error.message));
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout,
          },
        );

        setTimeout(() => {
          if (bestPosition) {
            finish(bestPosition);
          } else {
            finish(undefined, new Error('Timed out getting location.'));
          }
        }, timeout);
      },
    );

    return {
      source: 'gps',

      accuracy: position.coords.accuracy,

      quality: getGpsQuality(position.coords.accuracy),

      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch (err) {
    if (!fallbackToIp) {
      throw err;
    }

    return getLocationFromIp();
  }
}

/* -------------------------------------------------------------------------- */
/*                               React Hook State                             */
/* -------------------------------------------------------------------------- */

type UseGeofenceResult = {
  loading: boolean;
  error: Error | null;

  location?: Coordinates;

  distance: number | null;

  accuracy: number | null;

  quality: GpsQuality | null;

  source: 'gps' | 'ip' | null;

  city?: string;

  country?: string;

  isWithinRadius: boolean | null;

  canClockIn: boolean;

  refresh: () => Promise<void>;
};

/* -------------------------------------------------------------------------- */
/*                               useGeofence Hook                             */
/* -------------------------------------------------------------------------- */

export function useGeofence(
  center: Coordinates,
  radiusMeters: number,
): UseGeofenceResult {
  const [state, setState] = useState<LocationState>({
    loading: true,
    error: null,
    current: null,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const current = await getCurrentLocation({
        targetAccuracy: 20,
        timeout: 5000,
      });

      setState({
        loading: false,
        error: null,
        current,
      });
    } catch (err) {
      setState({
        loading: false,
        error: err as Error,
        current: null,
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const current = await getCurrentLocation({
          targetAccuracy: 20,
          timeout: 5000,
        });

        if (!mounted) return;

        setState({
          loading: false,
          error: null,
          current,
        });
      } catch (err) {
        if (!mounted) return;

        setState({
          loading: false,
          error: err as Error,
          current: null,
        });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Everything below is derived state.
   * No additional React state is needed.
   */

  const distance = state.current
    ? distanceBetween(state.current.location, center)
    : 0;

  const isWithinRadius = distance <= radiusMeters;

  /**
   * Example rule for clock in.
   *
   * Feel free to make this stricter later.
   */
  const canClockIn = useMemo(() => {
    if (!state.current) {
      return false;
    }

    return (
      isWithinRadius === true &&
      state.current.source === 'gps' &&
      state.current.quality !== 'poor'
    );
  }, [state, isWithinRadius]);

  return {
    loading: state.loading,

    error: state.error,

    location: state.current?.location,

    distance,

    accuracy: state.current?.accuracy ?? null,

    quality: state.current?.quality ?? null,

    source: state.current?.source ?? null,

    city: state.current?.city,

    country: state.current?.country,

    isWithinRadius,

    canClockIn,

    refresh,
  };
}

/* -------------------------------------------------------------------------- */
/*                            Utility Functions                               */
/* -------------------------------------------------------------------------- */

export async function checkGeofence(center: Coordinates, radiusMeters: number) {
  const current = await getCurrentLocation();

  const distance = distanceBetween(current.location, center);

  const effectiveRadius = radiusMeters + Math.min(current.accuracy ?? 0, 30);

  return {
    inside: distance <= effectiveRadius,

    distance,

    effectiveRadius,

    canClockIn:
      distance <= effectiveRadius &&
      current.source === 'gps' &&
      current.quality !== 'poor',

    ...current,
  };
}

export async function isUserWithinRadius(
  center: Coordinates,
  radiusMeters: number,
) {
  const result = await checkGeofence(center, radiusMeters);

  return result.inside;
}
