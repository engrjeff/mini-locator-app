import './App.css';
import { useGeofence, type Coordinates } from './lib/geo-fencing';

const STORE_COORDINATES: Coordinates = {
  latitude: 14.4920901,
  longitude: 121.215376,
};

const RADIUS = 100; // in meters

function App() {
  const geofenceResult = useGeofence(STORE_COORDINATES, RADIUS);

  return (
    <main>
      <div>
        <p>
          <strong>Store</strong>
        </p>
        <p>Lat: {STORE_COORDINATES.latitude}</p>
        <p>Lat: {STORE_COORDINATES.longitude}</p>
        <p>Required Radius: {RADIUS}m</p>
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
          <br />

          <p>
            Able to Clock In?{' '}
            {geofenceResult.isWithinRadius ? (
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
        onClick={() => window.location.reload()}
      >
        Refresh
      </button>
    </main>
  );
}

export default App;
