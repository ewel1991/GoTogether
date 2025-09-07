//index.js

// --- Importy ---
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth2";
import env from "dotenv";
import validator from "validator";
import cron from "node-cron";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dayjs from "dayjs";
import http from "http";
import { Server as SocketIO } from "socket.io";

env.config();

// --- Konfiguracja ---
const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Baza danych ---
const db = new pg.Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

db.query("SELECT NOW()")
  .then(() => console.log("✅ DB connected."))
  .catch((err) => console.error("❌ DB connection error:", err));

  // Funkcja do usuwania przeterminowanych ofert i przeszłych podróży
async function deleteExpiredEntries() {
  try {
    // Usuwanie przeterminowanych ofert
    const offersRes = await db.query(
      `DELETE FROM offers 
       WHERE valid_until IS NOT NULL 
         AND valid_until < CURRENT_DATE`
    );
    console.log(`✅ Usunięto ${offersRes.rowCount} przeterminowanych ofert`);

    // Usuwanie przeszłych podróży
    const tripsRes = await db.query(
      `DELETE FROM trips 
       WHERE date < CURRENT_DATE`
    );
    console.log(`✅ Usunięto ${tripsRes.rowCount} przeszłych podróży`);

  } catch (err) {
    console.error("❌ Błąd usuwania przeterminowanych wpisów:", err);
  }
}

// Wywołanie przy starcie aplikacji
deleteExpiredEntries();

// Cron do codziennego czyszczenia o północy
cron.schedule("0 0 * * *", deleteExpiredEntries);

// --- Middleware ---
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? "https://yourdomain.com"
        : "http://localhost:5173",
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// --- Passport LocalStrategy ---
passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      if (result.rows.length === 0) return done(null, false, { message: "User not found" });

      const user = result.rows[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) return done(null, false, { message: "Invalid password" });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// --- Passport GoogleStrategy ---
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [profile.email]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [profile.email, "google"]
          );
          return done(null, newUser.rows[0]);
        } else {
          return done(null, result.rows[0]);
        }
      } catch (err) {
        return done(err);
      }
    }
  )
);

// --- Serializacja użytkownika ---
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

// --- Walidacja rejestracji ---
function validateRegisterData(email, password) {
  const errors = [];
  if (!email || !validator.isEmail(email)) errors.push("Nieprawidłowy format email");
  if (!password || password.length < 8) errors.push("Hasło musi mieć minimum 8 znaków");
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
    errors.push("Hasło musi zawierać małą literę, dużą literę i cyfrę");
  return errors;
}

// --- ROUTES ---
// Rejestracja
app.post("/register", async (req, res) => {
  const { emailReg: email, passwordReg: password } = req.body;
  const errors = validateRegisterData(email, password);
  if (errors.length) return res.status(400).json({ message: "Błędy walidacji", errors });

  try {
    const existing = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length) return res.status(400).json({ message: "Email already exists." });

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await db.query("INSERT INTO users (email, password) VALUES ($1, $2)", [email, hashedPassword]);
    res.status(201).json({ message: "User registered!" });
  } catch (err) {
    console.error("❌ Błąd przy rejestracji:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Logowanie (local)
app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info.message });

    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.status(200).json({ message: "Login successful", user });
    });
  })(req, res, next);
});

// Logowanie Google
app.get("/auth/google", passport.authenticate("google", { scope: ["email", "profile"] }));
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "http://localhost:5173/login",
    successRedirect: "http://localhost:5173",
  })
);

// Sprawdzenie czy użytkownik zalogowany
app.get("/me", (req, res) => {
  if (req.isAuthenticated()) res.json({ user: req.user });
  else res.status(401).json({ message: "Not authenticated" });
});

// Funkcja naprawiająca brakujące trip_id i offer_id
async function fixJoins(joinId = null) {
  try {
    if (joinId) {
      // Naprawiamy jeden wiersz
      const res = await db.query(
        `WITH updated_trip AS (
           UPDATE joins j
           SET trip_id = t.id
           FROM trips t
           WHERE j.trip_id IS NULL
             AND j.id = $1
             AND j.user_id = t.user_id
             AND j.offer_id IS NOT NULL
           RETURNING j.id, j.trip_id
         ),
         updated_offer AS (
           UPDATE joins j
           SET offer_id = o.id
           FROM offers o
           JOIN trips t ON t.origin = o.origin AND t.destination = o.destination AND t.date = o.date
           WHERE j.offer_id IS NULL
             AND j.id = $1
             AND j.trip_id = t.id
           RETURNING j.id, j.offer_id
         )
         SELECT * FROM updated_trip
         UNION ALL
         SELECT * FROM updated_offer`,
        [joinId]
      );
      return res.rows;
    } else {
      // Naprawiamy wszystkie brakujące wpisy
      const res = await db.query(
        `WITH updated_trip AS (
           UPDATE joins j
           SET trip_id = t.id
           FROM trips t
           WHERE j.trip_id IS NULL
             AND j.user_id = t.user_id
             AND j.offer_id IS NOT NULL
           RETURNING j.id, j.trip_id
         ),
         updated_offer AS (
           UPDATE joins j
           SET offer_id = o.id
           FROM offers o
           JOIN trips t ON t.origin = o.origin AND t.destination = o.destination AND t.date = o.date
           WHERE j.offer_id IS NULL
             AND j.trip_id = t.id
           RETURNING j.id, j.offer_id
         )
         SELECT * FROM updated_trip
         UNION ALL
         SELECT * FROM updated_offer`
      );
      return res.rows;
    }
  } catch (err) {
    console.error("❌ Błąd w fixJoins:", err);
    return [];
  }
}


