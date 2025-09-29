import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Header from "./partials/Header";
import Footer from "./partials/Footer";
import Auth from "./auth/Auth";
import MenuButtons from "./buttons/MenuButtons";
import SearchResults from "./buttons/SearchResults";
import Notifications from "./buttons/Notifications";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const checkLogin = async () => {
    try {
      const res = await fetch("http://localhost:3000/me", { 
        credentials: "include",
        signal: AbortController ? new AbortController().signal : undefined // Dodanie abort controller
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      setIsLoggedIn(true);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      console.error('Login check failed:', error);
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };
  
  checkLogin();
}, []);

  const handleLogin = async () => setIsLoggedIn(true);

  const handleLogout = async () => {
    try {
      const res = await fetch("http://localhost:3000/logout", { method: "POST", credentials: "include" });
      if (res.ok) setIsLoggedIn(false);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <Router>
      <div className="app-container">
        {isLoggedIn && <Header onLogout={handleLogout} />}
        <main className="menu">
          <Routes>
            {!isLoggedIn && <Route path="*" element={<Auth onLogin={handleLogin} />} />}
            {isLoggedIn && (
              <>
                <Route path="/" element={<MenuButtons />} />
                <Route path="/results" element={<SearchResults />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </main>
        {isLoggedIn && <Footer />}
      </div>
    </Router>
  );
}

export default App;
