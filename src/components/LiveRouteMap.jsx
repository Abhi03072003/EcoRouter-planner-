"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const liveIcon = new L.DivIcon({
  className: "live-marker",
  html: "<span></span>",
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

function FitToPoints({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [30, 30] });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [map, points]);

  return null;
}

export default function LiveRouteMap({ source, destination, userLocation, userTrail = [] }) {
  const [isClientReady, setIsClientReady] = useState(false);
  const [mapInstanceKey] = useState(() => `live-map-${Date.now()}`);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  const points = useMemo(() => {
    const p = [];
    if (source) p.push([source.lat, source.lon]);
    if (destination) p.push([destination.lat, destination.lon]);
    return p;
  }, [source, destination]);

  const center =
    (userLocation && [userLocation.lat, userLocation.lon]) ||
    (source && [source.lat, source.lon]) ||
    [28.6139, 77.209];

  const trailPoints = userTrail
    .filter((p) => p?.lat != null && p?.lon != null)
    .map((p) => [p.lat, p.lon]);

  const fitPoints = useMemo(
    () => [...points, ...(userLocation ? [[userLocation.lat, userLocation.lon]] : [])],
    [points, userLocation]
  );

  if (!isClientReady) {
    return (
      <div className="live-map-wrap live-map-placeholder">
        <p>Loading interactive map...</p>
      </div>
    );
  }

  return (
    <div className="live-map-wrap">
      <MapContainer key={mapInstanceKey} center={center} zoom={11} scrollWheelZoom className="live-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {source && (
          <Marker position={[source.lat, source.lon]} icon={markerIcon}>
            <Popup>Source: {source.name}</Popup>
          </Marker>
        )}

        {destination && (
          <Marker position={[destination.lat, destination.lon]} icon={markerIcon}>
            <Popup>Destination: {destination.name}</Popup>
          </Marker>
        )}

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lon]} icon={liveIcon}>
            <Popup>Live Location</Popup>
          </Marker>
        )}

        {points.length >= 2 && <Polyline positions={points} color="#f0ab1a" weight={5} />}
        {trailPoints.length >= 2 && <Polyline positions={trailPoints} color="#10b981" weight={4} />}
        <FitToPoints points={fitPoints} />
      </MapContainer>
    </div>
  );
}
