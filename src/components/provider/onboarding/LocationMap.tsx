"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Guadalajara: centro por defecto mientras no haya ubicación
const DEFAULT_CENTER: [number, number] = [20.6597, -103.3496];

// Pin propio en SVG. Los íconos por defecto de Leaflet suelen romperse con Next.js
const pinIcon = L.divIcon({
  className: "",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  html: `<svg width="32" height="40" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 18 12 18s12-9 12-18C24 5.4 18.6 0 12 0z" fill="#003459"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff"/>
  </svg>`,
});

interface Props {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}

function ClickToPlace({ onPick }: { onPick: Props["onPick"] }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Si la ubicación cae fuera de lo que se ve (ej. tras usar el GPS), mueve el mapa hacia ella
function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat === null || lng === null) return;
    if (!map.getBounds().contains([lat, lng])) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15));
    }
  }, [lat, lng, map]);
  return null;
}

export default function LocationMap({ lat, lng, onPick }: Props) {
  const hasPoint = lat !== null && lng !== null;

  return (
    <div className="relative isolate z-0 h-64 overflow-hidden rounded-2xl">
      <MapContainer
        center={hasPoint ? [lat, lng] : DEFAULT_CENTER}
        zoom={hasPoint ? 15 : 12}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToPlace onPick={onPick} />
        <Recenter lat={lat} lng={lng} />
        {hasPoint && (
          <Marker
            position={[lat, lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend(e) {
                const p = (e.target as L.Marker).getLatLng();
                onPick(p.lat, p.lng);
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}