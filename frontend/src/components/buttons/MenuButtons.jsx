import React from "react";
import { useNavigate } from "react-router-dom"; 
import TripForm from "./TripForm";
import OfferForm from "./OfferForm";
import MyTripsAndOffers from "./MyTripsAndOffers";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import ListAltIcon from "@mui/icons-material/ListAlt";

function MenuButtons() {
  const [showJoinForm, setShowJoinForm] = React.useState(false);
  const [showOfferForm, setShowOfferForm] = React.useState(false);
  const [showMyTrips, setShowMyTrips] = React.useState(false);
  const navigate = useNavigate(); 

  // --- obsługa formularza podróży ---
  async function submitTripForm(data) {
    try {
      const res = await fetch("http://localhost:3000/search-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Błąd przy wyszukiwaniu ofert");
      const result = await res.json();

      navigate("/results", { state: { offers: result } });
      setShowJoinForm(false); 
    } catch (err) {
      console.error(err);
      alert("Nie udało się pobrać ofert");
    }
  }

  // --- obsługa formularza oferty ---
  async function submitOfferForm(data) {
    try {
      const res = await fetch("http://localhost:3000/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Błąd przy wysyłaniu oferty");
      const result = await res.json();
      alert("Oferta dodana: " + JSON.stringify(result));
    } catch (err) {
      console.error(err);
      alert("Nie udało się dodać oferty");
    }
  }

  return (
    <div className="menu-buttons">
      {/* TripForm */}
      <div className="menu-item">
        <button onClick={() => setShowJoinForm(!showJoinForm)}>
          <FlightTakeoffIcon style={{ marginRight: 8 }} />
          Planuję podróż (chcę się przyłączyć)
        </button>
        {showJoinForm && (
          <div className="form-container open">
            <TripForm onSubmit={submitTripForm} />
          </div>
        )}
      </div>

      {/* OfferForm */}
      <div className="menu-item">
        <button onClick={() => setShowOfferForm(!showOfferForm)}>
          <DirectionsCarIcon style={{ marginRight: 8 }} />
          Planuję podróż (mogę kogoś zabrać)
        </button>
        {showOfferForm && (
          <div className="form-container open">
            <OfferForm onSubmit={submitOfferForm} />
          </div>
        )}
      </div>

      {/* MyTripsAndOffers */}
      <div className="menu-item">
        <button onClick={() => setShowMyTrips(!showMyTrips)}>
          <ListAltIcon style={{ marginRight: 8 }} />
          Moje podróże
        </button>
        {showMyTrips && (
          <div className="form-container open">
            <MyTripsAndOffers />
          </div>
        )}
      </div>
    </div>
  );
}

export default MenuButtons;
