import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Collapse,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoIcon from "@mui/icons-material/Info";
import Chat from "./Chat.jsx";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";

const API_URL = "http://localhost:3000";

const MyTripsAndOffers = () => {
  const [trips, setTrips] = useState([]);
  const [offers, setOffers] = useState([]);
  const [joinedTrips, setJoinedTrips] = useState([]);
  const [joinedOffers, setJoinedOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openEdit, setOpenEdit] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editType, setEditType] = useState(null);

  const [expanded, setExpanded] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatType, setChatType] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [user, setUser] = useState(null);

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchData = async () => {
    setLoading(true);
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
        console.log(`[DEBUG] ${ep.url} response:`, data);
        ep.setter(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkLoginAndFetch = async () => {
      try {
        const meRes = await fetch(`${API_URL}/me`, { credentials: "include" });
        if (!meRes.ok) {
          setLoading(false);
          return;
        }

        const meData = await meRes.json();
      setUser(meData.user); 
        fetchData();
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    checkLoginAndFetch();
  }, []);

  const handleEdit = (entry, type) => {
    setEditData(entry);
    setEditType(type);
    setOpenEdit(true);
  };

  const handleDelete = async (entry, type, isJoined = false) => {
    if (!window.confirm("Czy na pewno chcesz usunąć ten wpis?")) return;

    const endpoint =
      type === "offers" && isJoined
        ? `/joined-offers/${entry.id}`
        : type === "trips" && isJoined
        ? `/joined-trips/${entry.id}`
        : `/${type}/${entry.id}`;

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error(`Nie udało się usunąć ${type}`);

      if (type === "trips") {
        isJoined
          ? setJoinedTrips(joinedTrips.filter((t) => t.id !== entry.id))
          : setTrips(trips.filter((t) => t.id !== entry.id));
      }
      if (type === "offers") {
        isJoined
          ? setJoinedOffers(joinedOffers.filter((o) => o.id !== entry.id))
          : setOffers(offers.filter((o) => o.id !== entry.id));
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_URL}/${editType}/${editData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editData),
      });
      if (!res.ok) throw new Error("Błąd przy zapisie");
      const updated = await res.json();
      if (editType === "trips")
        setTrips(trips.map((t) => (t.id === updated.id ? updated : t)));
      else setOffers(offers.map((o) => (o.id === updated.id ? updated : o)));
      setOpenEdit(false);
    } catch (err) {
      console.error(err);
      alert("Nie udało się zapisać zmian");
    }
  };

  // --- KARTY ---
  const renderTripCard = (trip) => {
  const joined = joinedTrips.find(jt => jt.id === trip.id); 
  const status = joined?.status;

  return (
    <Card key={`trip-${trip.id}`} style={{ marginBottom: 16, backgroundColor: joined ? "#f0f8ff" : "inherit" }}>
      <CardContent>
        <Typography variant="h6">{trip.origin} → {trip.destination}</Typography>
        <Typography color="textSecondary">{new Date(trip.date).toLocaleDateString("pl-PL")}</Typography>
        {status && <Typography color="primary">Status: {status}</Typography>}
        <Collapse in={expanded[trip.id]}>
          <Typography>Liczba osób: {trip.people}</Typography>
          <Typography>Cel: {trip.purpose}</Typography>
          <Typography>Bagaż: {trip.luggage}</Typography>
          <Typography>Podróż ze zwierzęciem: {trip.pets ? "Tak" : "Nie"}</Typography>
        </Collapse>
      </CardContent>
      <CardActions>
        <IconButton onClick={() => toggleExpand(trip.id)}>
          <InfoIcon color={expanded[trip.id] ? "primary" : "inherit"} />
        </IconButton>

        {/* Przycisk czatu zawsze */}
       <IconButton
  onClick={() => { setChatType("trip"); setChatId(trip.id); setChatOpen(true); }}
  color="primary"
>
  <ChatBubbleOutlineIcon />
</IconButton>

        {/* Przyciski edycji i usuwania tylko jeśli nie dołączył */}
        {!joined && (
          <>
            <IconButton onClick={() => handleEdit(trip, "trips")} color="primary">
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => handleDelete(trip, "trips")} color="error">
              <DeleteIcon />
            </IconButton>
          </>
        )}

        {/* Przyciski usuwania dla dołączonych */}
        {joined && (
          <IconButton onClick={() => handleDelete(trip, "trips", true)} color="error">
            <DeleteIcon />
          </IconButton>
        )}
      </CardActions>
    </Card>
  );
};

