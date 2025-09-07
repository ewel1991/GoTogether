import React, { useState, useEffect } from "react";
import { Card, CardContent, Typography, CircularProgress } from "@mui/material";
import axios from "axios";

const API_URL = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:3000";
const RETRY_DELAY_MS = 5000; // 5 sekund przed ponowną próbą
const MAX_RETRIES = 3;

export default function AIHints({ tripParams }) {
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const getInfo = async (retryCount = 0) => {
      if (!tripParams) return;
      setLoading(true);
      setError("");

      try {
        const res = await axios.post(
          `${API_URL}/api/generateAdvice`,
          { tripParams },
          { withCredentials: true }
        );

        console.log("Weather info response:", res.data);
        setInfo(res.data.info); // pobieramy prognozę pogody
      } catch (err) {
        console.error("Błąd pobierania prognozy:", err);

        if (err.response && (err.response.status === 429 || err.response.status === 503)) {
          if (retryCount < MAX_RETRIES) {
            setTimeout(() => {
              getInfo(retryCount + 1);
            }, RETRY_DELAY_MS);
          } else {
            setError("Serwis pogodowy jest przeciążony. Spróbuj ponownie za kilka sekund.");
          }
        } else {
          setError("Nie udało się pobrać prognozy pogody.");
        }
      } finally {
        setLoading(false);
      }
    };

    getInfo();
  }, [tripParams]);

  if (!tripParams) return null;

  return (
    <Card sx={{ marginBottom: 2, backgroundColor: "#f5f5f5" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🌤️ Prognoza pogody w miejscu docelowym
        </Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : error ? (
          <Typography variant="body1" color="error">
            {error}
          </Typography>
        ) : (
          <Typography variant="body1">{info}</Typography>
        )}
      </CardContent>
    </Card>
  );
}
