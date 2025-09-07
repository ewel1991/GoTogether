import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import axios from "axios";

const RouteMap = ({ originCoords, destinationCoords }) => {
  const [route, setRoute] = useState([]);

  useEffect(() => {
    if (!originCoords || !destinationCoords) return;

    const fetchRoute = async () => {
      const apiKey = "TWÓJ_API_KEY_OR"; 

      try {
        const res = await axios.post(
          "https://api.openrouteservice.org/v2/directions/driving-car",
          {
            coordinates: [originCoords.reverse(), destinationCoords.reverse()],
          },
          {
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
          }
        );

        const coords = res.data.features[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        setRoute(coords);
      } catch (err) {
        console.error("Błąd pobierania trasy:", err);
      }
    };

    fetchRoute();
  }, [originCoords, destinationCoords]);

  return (
    <MapContainer
      center={originCoords}
      zoom={10}
      style={{ height: "400px", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Marker position={originCoords}>
        <Popup>Start</Popup>
      </Marker>
      <Marker position={destinationCoords}>
        <Popup>Cel</Popup>
      </Marker>
      {route.length > 0 && <Polyline positions={route} color="blue" />}
    </MapContainer>
  );
};

export default RouteMap;