// Tworzenie podróży
app.post("/trips", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

  const { origin, destination, date, people, purpose, luggage, pets, type } = req.body;
  if (!origin || !destination || !date)
    return res.status(400).json({ message: "Origin, destination and date are required." });

  try {
    const result = await db.query(
      `INSERT INTO trips (user_id, origin, destination, date, people, purpose, luggage, pets, type) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $9) RETURNING *`,
      [req.user.id, origin, destination, date, people, purpose, luggage, pets, type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Pobranie własnych zgłoszeń (chcę się przyłączyć)
app.get("/trips", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  try {
    const result = await db.query(
      "SELECT * FROM trips WHERE user_id = $1 AND type='join' ORDER BY date DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Tworzenie oferty
app.post("/offers", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

  const { origin, destination, date, price, vehicleType, seatsAvailable, luggage, pets, notes, valid_until } = req.body;

  if (!origin || !destination || !date)
    return res.status(400).json({ message: "Origin, destination and date are required." });

  try {
    const result = await db.query(
  `INSERT INTO offers 
   (user_id, origin, destination, date, price, vehicle_type, seats_available, luggage, pets, notes, valid_until)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
  [req.user.id, origin, destination, date, price, vehicleType, seatsAvailable, luggage, pets, notes, valid_until || null]
);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// Pobranie ofert użytkownika + liczba pasażerów
app.get("/offers", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ message: "Not authenticated" });

  try {
    const result = await db.query(
      `SELECT o.*,
              COUNT(j.id) AS passengers_count
       FROM offers o
       LEFT JOIN joins j ON o.id = j.offer_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.date DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



// POST /join-trip/:id
app.post("/join-trip/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    console.warn("[/join-trip/:id] Brak autoryzacji");
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { id: tripId } = req.params;
  const userId = req.user.id;
  console.log("[/join-trip/:id] start", { tripId, userId });

  try {
    console.log("[/join-trip/:id] Pobieram podróż", tripId);
    const tripResult = await db.query("SELECT * FROM trips WHERE id=$1", [tripId]);
    if (!tripResult.rows.length) {
      console.warn("[/join-trip/:id] Nie znaleziono podróży", { tripId });
      return res.status(404).json({ message: "Trip not found" });
    }

    const trip = tripResult.rows[0];
    if (trip.user_id === userId) {
      console.warn("[/join-trip/:id] Próba dołączenia do własnej podróży", { userId, tripId });
      return res.status(400).json({ message: "Nie możesz dołączyć do własnej podróży" });
    }

    console.log("[/join-trip/:id] Dodaję join do bazy");
    // Dodajemy po pobraniu trip:
const offerRes = await db.query(
  `SELECT o.id 
   FROM offers o
   JOIN joins j ON o.id = j.offer_id
   WHERE j.trip_id = $1 AND j.status='accepted'
   LIMIT 1`,
  [tripId]
);
const offerId = offerRes.rows[0]?.id || null;

// Tworzymy join z offer_id, jeśli istnieje
const joinRes = await db.query(
  "INSERT INTO joins (user_id, trip_id, offer_id) VALUES ($1, $2, $3) RETURNING id",
  [userId, tripId, offerId]
);
    const joinId = joinRes.rows[0].id;
    await fixJoins(joinId);
   

    console.log("[/join-trip/:id] Tworzę powiadomienie dla właściciela podróży");
   await db.query(
  `INSERT INTO notifications (user_id, join_id, trip_id, message) 
   VALUES ($1, $2, $3, $4)`,
  [
    trip.user_id,         // właściciel podróży
    joinId,               // ID joina
    trip.id,              // ID podróży
    `Użytkownik zaproponował Ci podróż z ${trip.origin} do ${trip.destination} w dniu ${trip.date.toISOString().slice(0,10)}.`
  ]
);

    console.log("[/join-trip/:id] Zakończono sukcesem", { joinId });
    res.json({ message: "Dołączono do podróży i powiadomienie wysłane!", joinId });
  } catch (err) {
    console.error("[/join-trip/:id] Błąd serwera", err);
    res.status(500).json({ message: "Server error" });
  }
});



// Pobranie dołączonych podróży
app.get("/joined-trips", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

  try {
    const result = await db.query(
      `SELECT t.*, j.id AS join_id, j.status
       FROM trips t
       JOIN joins j ON t.id = j.trip_id
       WHERE j.user_id = $1
       ORDER BY t.date DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/joined-offers", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

  try {
    const result = await db.query(
      `SELECT o.*, j.id AS join_id, j.status
       FROM offers o
       JOIN joins j ON o.id = j.offer_id
       WHERE j.user_id = $1
       ORDER BY o.date DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// POST /join-offer/:id
app.post("/join-offer/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    console.warn("[/join-offer/:id] Brak autoryzacji");
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { id: offerId } = req.params;
  const { tripId } = req.body;
  const userId = req.user.id;
  console.log("[/join-offer/:id] start", { offerId, tripId, userId });

  try {
    console.log("[/join-offer/:id] Pobieram ofertę", offerId);
    const offerResult = await db.query("SELECT * FROM offers WHERE id=$1", [offerId]);
    if (!offerResult.rows.length) {
      console.warn("[/join-offer/:id] Nie znaleziono oferty", { offerId });
      return res.status(404).json({ message: "Offer not found" });
    }

    const offer = offerResult.rows[0];
    if (offer.user_id === userId) {
      console.warn("[/join-offer/:id] Próba dołączenia do własnej oferty", { userId, offerId });
      return res.status(400).json({ message: "Nie możesz dołączyć do własnej oferty" });
    }

    console.log("[/join-offer/:id] Dodaję join do bazy");
    const joinRes = await db.query(
      `INSERT INTO joins (user_id, trip_id, offer_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, trip_id, offer_id) DO NOTHING
       RETURNING id`,
      [userId, tripId || null, offerId]
    );

    let joinId;
    if (joinRes.rows.length > 0) {
      joinId = joinRes.rows[0].id;
      console.log("[/join-offer/:id] Utworzono nowy join", { joinId });

      // tylko gdy nowy join faktycznie powstał -> powiadomienie
      await db.query(
        `INSERT INTO notifications (user_id, join_id, offer_id, message) 
         VALUES ($1, $2, $3, $4)`,
        [
          offer.user_id,
          joinId,
          offer.id,
          `Użytkownik dołączył do Twojej oferty z ${offer.origin} do ${offer.destination} w dniu ${offer.date.toISOString().slice(0,10)}.`
        ]
      );
    } else {
      // join już istniał
      const existing = await db.query(
        "SELECT id FROM joins WHERE user_id=$1 AND trip_id=$2 AND offer_id=$3",
        [userId, tripId, offerId]
      );
      joinId = existing.rows[0].id;
      console.log("[/join-offer/:id] Join już istniał", { joinId });
    }

    res.json({ message: "Dołączono do oferty", joinId });
  } catch (err) {
    console.error("[/join-offer/:id] Błąd serwera", err);
    res.status(500).json({ message: "Server error" });
  }
});


// POST /join-offer/:id/accept

 app.post("/join-offer/:id/accept", async (req, res) => {
  if (!req.isAuthenticated()) {
    console.warn("[/join-offer/:id/accept] Brak autoryzacji");
    return res.status(401).json({ message: "Not authenticated" });
  }

  const joinId = req.params.id;
  const userId = req.user.id;
  console.log("[/join-offer/:id/accept] start", { joinId, userId });

  try {
    // Pobranie zgłoszenia wraz z właścicielem oferty i liczbą miejsc
    const joinRes = await db.query(
      `SELECT jo.id, jo.user_id AS joiner_id, jo.trip_id, o.id AS offer_id, o.user_id AS owner_id, o.seats_available
       FROM joins jo
       JOIN offers o ON jo.offer_id = o.id
       WHERE jo.id = $1`,
      [joinId]
    );

    if (joinRes.rows.length === 0) {
      console.warn("[/join-offer/:id/accept] Nie znaleziono zgłoszenia", { joinId });
      return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
    }

    const { joiner_id, trip_id, offer_id, owner_id, seats_available } = joinRes.rows[0];

    if (owner_id !== userId) {
      console.warn("[/join-offer/:id/accept] Brak uprawnień", { owner_id, userId });
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    // Sprawdzenie liczby miejsc (jeśli jest przypisana podróż)
    let people = 1;
    if (trip_id) {
      const tripRes = await db.query("SELECT people FROM trips WHERE id=$1", [trip_id]);
      people = tripRes.rows.length ? tripRes.rows[0].people : 1;
    }

    if (seats_available < people) {
      console.warn("[/join-offer/:id/accept] Brak miejsc", { seats_available, people });
      return res.status(400).json({ message: "Brak wystarczającej liczby miejsc" });
    }

    // Aktualizacja statusu zgłoszenia i liczby miejsc w ofercie
    await db.query("UPDATE joins SET status='accepted' WHERE id=$1", [joinId]);
    await db.query(
      "UPDATE offers SET seats_available = seats_available - $1 WHERE id=$2",
      [people, offer_id]
    );

    // Powiadomienie dla użytkownika, który zgłosił się do oferty
    await db.query(
      `INSERT INTO notifications (user_id, join_id, offer_id, trip_id, message, read)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [
        joiner_id,
        joinId,
        offer_id,
        trip_id,
        "✅ Twoje zgłoszenie do oferty zostało zaakceptowane!"
      ]
    );

    console.log("[/join-offer/:id/accept] Zgłoszenie zaakceptowane", { joinId });
    res.json({ message: "Zaakceptowano zgłoszenie i zaktualizowano liczbę miejsc" });

  } catch (err) {
    console.error("[/join-offer/:id/accept] Błąd serwera", err);
    res.status(500).json({ message: "Błąd serwera" });
  }
});


// POST /join-trip/:id/accept
app.post("/join-trip/:id/accept", async (req, res) => {
  if (!req.isAuthenticated()) {
    console.warn("[/join-trip/:id/accept] Brak autoryzacji");
    return res.status(401).json({ message: "Not authenticated" });
  }

  const joinId = req.params.id;
  const userId = req.user.id;
  console.log("[/join-trip/:id/accept] start", { joinId, userId });

  try {
    // Pobranie zgłoszenia wraz z właścicielem i ID podróży
    const joinRes = await db.query(
      `SELECT jt.id, jt.user_id AS joiner_id, t.user_id AS owner_id, t.id AS trip_id
       FROM joins jt
       JOIN trips t ON jt.trip_id = t.id
       WHERE jt.id = $1`,
      [joinId]
    );

    if (joinRes.rows.length === 0) {
      console.warn("[/join-trip/:id/accept] Nie znaleziono zgłoszenia", { joinId });
      return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
    }

    const { joiner_id, owner_id, trip_id } = joinRes.rows[0];

    if (owner_id !== userId) {
      console.warn("[/join-trip/:id/accept] Brak uprawnień", { owner_id, userId });
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    // Zaktualizowanie statusu zgłoszenia
    await db.query("UPDATE joins SET status = 'accepted' WHERE id = $1", [joinId]);

    // Powiadomienie dla użytkownika, który zgłosił się do podróży
    await db.query(
      `INSERT INTO notifications (user_id, join_id, trip_id, message, read)
       VALUES ($1, $2, $3, $4, false)`,
      [
        joiner_id,
        joinId,
        trip_id,
        "✅ Twoje zgłoszenie do podróży zostało zaakceptowane!"
      ]
    );

    console.log("[/join-trip/:id/accept] Zgłoszenie zaakceptowane", { joinId });
    res.json({ message: "Zaakceptowano zgłoszenie" });

  } catch (err) {
    console.error("[/join-trip/:id/accept] Błąd serwera", err);
    res.status(500).json({ message: "Błąd serwera" });
  }
});


// POST /join-offer/:id/reject

app.post("/join-offer/:id/reject", async (req, res) => {
  if (!req.isAuthenticated()) {
    console.warn("[/join-offer/:id/reject] Brak autoryzacji");
    return res.status(401).json({ message: "Not authenticated" });
  }

  const joinId = req.params.id;
  const userId = req.user.id;
  console.log("[/join-offer/:id/reject] start", { joinId, userId });

  try {
    // Pobieramy zgłoszenie razem z ID oferty i ID użytkownika właściciela oferty
    const joinRes = await db.query(
      `SELECT jo.id AS join_id, jo.user_id AS joiner_id, o.id AS offer_id, o.user_id AS owner_id
       FROM joins jo
       JOIN offers o ON jo.offer_id = o.id
       WHERE jo.id = $1`,
      [joinId]
    );

    if (joinRes.rows.length === 0) {
      console.warn("[/join-offer/:id/reject] Nie znaleziono zgłoszenia", { joinId });
      return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
    }

    const { joiner_id, owner_id, offer_id } = joinRes.rows[0];

    if (owner_id !== userId) {
      console.warn("[/join-offer/:id/reject] Brak uprawnień", { owner_id, userId });
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    // Odrzucamy zgłoszenie
    await db.query("UPDATE joins SET status='rejected' WHERE id=$1", [joinId]);

    // Tworzymy powiadomienie dla użytkownika, który wysłał zgłoszenie
    await db.query(
      `INSERT INTO notifications (user_id, join_id, offer_id, message, read)
       VALUES ($1, $2, $3, $4, false)`,
      [
        joiner_id, 
        joinId, 
        offer_id, 
        "❌ Twoje zgłoszenie do oferty zostało odrzucone."
      ]
    );

    console.log("[/join-offer/:id/reject] Zgłoszenie odrzucone", { joinId });
    res.json({ message: "Odrzucono zgłoszenie" });

  } catch (err) {
    console.error("[/join-offer/:id/reject] Błąd serwera", err);
    res.status(500).json({ message: "Błąd serwera" });
  }
});


app.post("/join-trip/:id/reject", async (req, res) => {
  if (!req.isAuthenticated()) {
    console.warn("[/join-trip/:id/reject] Brak autoryzacji");
    return res.status(401).json({ message: "Not authenticated" });
  }

  const joinId = req.params.id;
  const userId = req.user.id;
  console.log("[/join-trip/:id/reject] start", { joinId, userId });

  try {
    // Pobieramy zgłoszenie wraz z właścicielem i ID podróży
    const joinRes = await db.query(
      `SELECT jo.id, jo.user_id AS joiner_id, t.user_id AS owner_id, t.id AS trip_id
       FROM joins jo
       JOIN trips t ON jo.trip_id = t.id
       WHERE jo.id = $1`,
      [joinId]
    );

    if (joinRes.rows.length === 0) {
      console.warn("[/join-trip/:id/reject] Nie znaleziono zgłoszenia", { joinId });
      return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
    }

    const { joiner_id, owner_id, trip_id } = joinRes.rows[0];

    // Sprawdzenie uprawnień
    if (owner_id !== userId) {
      console.warn("[/join-trip/:id/reject] Brak uprawnień", { owner_id, userId });
      return res.status(403).json({ message: "Brak uprawnień" });
    }

    // Odrzucenie zgłoszenia
    await db.query("UPDATE joins SET status='rejected' WHERE id=$1", [joinId]);

    // Dodanie powiadomienia
    await db.query(
      `INSERT INTO notifications (user_id, join_id, trip_id, message, read)
       VALUES ($1, $2, $3, $4, false)`,
      [joiner_id, joinId, trip_id, "❌ Twoje zgłoszenie do podróży zostało odrzucone."]
    );

    console.log("[/join-trip/:id/reject] Zgłoszenie odrzucone", { joinId });
    res.json({ message: "Odrzucono zgłoszenie" });
  } catch (err) {
    console.error("[/join-trip/:id/reject] Błąd serwera", err);
    res.status(500).json({ message: "Błąd serwera" });
  }
});


// Edycja podróży
app.put("/trips/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

  const { id } = req.params;
  const { origin, destination, date, people, purpose, luggage, pets, type } = req.body;

  try {
    // Sprawdzenie, czy podróż należy do użytkownika
    const tripCheck = await db.query("SELECT * FROM trips WHERE id = $1 AND user_id = $2", [
      id,
      req.user.id,
    ]);
    if (!tripCheck.rows.length) return res.status(404).json({ message: "Trip not found" });

    const result = await db.query(
      `UPDATE trips
       SET origin=$1, destination=$2, date=$3, people=$4, purpose=$5, luggage=$6, pets=$7, type=$8
       WHERE id=$9 RETURNING *`,
      [origin, destination, date, people, purpose, luggage, pets, type, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Usuwanie podróży
app.delete("/trips/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

  const { id } = req.params;

  try {
    const tripCheck = await db.query("SELECT * FROM trips WHERE id = $1 AND user_id = $2", [
      id,
      req.user.id,
    ]);
    if (!tripCheck.rows.length) return res.status(404).json({ message: "Trip not found" });

    await db.query("DELETE FROM trips WHERE id = $1", [id]);
    res.json({ message: "Trip deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Edycja oferty
app.put("/offers/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

  const { id } = req.params;
  const { origin, destination, date, price, vehicleType, seatsAvailable, luggage, pets, notes } =
    req.body;

  try {
    const offerCheck = await db.query("SELECT * FROM offers WHERE id=$1 AND user_id=$2", [
      id,
      req.user.id,
    ]);
    if (!offerCheck.rows.length) return res.status(404).json({ message: "Offer not found" });

    const result = await db.query(
      `UPDATE offers
       SET origin=$1, destination=$2, date=$3, price=$4, vehicle_type=$5, seats_available=$6, luggage=$7, pets=$8, notes=$9
       WHERE id=$10 RETURNING *`,
      [origin, destination, date, price, vehicleType, seatsAvailable, luggage, pets, notes, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Usuwanie oferty
app.delete("/offers/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

  const { id } = req.params;

  try {
    const offerCheck = await db.query("SELECT * FROM offers WHERE id=$1 AND user_id=$2", [
      id,
      req.user.id,
    ]);
    if (!offerCheck.rows.length) return res.status(404).json({ message: "Offer not found" });

    await db.query("DELETE FROM offers WHERE id=$1", [id]);
    res.json({ message: "Offer deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Rezygnacja z dołączonej oferty
app.delete("/joined-offers/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  const { id } = req.params;

  try {
    // Usuń powiadomienia powiązane z tym joinem
    await db.query(
      "DELETE FROM notifications WHERE join_id IN (SELECT id FROM joins WHERE user_id=$1 AND offer_id=$2)",
      [req.user.id, id]
    );

    // Usuń join
    const result = await db.query(
      "DELETE FROM joins WHERE user_id=$1 AND offer_id=$2 RETURNING *",
      [req.user.id, id]
    );

    if (!result.rows.length) return res.status(404).json({ message: "Not joined or not found" });

    res.json({ message: "Opuściłeś ofertę!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Rezygnacja z dołączonej podróży
app.delete("/joined-trips/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  const { id } = req.params;

  try {
    // Usuń powiadomienia powiązane z tym joinem
    await db.query(
      "DELETE FROM notifications WHERE join_id IN (SELECT id FROM joins WHERE user_id=$1 AND trip_id=$2)",
      [req.user.id, id]
    );

    // Usuń join
    const result = await db.query(
      "DELETE FROM joins WHERE user_id=$1 AND trip_id=$2 RETURNING *",
      [req.user.id, id]
    );

    if (!result.rows.length) return res.status(404).json({ message: "Not joined or not found" });

    res.json({ message: "Opuściłeś podróż!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



const geocode = async (place) => {
  if (!place) return null;
  try {
    const res = await axios.get(`${process.env.ORS_API_URL}/geocode/search`, {
      params: { api_key: process.env.ORS_API_KEY, text: place },
    });
    const feature = res.data.features?.[0];
    if (!feature?.geometry?.coordinates) return null;
    return { lon: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] };
  } catch (err) {
    console.error("Błąd geokodowania:", err.message);
    return null;
  }
};

// Oblicza odległość w km między dwoma punktami GPS
const haversineDistance = (coords1, coords2) => {
  if (!coords1 || !coords2) return Infinity;
  const toRad = (v) => (v * Math.PI) / 180;
  const [lon1, lat1] = [coords1.lon, coords1.lat] || coords1; 
  const [lon2, lat2] = [coords2.lon, coords2.lat] || coords2;
  const R = 6371; // promień Ziemi w km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// --- SZUKANIE OFERT (pasażer szuka kierowcy) ---
app.post("/search-offers", async (req, res) => {
  const { origin, destination, date, people, pets } = req.body;

  try {
    // Pobieramy wszystkie oferty z DB
    const allOffersResult = await db.query("SELECT * FROM offers");
    const allOffers = allOffersResult.rows;

    // Koordynaty miejsca startu i celu wyszukiwania
    const originCoords = await geocode(origin);
    const destinationCoords = await geocode(destination);

    // Idealne oferty
    const offers = allOffers.filter(o => {
      if (origin && o.origin !== origin) return false;
      if (destination && o.destination !== destination) return false;
      if (date && new Date(o.date).toDateString() !== new Date(date).toDateString()) return false;
      if (people && o.seats_available < people) return false;
      if (pets && !o.pets) return false;
      return true;
    });

    // Alternatywy
    const alternativesRaw = allOffers.filter(o => {
      if (people && o.seats_available < people) return false;
      if (pets && !o.pets) return false;
      if (date && new Date(o.date).toDateString() !== new Date(date).toDateString()) return false;
      return !offers.find(of => of.id === o.id);
    });

    // Dodajemy koordynaty i obliczamy odległości
    const alternativesWithCoords = await Promise.all(
      alternativesRaw.map(async (o) => {
        const oOriginCoords = await geocode(o.origin);
        const oDestCoords = await geocode(o.destination);
        return {
          ...o,
          distanceToOrigin: haversineDistance(originCoords, oOriginCoords),
          distanceToDestination: haversineDistance(destinationCoords, oDestCoords),
        };
      })
    );

    // Sortujemy według odległości i daty
    const alternatives = alternativesWithCoords
      .sort((a, b) => {
        if (a.distanceToDestination !== b.distanceToDestination) return a.distanceToDestination - b.distanceToDestination;
        if (a.distanceToOrigin !== b.distanceToOrigin) return a.distanceToOrigin - b.distanceToOrigin;
        return new Date(a.date) - new Date(b.date);
      })
      .slice(0, 5); // np. max 5 alternatyw

    res.json({ offers, alternatives });
  } catch (err) {
    console.error("❌ /search-offers error:", err);
    res.status(500).json({ message: "Błąd pobierania ofert" });
  }
});


// --- SZUKANIE TRIPS (kierowca szuka pasażerów) ---
app.post("/search-trips", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ message: "Not authenticated" });


    console.log("📝 /search-trips req.body:", req.body);
  const userId = req.user.id;
  const origin = (req.body.origin || "").trim();
  const destination = (req.body.destination || "").trim();
  const date = req.body.date;

  let seatsAvailable = parseInt(req.body.seats_available ?? req.body.people, 10);
  if (isNaN(seatsAvailable) || seatsAvailable < 1) seatsAvailable = 1;

  let pets = req.body.pets;
  if (pets === undefined || pets === null) {
    pets = null;
  } else {
    pets = pets === true || pets === "true" || pets === 1 || pets === "1";
  }

  console.log("🔍 /search-trips params (normalized):", {
    userId,
    origin,
    destination,
    date,
    seatsAvailable,
    pets,
  });

  try {
    // --- Debug: ile rekordów w bazie ---
    const allTripsRes = await db.query("SELECT COUNT(*) AS count FROM trips");
    console.log("📝 Liczba wszystkich tripów w DB:", allTripsRes.rows[0].count);

    const sampleRes = await db.query("SELECT * FROM trips LIMIT 5");
    console.log("📝 Przykładowe tripy:", sampleRes.rows);

    // --- Główne wyszukiwanie ---
    const query = `
      SELECT * FROM trips
      WHERE user_id != $1
        AND LOWER(origin) LIKE LOWER($2)
        AND LOWER(destination) LIKE LOWER($3)
        AND DATE(date) = $4::date
        AND people >= $5
        AND ($6::boolean IS NULL OR pets = $6::boolean)
    `;
    const values = [userId, `%${origin}%`, `%${destination}%`, date, seatsAvailable, pets];

    console.log("📝 SQL query:", query);
    console.log("📝 SQL values:", values);

    const result = await db.query(query, values);

    console.log("✅ Liczba pasujących tripów:", result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Błąd wyszukiwania /search-trips:", err);
    res.status(500).json({ message: "Server error" });
  }
});


app.get("/notifications", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

  try {
    const result = await db.query(
      `
      SELECT n.*, j.status
      FROM notifications n
      LEFT JOIN joins j ON n.join_id = j.id
      WHERE n.user_id=$1
      ORDER BY n.created_at DESC
      `,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/notifications/:id/read", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  const { id } = req.params;

  try {
    await db.query("UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2", [
      id,
      req.user.id,
    ]);
    res.json({ message: "Powiadomienie oznaczone jako przeczytane" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

console.log("ORS_API_URL:", process.env.ORS_API_URL);
console.log("ORS_API_KEY:", process.env.ORS_API_KEY);

app.get("/api/geocode", async (req, res) => {
  const { place } = req.query;

  if (!place) return res.status(400).json({ error: "Brak parametru place" });

  try {
  const response = await axios.get(`${process.env.ORS_API_URL}/geocode/search`, {
  params: {
    api_key: process.env.ORS_API_KEY,
    text: place,
  },
});
  console.log("ORS response:", response.data); 
  res.json(response.data);
} catch (err) {
  console.error("Błąd geokodowania:", err.response?.data || err.message);
  res.status(500).json({ error: "Błąd geokodowania" });
}
});

app.post("/api/generateAdvice", async (req, res) => {
  try {
    const { tripParams } = req.body;

    if (!tripParams || !tripParams.destination || !tripParams.date) {
      return res.status(400).json({ message: "Brak miejsca docelowego lub daty." });
    }

    // 1️⃣ Geokodowanie miejsca docelowego (OpenRouteService)
    const geocodeRes = await axios.get(`${process.env.ORS_API_URL}/geocode/search`, {
      params: {
        api_key: process.env.ORS_API_KEY,
        text: tripParams.destination,
      },
    });

    const feature = geocodeRes.data.features?.[0];
    if (!feature?.geometry?.coordinates) {
      return res.status(500).json({ message: "Nie udało się pobrać współrzędnych miejsca docelowego." });
    }

    const [lon, lat] = feature.geometry.coordinates;

    // 2️⃣ Pobranie prognozy pogody z Open-Meteo
    const targetDate = new Date(tripParams.date).toISOString().split("T")[0]; // YYYY-MM-DD
    const weatherRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: lat,
        longitude: lon,
        daily: "temperature_2m_max,temperature_2m_min,weathercode",
        timezone: "Europe/Warsaw",
      },
    });

    const dailyForecast = weatherRes.data.daily;
    const dateIndex = dailyForecast.time.findIndex(d => d === targetDate);

    let infoText = "Brak prognozy dla tej daty.";
    if (dateIndex !== -1) {
      const maxTemp = dailyForecast.temperature_2m_max[dateIndex].toFixed(1);
      const minTemp = dailyForecast.temperature_2m_min[dateIndex].toFixed(1);
      infoText = `Prognoza pogody w dniu ${new Date(tripParams.date).toLocaleDateString("pl-PL")}: temperatura dzienna: ${maxTemp}°C, temperatura nocna: ${minTemp}°C.`;
    }

    console.log("Weather advice:", infoText);
    res.json({ destination: tripParams.destination, info: infoText });

  } catch (error) {
    console.error("❌ generateAdvice error:", error.response?.data || error.message);
    res.status(500).json({ message: "Nie udało się pobrać informacji o miejscu docelowym." });
  }
});


// Pobieranie wiadomości
app.get("/chat/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  console.log("[GET /chat]", { type, id });

  try {
    let query, params;

    if (type === "offer") {
      query = `
        SELECT m.*, u.email AS sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.offer_id = $1
        ORDER BY m.created_at ASC
      `;
      params = [id];
    } else if (type === "trip") {
      // Jeśli offer_id istnieje dla join -> pobierz wiadomości po offer_id
      // W przeciwnym wypadku pobierz wiadomości po trip_id
      query = `
        SELECT m.*, u.email AS sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.offer_id = (
          SELECT offer_id 
          FROM joins 
          WHERE trip_id = $1 AND status = 'accepted' AND offer_id IS NOT NULL
          LIMIT 1
        )
        OR m.trip_id = $1
        ORDER BY m.created_at ASC
      `;
      params = [id];
    } else {
      return res.status(400).json({ error: "Invalid chat type" });
    }

    console.log("[GET /chat] SQL query:", query, "params:", params);

    const result = await db.query(query, params);
    console.log(`[GET /chat] znaleziono ${result.rows.length} wiadomości`);
    res.json(result.rows);
  } catch (err) {
    console.error("[GET /chat] ❌ Błąd:", err);
    res.status(500).json({ error: "Błąd serwera przy pobieraniu wiadomości" });
  }
});


// Wysyłanie wiadomości
app.post("/chat/:type/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    console.log("[POST /chat] ❌ Użytkownik nieautoryzowany");
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { type, id } = req.params;
  const { message } = req.body;
  console.log("[POST /chat] type:", type, "id:", id, "message:", message);

  if (!message) {
    console.log("[POST /chat] ❌ Brak wiadomości w body");
    return res.status(400).json({ message: "Message is required" });
  }

  try {
    let query, params;

    if (type === "offer") {
      query = `
        INSERT INTO messages (offer_id, sender_id, message)
        VALUES ($1, $2, $3) RETURNING *
      `;
      params = [id, req.user.id, message];
    } else if (type === "trip") {
      // 🔑 znajdź powiązane offer_id
      const joinRes = await db.query(
        "SELECT offer_id FROM joins WHERE trip_id = $1 AND status = 'accepted' LIMIT 1",
        [id]
      );
      const offerId = joinRes.rows[0]?.offer_id;

      if (!offerId) {
        console.log("[POST /chat] ❌ Brak powiązanej oferty dla trip_id:", id);
        return res.status(400).json({ message: "No related offer found" });
      }

      query = `
        INSERT INTO messages (offer_id, sender_id, message)
        VALUES ($1, $2, $3) RETURNING *
      `;
      params = [offerId, req.user.id, message];
    } else {
      console.log("[POST /chat] ❌ Niepoprawny typ:", type);
      return res.status(400).json({ message: "Invalid type" });
    }

    console.log("[POST /chat] SQL query:", query, "params:", params);

    const result = await db.query(query, params);
    console.log("[POST /chat] Wiadomość zapisana:", result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[POST /chat] ❌ Błąd:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Wylogowanie
app.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ message: "Logout failed" });

    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Could not destroy session" });

      res.clearCookie("connect.sid");
      res.status(200).json({ message: "Logged out" });
    });
  });
});

// --- Middleware obsługi błędów ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Coś poszło nie tak!" });
});

const server = http.createServer(app);
// --- Socket.IO ---
const io = new SocketIO(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"],
    credentials: true,
  },
});


  // Wysyłanie wiadomości
 io.on("connection", (socket) => {
  console.log("✅ Nowe połączenie Socket.IO:", socket.id);

  // --- Dołączanie do pokoju ---
  socket.on("joinRoom", async ({ type, id }) => {
  try {
    let roomId = null;

    if (type === "offer") {
      roomId = `offer-${id}`;
    } else if (type === "trip") {
      const joinRes = await db.query(
        "SELECT offer_id FROM joins WHERE trip_id = $1 AND status = 'accepted' LIMIT 1",
        [id]
      );
      const offerId = joinRes.rows[0]?.offer_id;
      // Jeśli jest offer_id -> używamy pokoju offer
      // Jeśli nie ma -> tworzymy pokój unikalny dla trip_id
      roomId = offerId ? `offer-${offerId}` : `trip-${id}`;
    }

    socket.join(roomId);
    console.log(`👥 Użytkownik ${socket.id} dołączył do pokoju ${roomId}`);
  } catch (err) {
    console.error("❌ Błąd w joinRoom:", err);
  }
});


  // Wysyłanie wiadomości
socket.on("sendMessage", async ({ type, id, senderId, message }) => {
  try {
    if (!senderId) {
      console.log("❌ Brak senderId w danych");
      return;
    }

    let offerId = null;
    let room = "";

    if (type === "offer") {
      offerId = id;
      room = `offer-${offerId}`;
    } else if (type === "trip") {
      const joinRes = await db.query(
        "SELECT offer_id FROM joins WHERE trip_id = $1 AND status = 'accepted' LIMIT 1",
        [id]
      );
      offerId = joinRes.rows[0]?.offer_id;

      if (offerId) {
        room = `offer-${offerId}`;
      } else {
        room = `trip-${id}`;
      }
    }

    const result = await db.query(
      `INSERT INTO messages (offer_id, trip_id, sender_id, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, offer_id, trip_id, sender_id, message, created_at`,
      [offerId || null, type === "trip" && !offerId ? id : null, senderId, message]
    );

    const newMsg = result.rows[0];
    const userRes = await db.query("SELECT email FROM users WHERE id = $1", [senderId]);
    newMsg.sender_name = userRes.rows[0]?.email || "Nieznany";

    io.to(room).emit("newMessage", newMsg);
    console.log(`📤 Wysłano wiadomość do pokoju ${room}`);
  } catch (err) {
    console.error("❌ Błąd zapisu wiadomości:", err);
  }
});


  // --- Rozłączenie ---
  socket.on("disconnect", () => {
    console.log(`❌ Użytkownik ${socket.id} rozłączony`);
  });
});


// Naprawiamy brakujące trip_id i offer_id przed startem serwera
fixJoins()
  .then((fixedRows) => {
    console.log(`✅ Naprawiono brakujące wpisy w joins: ${fixedRows.length} rekordów`);

    // --- Start serwera ---
    server.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
    });

    // --- Zamykanie połączeń DB ---
    process.on("SIGTERM", async () => {
      console.log("Closing database connections...");
      await db.end();
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error("❌ Błąd przy starcie serwera:", err);
    process.exit(1);
  });