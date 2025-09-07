import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardContent, Typography, Chip } from "@mui/material";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const API_URL = "http://localhost:3000";

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await axios.get(`${API_URL}/notifications`, { withCredentials: true });

        const notificationsWithStatus = res.data.map(n => ({
          ...n,
          showButtons: n.join_id && n.status === "pending"
        }));

        setNotifications(notificationsWithStatus);

        // Oznacz wszystkie jako przeczytane
        await Promise.all(
          res.data
            .filter(n => !n.read)
            .map(n =>
              axios.put(`${API_URL}/notifications/${n.id}/read`, {}, { withCredentials: true })
            )
        );
      } catch (err) {
        console.error("Błąd pobierania powiadomień:", err);
      }
    }

    fetchNotifications();
  }, []);

  const handleAcceptJoin = async (join) => {
    if (!join || !join.join_id) return;
    try {
      if (join.offer_id) {
        await axios.post(`${API_URL}/join-offer/${join.join_id}/accept`, {}, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/join-trip/${join.join_id}/accept`, {}, { withCredentials: true });
      }
      alert("Zgłoszenie zaakceptowane!");
      setNotifications(prev => prev.filter(n => n.join_id !== join.join_id));
    } catch (err) {
      console.error("Błąd akceptacji zgłoszenia:", err);
      alert("Nie udało się zaakceptować zgłoszenia");
    }
  };

  const handleRejectJoin = async (join) => {
    if (!join || !join.join_id) return;
    try {
      if (join.offer_id) {
        await axios.post(`${API_URL}/join-offer/${join.join_id}/reject`, {}, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/join-trip/${join.join_id}/reject`, {}, { withCredentials: true });
      }
      alert("Zgłoszenie odrzucone.");
      setNotifications(prev => prev.filter(n => n.join_id !== join.join_id));
    } catch (err) {
      console.error("Błąd odrzucenia zgłoszenia:", err);
      alert("Nie udało się odrzucić zgłoszenia");
    }
  };

  // Funkcja zwracająca kolor Chipa w zależności od statusu
  const getStatusColor = (status) => {
    switch (status) {
      case "accepted":
        return "success";
      case "rejected":
        return "error";
      case "pending":
        return "info";
      default:
        return "default";
    }
  };

  return (
    <div className="notifications-container">
  <Typography variant="h5" gutterBottom className="notifications-title">
    Powiadomienia
  </Typography>

  {notifications.length === 0 && (
    <div className="notifications-empty">
      Brak powiadomień
    </div>
  )}

  {notifications.map(n => (
    <Card key={n.id} className="notification-card">
      <CardContent>
        <Typography>{n.message}</Typography>
        <Typography variant="caption" color="textSecondary">
          {new Date(n.created_at).toLocaleString()}
        </Typography>

        {n.join_id && n.status && (
          <Chip
            label={`Status: ${n.status}`}
            color={getStatusColor(n.status)}
            size="small"
            className="notification-chip"
          />
        )}

        {n.showButtons && (
          <div className="notification-buttons">
            <Button
              variant="contained"
              color="success"
              onClick={() => handleAcceptJoin(n)}
            >
              Akceptuj
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => handleRejectJoin(n)}
            >
              Odrzuć
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  ))}

  <Button
    variant="outlined"
    onClick={() => navigate("/")}
    className="back-button"
  >
    Powrót do strony głównej
  </Button>
</div>
  );
}

export default Notifications;
