// TripForm.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  InputAdornment,
  Button,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import EventIcon from "@mui/icons-material/Event";
import PeopleIcon from "@mui/icons-material/People";
import WorkIcon from "@mui/icons-material/Work";
import PetsIcon from "@mui/icons-material/Pets";
import LuggageIcon from "@mui/icons-material/Luggage";
import axios from "axios";

function TripForm() {
  const navigate = useNavigate();
  const isMounted = React.useRef(true);

  React.useEffect(() => () => { isMounted.current = false; }, []);

  const [formData, setFormData] = React.useState({
    origin: "",
    destination: "",
    date: "",           
    people: 1,
    purpose: "",
    luggage: "",
    pets: false,
    type: "join",
  });
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
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
      const dateOnly = formData.date; // już YYYY-MM-DD, bez żadnego new Date()

      console.log("Wysyłam datę (bez godziny):", dateOnly);

     const res = await axios.post(
  "http://localhost:3000/trips",
  { ...formData, date: dateOnly },
  { withCredentials: true }
);
      if (!isMounted.current) return;

       const createdTrip = res.data;      
    const tripId = createdTrip.id;     

      setMessage("Podróż została dodana!");

    
      navigate("/results", {
        state: {
          tripParams: {
            origin: formData.origin,
            destination: formData.destination,
            date: dateOnly,
            type: "join",
            tripId, 
            people: formData.people,
            seats_available: formData.people,
            pets: formData.pets,
            luggage: formData.luggage,
          },
        },
      });

      if (!isMounted.current) return;
      setFormData({
        origin: "",
        destination: "",
        date: "",
        people: 1,
        purpose: "",
        luggage: "",
        pets: false,
        type: "join",
      });
    } catch (err) {
      console.error(err);
      if (isMounted.current) {
        setMessage(err.response?.data?.message || "Wystąpił błąd podczas dodawania podróży");
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
        label="Data"
        name="date"
        type="date"
        value={formData.date}
        onChange={handleChange}
        InputLabelProps={{ shrink: true }}
        size="small"
        InputProps={{ startAdornment: (<InputAdornment position="start"><EventIcon /></InputAdornment>) }}
      />
      <TextField
        label="Ilość osób"
        name="people"
        type="number"
        value={formData.people}
        onChange={handleChange}
        size="small"
        InputProps={{ startAdornment: (<InputAdornment position="start"><PeopleIcon /></InputAdornment>) }}
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
        label="Podróżuję ze zwierzęciem"
      />
      <Button type="submit" variant="contained" color="warning" disabled={loading}>
        {loading ? "Wysyłanie..." : "Wyślij"}
      </Button>
      {message && <p>{message}</p>}
    </form>
  );
}

export default TripForm;
