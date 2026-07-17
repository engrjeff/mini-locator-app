import { useState } from 'react';
import './App.css';
import { useGeofence, type Coordinates } from './lib/geo-fencing';

const STORE_COORDINATES: Coordinates = {
  latitude: 14.4921251,
  longitude: 121.218275,
};

const RADIUS = 100; // in meters

function App() {
  const [radius, setRadius] = useState(RADIUS);
  const geofenceResult = useGeofence(STORE_COORDINATES, radius);

  return (
    <main>
      <div>
        <p>
          <strong>Store</strong>
        </p>
        <p>Lat: {STORE_COORDINATES.latitude}</p>
        <p>Lat: {STORE_COORDINATES.longitude}</p>
        <div>
          <label htmlFor="radius" style={{ display: 'block' }}>
            Required Radius: {radius}m
          </label>
          <input
            type="range"
            name="radius"
            step={10}
            min={0}
            max={100}
            value={radius}
            onChange={(e) => setRadius(e.currentTarget.valueAsNumber)}
          />
        </div>
      </div>
      <hr />
      {geofenceResult.loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          <p>
            <strong>You</strong>
          </p>
          <p>Source: {geofenceResult.source}</p>
          <p>Accuracy: {geofenceResult.accuracy}</p>
          <p>Lat: {geofenceResult.location?.latitude}</p>
          <p>Lat: {geofenceResult.location?.longitude}</p>
          <p>Distance: {geofenceResult.distance?.toFixed(2)} m</p>
          <p>Quality: {geofenceResult.quality}</p>
          <br />

          <p>
            Able to Clock In?{' '}
            {geofenceResult.canClockIn ? (
              <strong style={{ color: 'green' }}>Yes</strong>
            ) : (
              <strong style={{ color: 'red' }}>No</strong>
            )}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={geofenceResult.loading}
        onClick={geofenceResult.refresh}
      >
        Refresh
      </button>
    </main>
  );
}

export default App;
