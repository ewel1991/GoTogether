import React, { useEffect, useState } from "react";
import EmojiTransportationIcon from '@mui/icons-material/EmojiTransportation';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Header({ onLogout }) {
  const [notifications, setNotifications] = useState([]);
  const [userEmail, setUserEmail] = useState(""); // nowy stan dla emaila
  const navigate = useNavigate();

  // Pobranie powiadomień
  const fetchNotifications = async () => {
    try {
      const res = await axios.get("http://localhost:3000/notifications", { withCredentials: true });
      setNotifications(res.data);
    } catch (err) {
      console.error("Błąd pobierania powiadomień:", err);
    }
  };

  // Pobranie zalogowanego użytkownika
  const fetchUser = async () => {
    try {
      const res = await axios.get("http://localhost:3000/me", { withCredentials: true });
      if (res.data?.user?.email) setUserEmail(res.data.user.email);
    } catch (err) {
      console.error("Błąd pobierania użytkownika:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUser();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Funkcja po kliknięciu w dzwoneczek
  const handleNotificationsClick = async () => {
    navigate("/notifications");

    // Oznacz wszystkie nieprzeczytane jako przeczytane
    try {
      await Promise.all(
        notifications
          .filter(n => !n.read)
          .map(n =>
            axios.put(`http://localhost:3000/notifications/${n.id}/read`, {}, { withCredentials: true })
          )
      );
      // Odśwież stan powiadomień, żeby licznik zniknął
      fetchNotifications();
    } catch (err) {
      console.error("Błąd oznaczania powiadomień jako przeczytane:", err);
    }
  };

  return (
    <header className="header">
      <h1 className="header-title">
        <EmojiTransportationIcon />
        Go Together
      </h1>
      <div className="header-buttons">
        {userEmail && <span style={{ color: "white", marginRight: "12px" }}>{userEmail}</span>}
        <button className="notifications-button" onClick={handleNotificationsClick}>
          <NotificationsIcon />
          {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
        </button>
        <button className="logout-button" onClick={onLogout}>
          <ExitToAppIcon className="logout-icon" />
        </button>
      </div>
    </header>
  );
}

export default Header;