const renderOfferCard = (offer) => {
  const joined = joinedOffers.find(jo => jo.id === offer.id); 
  const status = joined?.status;

  return (
    <Card key={`offer-${offer.id}`} style={{ marginBottom: 16, backgroundColor: joined ? "#f0f8ff" : "inherit" }}>
      <CardContent>
        <Typography variant="h6">{offer.origin} → {offer.destination}</Typography>
        <Typography color="textSecondary">{new Date(offer.date).toLocaleDateString("pl-PL")}</Typography>
        {status && <Typography color="primary">Status: {status}</Typography>}
        <Collapse in={expanded[offer.id]}>
          <Typography>Liczba wolnych miejsc: {offer.seats_available}</Typography>
          <Typography>Cel: {offer.notes}</Typography>
          <Typography>Bagaż: {offer.luggage}</Typography>
          <Typography>Mogę zabrać zwierzę: {offer.pets ? "Tak" : "Nie"}</Typography>
          <Typography>Typ pojazdu: {offer.vehicle_type}</Typography>
          <Typography>Cena: {offer.price} zł</Typography>
          <Typography>Dołączyło osób: {offer.passengers_count}</Typography>
        </Collapse>
      </CardContent>
      <CardActions>
        <IconButton onClick={() => toggleExpand(offer.id)}>
          <InfoIcon color={expanded[offer.id] ? "primary" : "inherit"} />
        </IconButton>

        {/* Przycisk czatu zawsze */}
<IconButton
  onClick={() => { setChatType("offer"); setChatId(offer.id); setChatOpen(true); }}
  color="primary"
>
  <ChatBubbleOutlineIcon />
</IconButton>
        {/* Przyciski edycji i usuwania tylko jeśli nie dołączył */}
        {!joined && (
          <>
            <IconButton onClick={() => handleEdit(offer, "offers")} color="primary">
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => handleDelete(offer, "offers")} color="error">
              <DeleteIcon />
            </IconButton>
          </>
        )}

        {/* Przyciski usuwania dla dołączonych */}
        {joined && (
          <IconButton onClick={() => handleDelete(offer, "offers", true)} color="error">
            <DeleteIcon />
          </IconButton>
        )}
      </CardActions>
    </Card>
  );
};

console.log("[DEBUG Chat Modal]", { chatType, chatId, user });
  return (
    <div className="my-trips-offers">
      {loading && <p>Ładowanie danych...</p>}
      {!loading &&
        trips.length + offers.length === 0 && (
          <p>Brak wpisów.</p>
        )}

      {/* Sekcja Pasażer */}
      {trips.length > 0 && (
        <>
          <h3>Jadę jako pasażer</h3>
          {trips.map(renderTripCard)}
        </>
      )}

      {/* Sekcja Kierowca */}
      {offers.length > 0 && (
        <>
          <h3>Jadę jako kierowca</h3>
          {offers.map(renderOfferCard)}
        </>
      )}

      {/* Modal edycji */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth>
        <DialogTitle>Edytuj {editType === "trips" ? "podróż" : "ofertę"}</DialogTitle>
        <DialogContent>
          {editData && (
            <>
              <TextField
                label="Miejsce wyjazdu"
                value={editData.origin || ""}
                onChange={(e) => setEditData({ ...editData, origin: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Miejsce docelowe"
                value={editData.destination || ""}
                onChange={(e) => setEditData({ ...editData, destination: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Data"
                type="date"
                value={editData.date?.slice(0, 10) || ""}
                onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEdit(false)}>Anuluj</Button>
          <Button variant="contained" onClick={handleSave}>Zapisz</Button>
        </DialogActions>
      </Dialog>
      
      {/* Modal czatu */}
<Dialog open={chatOpen} onClose={() => setChatOpen(false)} fullWidth>
  <DialogTitle>Czat</DialogTitle>
  <DialogContent>
    {chatId && user && (
      <Chat type={chatType} id={chatId} user={user} />
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setChatOpen(false)}>Zamknij</Button>
  </DialogActions>
</Dialog>

      
          </div>
  );
};

export default MyTripsAndOffers;
