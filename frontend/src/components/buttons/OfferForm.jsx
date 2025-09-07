//OfferForm.jsx
import React from "react";
import {
  TextField,
  InputAdornment,
  Button,
  FormControlLabel,
  Checkbox,
  MenuItem,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import EventIcon from "@mui/icons-material/Event";
import PeopleIcon from "@mui/icons-material/People";
import WorkIcon from "@mui/icons-material/Work";
import PetsIcon from "@mui/icons-material/Pets";
import LuggageIcon from "@mui/icons-material/Luggage";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import LocalTaxiIcon from "@mui/icons-material/LocalTaxi";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import axios from "axios";

function OfferForm() {
  const navigate = useNavigate();
  const isMounted = React.useRef(true);

  React.useEffect(() => () => { isMounted.current = false; }, []);

  const [formData, setFormData] = React.useState({
    origin: "",
    destination: "",
    date: "",
    seats_available: 1,
    purpose: "",
    luggage: "",
    pets: false,
    vehicle_type: "car",
    price: "",
    valid_until: "",
    notes: "",
    type: "offer",
  });

  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isMounted.current) return;

    setLoading(true);
    setMessage("");

    try {
      const payload = {
        ...formData,
        seatsAvailable: Number(formData.seats_available),
        vehicleType: formData.vehicle_type,
        price: formData.price ? Number(formData.price) : null,
        date: formData.date,                  // wysyłamy dokładnie YYYY-MM-DD
        valid_until: formData.valid_until || null,
      };

      await axios.post("http://localhost:3000/offers", payload, { withCredentials: true });

      if (!isMounted.current) return;
      setMessage("Oferta została dodana!");

      navigate("/results", {
        state: {
          tripParams: {
            origin: formData.origin,
            destination: formData.destination,
            date: formData.date, 
            type: "offer",
            pets: formData.pets,            
            seatsAvailable: formData.seats_available
          }
        }
      });

      if (!isMounted.current) return;
      setFormData({
        origin: "",
        destination: "",
        date: "",
        seats_available: 1,
        purpose: "",
        luggage: "",
        pets: false,
        vehicle_type: "car",
        price: "",
        valid_until: "",
        notes: "",
        type: "offer",
      });
    } catch (err) {
      console.error(err);
      if (isMounted.current) {
        setMessage(err.response?.data?.message || "Wystąpił błąd podczas dodawania oferty");
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <TextField
        label="Miejsce wyjazdu"
        name="origin"
        value={formData.origin}
        onChange={handleChange}
        size="small"
        InputProps={{ startAdornment: (<InputAdornment position="start"><FlightTakeoffIcon /></InputAdornment>) }}
      />

      <TextField
        label="Miejsce docelowe"
        name="destination"
        value={formData.destination}
        onChange={handleChange}
        size="small"
        InputProps={{ startAdornment: (<InputAdornment position="start"><LocationOnIcon /></InputAdornment>) }}
      />

      <TextField
        label="Data wyjazdu"
        name="date"
        type="date"
        value={formData.date}
        onChange={handleChange}
        InputLabelProps={{ shrink: true }}
        size="small"
        InputProps={{ startAdornment: (<InputAdornment position="start"><EventIcon /></InputAdornment>) }}
      />

      <TextField
        label="Ilość dostępnych miejsc"
        name="seats_available"
        type="number"
        value={formData.seats_available}
        onChange={handleChange}
        size="small"
        InputProps={{ startAdornment: (<InputAdornment position="start"><PeopleIcon /></InputAdornment>) }}
      />

      <TextField
        select
        label="Typ pojazdu"
        name="vehicle_type"
        value={formData.vehicle_type}
        onChange={handleChange}
        size="small"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {formData.vehicle_type === "car" ? <DirectionsCarIcon /> : <LocalTaxiIcon />}
            </InputAdornment>
          ),
        }}
      >
        <MenuItem value="car">Własne auto</MenuItem>
        <MenuItem value="taxi">Taxi</MenuItem>
      </TextField>

      <TextField
        label="Cena (PLN)"
        name="price"
        type="number"
        value={formData.price}
        onChange={handleChange}
        size="small"
        InputProps={{ startAdornment: (<InputAdornment position="start"><MonetizationOnIcon /></InputAdornment>) }}
      />

      <TextField
        label="Data ważności oferty"
        name="valid_until"
        type="date"
        value={formData.valid_until}
        onChange={handleChange}
        InputLabelProps={{ shrink: true }}
        size="small"
        InputProps={{ startAdornment: (<InputAdornment position="start"><AccessTimeIcon /></InputAdornment>) }}
      />

      <TextField
        label="Cel podróży"
        name="purpose"
        value={formData.purpose}
        onChange={handleChange}
        size="small"
        InputProps={{ startAdornment: (<InputAdornment position="start"><WorkIcon /></InputAdornment>) }}
      />

      <TextField
        label="Bagaż"
        name="luggage"
        value={formData.luggage}
        onChange={handleChange}
        size="small"
        InputProps={{ startAdornment: (<InputAdornment position="start"><LuggageIcon /></InputAdornment>) }}
      />

      <FormControlLabel
        control={<Checkbox name="pets" checked={formData.pets} onChange={handleChange} icon={<PetsIcon />} checkedIcon={<PetsIcon />} />}
        label="Zwierzęta dozwolone"
      />

      <TextField
        label="Dodatkowe informacje"
        name="notes"
        value={formData.notes}
        onChange={handleChange}
        size="small"
        multiline
        rows={2}
      />

      <Button type="submit" variant="contained" color="success" disabled={loading}>
        {loading ? "Dodawanie..." : "Dodaj ofertę"}
      </Button>

      {message && <p>{message}</p>}
    </form>
  );
}

export default OfferForm;
