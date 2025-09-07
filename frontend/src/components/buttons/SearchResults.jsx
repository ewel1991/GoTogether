import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import AIHints from "./AIHints";

// API URL z .env
const API_URL = import.meta.env.VITE_REACT_APP_API_URL;

const SearchResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tripParams } = location.state || {};

  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [offers, setOffers] = useState([]);
  const [alternativeOffers, setAlternativeOffers] = useState([]); // NOWE
  const [joinedTrips, setJoinedTrips] = useState([]);
  const [joinedOffers, setJoinedOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [routeCoords, setRouteCoords] = useState([]);

  // --- USER ---
  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_URL}/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error("Błąd fetch /me:", err);
    }
  };

  // --- MOJE DANE ---
  const fetchMyData = async () => {
    try {
      const endpoints = [
        { url: `${API_URL}/trips`, setter: setTrips },
        { url: `${API_URL}/offers`, setter: setOffers },
        { url: `${API_URL}/joined-trips`, setter: setJoinedTrips },
        { url: `${API_URL}/joined-offers`, setter: setJoinedOffers },
      ];
      for (let ep of endpoints) {
        const res = await fetch(ep.url, { credentials: "include" });
        if (!res.ok) throw new Error(`Nie udało się pobrać danych: ${ep.url}`);
        const data = await res.json();
        ep.setter(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- WYNIKI SZUKANIA ---
  const fetchSearchResults = async () => {
    if (!tripParams) return;

    const searchParams = {
      origin: tripParams.origin?.trim(),
      destination: tripParams.destination?.trim(),
      date: tripParams.date,
    };

    if (tripParams.type === "join") {
      searchParams.people = Number(tripParams.people) || 1;
      searchParams.pets =
        tripParams.pets === true ||
        tripParams.pets === "true" ||
        tripParams.pets === 1 ||
        tripParams.pets === "1";
    } else if (tripParams.type === "offer") {
      searchParams.seats_available = Number(tripParams.seats_available) || 1;
      searchParams.pets =
        tripParams.pets === true ||
        tripParams.pets === "true" ||
        tripParams.pets === 1 ||
        tripParams.pets === "1";
    }

    const url = tripParams?.type === "offer" ? "/search-trips" : "/search-offers";

    try {
      const res = await axios.post(`${API_URL}${url}`, searchParams, {
        withCredentials: true,
      });

      if (tripParams.type === "join") {
        const { offers = [], alternatives = [] } = res.data || {};
        setOffers(offers);
        setAlternativeOffers(alternatives);
        setTrips([]);
        setJoinedTrips([]);
        setJoinedOffers([]);
        if (!offers.length && !alternatives.length) {
          setMessage("Nie znaleziono pasujących ofert kierowców");
        }
      } else {
        const data = res.data || [];
        setTrips(data);
        setOffers([]);
        setAlternativeOffers([]);
        setJoinedTrips([]);
        setJoinedOffers([]);
        if (!data.length) {
          setMessage("Nie znaleziono pasujących podróży pasażerów");
        }
      }
    } catch (err) {
      console.error("Błąd pobierania wyników:", err);
      setMessage("Błąd podczas pobierania wyników");
    }
  };

  // --- GEOKODOWANIE MIEJSC ---
  const geocodePlace = async (placeName) => {
    if (!placeName) return null;
    try {
      const res = await axios.get(`http://localhost:3000/api/geocode`, {
        params: { place: placeName },
        withCredentials: true,
      });
      const features = res.data.features;
      if (features && features.length > 0) {
        const [lng, lat] = features[0].geometry.coordinates;
        return { lat, lng };
      }
      return null;
    } catch (err) {
      console.error("Błąd geokodowania:", err);
      return null;
    }
  };

  // --- FETCH ROUTE ---
  const fetchRoute = async () => {
    if (!tripParams.originLat || !tripParams.destinationLat) return;
    setRouteCoords([
      { lat: tripParams.originLat, lng: tripParams.originLng },
      { lat: tripParams.destinationLat, lng: tripParams.destinationLng },
    ]);
  };

  // --- INIT EFFECT ---
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setMessage("");
      await fetchUser();

      if (tripParams) {
        await fetchSearchResults();

        if (!tripParams.originLat || !tripParams.destinationLat) {
          const originCoords = await geocodePlace(tripParams.origin);
          const destinationCoords = await geocodePlace(tripParams.destination);
          if (originCoords && destinationCoords) {
            tripParams.originLat = originCoords.lat;
            tripParams.originLng = originCoords.lng;
            tripParams.destinationLat = destinationCoords.lat;
            tripParams.destinationLng = destinationCoords.lng;
          }
        }
        await fetchRoute();
      } else {
        await fetchMyData();
      }
      setLoading(false);
    };
    init();
  }, [tripParams]);

  // --- DOŁĄCZANIE ---
  const handleJoinOffer = async (offerId) => {
    try {
      const offerToJoin =
        offers.find((o) => o.id === offerId) ||
        alternativeOffers.find((o) => o.id === offerId); // też w alternatywach
      if (!offerToJoin) return;

      const tripId = tripParams?.tripId || null;

      const res = await axios.post(
        `${API_URL}/join-offer/${offerId}`,
        { tripId },
        { withCredentials: true }
      );

      if (res.status === 200) {
        alert("Dołączyłeś do oferty!");
        setJoinedOffers([...joinedOffers, offerToJoin]);
        setOffers(offers.filter((o) => o.id !== offerId));
        setAlternativeOffers(alternativeOffers.filter((o) => o.id !== offerId));
      }
    } catch (err) {
      console.error(err);
      alert("Nie udało się dołączyć do oferty");
    }
  };

  const handleJoinTrip = async (tripId) => {
  try {
    const res = await axios.post(`${API_URL}/join-trip/${tripId}`, {}, { withCredentials: true });
    if (res.status === 200) {
      alert("Dołączyłeś do podróży!");
      setJoinedTrips([...joinedTrips, trips.find(t => t.id === tripId)]);
      setTrips(trips.filter(t => t.id !== tripId));
    }
  } catch (err) {
    console.error(err);
    alert("Nie udało się dołączyć do podróży");
  }
};

  // --- FILTROWANIE ---
  const filteredOffers = offers
    .filter((offer) => offer.user_id !== user?.id)
    .filter((offer) => !joinedOffers.some((jo) => jo.id === offer.id));

  const filteredAlternativeOffers = alternativeOffers
    .filter((offer) => offer.user_id !== user?.id)
    .filter((offer) => !joinedOffers.some((jo) => jo.id === offer.id));

  // --- RENDEROWANIE KART ---
  const renderOfferCard = (offer) => (
  <Card key={`offer-${offer.id}`} className="offer-card" style={{ marginBottom: 12 }}>
    <CardContent>
      <Typography variant="h6">{offer.origin} → {offer.destination}</Typography>
      <Typography color="textSecondary">{new Date(offer.date).toLocaleDateString("pl-PL")}</Typography>
      <Typography>Cena: {offer.price} zł</Typography>
      <Typography>Pojazd: {offer.vehicle_type}</Typography>
      <Typography>Miejsca dostępne: {offer.seats_available}</Typography>
      <Typography>Bagaż: {offer.luggage || "-"}</Typography>
      <Typography>Zwierzęta: {offer.pets ? "Tak" : "Nie"}</Typography>
      <Typography>Notatki: {offer.notes || "-"}</Typography>
      <Typography color="textSecondary">
        Ważna do: {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString("pl-PL") : "-"}
      </Typography>
      <Typography color="textSecondary">{new Date(offer.created_at).toLocaleString("pl-PL")}</Typography>
    </CardContent>
    <CardActions>
      <Button variant="contained" color="primary" onClick={() => handleJoinOffer(offer.id)}>Dołącz</Button>
    </CardActions>
  </Card>
);

// Już dołączone oferty
const renderJoinedOfferCard = (offer) => (
  <Card key={`joined-offer-${offer.id}`} className="offer-card" style={{ marginBottom: 12 }}>
    <CardContent>
      <Typography variant="h6">{offer.origin} → {offer.destination}</Typography>
      <Typography color="textSecondary">{new Date(offer.date).toLocaleDateString("pl-PL")}</Typography>
    </CardContent>
  </Card>
);

// --- NOWOŚĆ: Trip Card ---
const renderTripCard = (trip) => (
  <Card key={`trip-${trip.id}`} className="trip-card" style={{ marginBottom: 12 }}>
    <CardContent>
      <Typography variant="h6">{trip.origin} → {trip.destination}</Typography>
      <Typography color="textSecondary">{new Date(trip.date).toLocaleDateString("pl-PL")}</Typography>
      <Typography>Ilość osób: {trip.people}</Typography>
      <Typography>Bagaż: {trip.luggage || "-"}</Typography>
      <Typography>Zwierzęta: {trip.pets ? "Tak" : "Nie"}</Typography>
      <Typography>Cel podróży: {trip.purpose || "-"}</Typography>
      <Typography color="textSecondary">{new Date(trip.created_at).toLocaleString("pl-PL")}</Typography>
    </CardContent>
   
      <CardActions>
  <Button variant="contained" color="primary" onClick={() => handleJoinTrip(trip.id)}>Dołącz</Button>
</CardActions>

  </Card>
);

  return (
    <div className="search-results">
      {loading && <p>Ładowanie danych...</p>}
      {!loading && message && <p>{message}</p>}

      {/* Wyniki wyszukiwania */}
      {tripParams?.type === "join" && filteredOffers.length > 0 && (
        <>
          <h3>Oferty kierowców (mogą Cię zabrać)</h3>
          {filteredOffers.map(renderOfferCard)}
        </>
      )}

      {/* Alternatywy */}
      {tripParams?.type === "join" && filteredAlternativeOffers.length > 0 && (
        <>
          <h3>Podobne oferty kierowców w pobliżu</h3>
          {filteredAlternativeOffers.map(renderOfferCard)}
        </>
      )}

      {/* Już dołączone – bez przycisku */}
      {tripParams?.type === "join" && joinedOffers.length > 0 && (
        <>
          <h3>Oto szczegóły dołączonej oferty</h3>
          {joinedOffers.map(renderJoinedOfferCard)}
        </>
      )}


      {/* Wyniki wyszukiwania podróży pasażerów */}
{tripParams?.type === "offer" && trips.length > 0 && (
  <>
    <h3>Podróże pasażerów (możesz dołączyć)</h3>
    {trips.map(renderTripCard)}
  </>
)}

      {/* Brak wyników */}
      {!loading &&
        filteredOffers.length === 0 &&
        filteredAlternativeOffers.length === 0 &&
        joinedOffers.length === 0 && (
          <p>Brak wyników do wyświetlenia</p>
        )}

      {tripParams && <AIHints tripParams={tripParams} />}

      <button className="back-button" onClick={() => navigate("/")}>Powrót do menu głównego</button>

      {/* MAPA TRASY */}
      {routeCoords.length > 0 && (
        <MapContainer center={routeCoords[0]} zoom={13} style={{ height: 300, marginTop: 20 }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Polyline positions={routeCoords} color="blue" />
          <Marker position={routeCoords[0]}>
            <Popup>Start: {tripParams.origin}</Popup>
          </Marker>
          <Marker position={routeCoords[routeCoords.length - 1]}>
            <Popup>Cel: {tripParams.destination}</Popup>
          </Marker>
        </MapContainer>
      )}
    </div>
  );
};

export default SearchResults;
