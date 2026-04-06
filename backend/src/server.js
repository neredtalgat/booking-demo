import express from "express";
import cors from "cors";

const app = express();
const PORT = 8080;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const users = [
  { id: 1, email: "guest@hotel.com", name: "Guest User" },
  { id: 2, email: "admin@hotel.com", name: "Admin User" }
];

const rooms = [
  {
    id: 101,
    name: "Deluxe City View",
    city: "Almaty",
    pricePerNight: 120,
    maxGuests: 2,
    amenities: ["Wi-Fi", "Breakfast", "Air conditioning"]
  },
  {
    id: 102,
    name: "Family Suite",
    city: "Astana",
    pricePerNight: 180,
    maxGuests: 4,
    amenities: ["Wi-Fi", "Breakfast", "Kitchen", "Parking"]
  },
  {
    id: 103,
    name: "Business Room",
    city: "Shymkent",
    pricePerNight: 90,
    maxGuests: 2,
    amenities: ["Wi-Fi", "Desk", "Airport shuttle"]
  },
  {
    id: 104,
    name: "Panorama Suite",
    city: "Almaty",
    pricePerNight: 220,
    maxGuests: 3,
    amenities: ["Wi-Fi", "Breakfast", "Spa access", "Mini bar"]
  }
];

const sessions = new Map();
const bookings = [];
let bookingId = 1;

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeISODate(value) {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function nightsBetween(checkIn, checkOut) {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function overlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing auth token" });
  }

  const token = header.slice(7);
  const user = sessions.get(token);
  if (!user) {
    return res.status(401).json({ message: "Invalid token" });
  }

  req.user = user;
  next();
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Valid email is required" });
  }

  const user = users.find((u) => u.email === email) || {
    id: Date.now(),
    email,
    name: email.split("@")[0]
  };

  const token = Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString("base64");
  sessions.set(token, user);

  res.json({ token, user });
});

app.get("/rooms", (req, res) => {
  const city = String(req.query.city || "").trim().toLowerCase();
  const guests = Number(req.query.guests || 0);
  const checkInRaw = req.query.checkIn;
  const checkOutRaw = req.query.checkOut;

  let filtered = rooms;

  if (city) {
    filtered = filtered.filter((room) => room.city.toLowerCase().includes(city));
  }

  if (guests > 0) {
    filtered = filtered.filter((room) => room.maxGuests >= guests);
  }

  if (checkInRaw && checkOutRaw) {
    const checkIn = parseDate(checkInRaw);
    const checkOut = parseDate(checkOutRaw);

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    filtered = filtered.filter((room) => {
      const roomBookings = bookings.filter((b) => b.roomId === room.id);
      return roomBookings.every((b) => {
        const bookedIn = parseDate(b.checkIn);
        const bookedOut = parseDate(b.checkOut);
        return !overlap(checkIn, checkOut, bookedIn, bookedOut);
      });
    });
  }

  res.json(filtered);
});

app.get("/bookings", authMiddleware, (req, res) => {
  const userBookings = bookings
    .filter((b) => b.userId === req.user.id)
    .map((b) => ({
      ...b,
      room: rooms.find((r) => r.id === b.roomId) || null
    }));

  res.json(userBookings);
});

app.post("/bookings", authMiddleware, (req, res) => {
  const roomId = Number(req.body?.roomId);
  const guests = Number(req.body?.guests);
  const checkIn = parseDate(req.body?.checkIn);
  const checkOut = parseDate(req.body?.checkOut);

  if (!roomId || !guests || !checkIn || !checkOut) {
    return res.status(400).json({ message: "roomId, guests, checkIn and checkOut are required" });
  }

  if (checkOut <= checkIn) {
    return res.status(400).json({ message: "checkOut must be later than checkIn" });
  }

  const room = rooms.find((r) => r.id === roomId);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  if (guests > room.maxGuests) {
    return res.status(400).json({ message: `Room allows up to ${room.maxGuests} guests` });
  }

  const hasConflict = bookings
    .filter((b) => b.roomId === roomId)
    .some((b) => overlap(checkIn, checkOut, parseDate(b.checkIn), parseDate(b.checkOut)));

  if (hasConflict) {
    return res.status(409).json({ message: "Selected dates are already booked for this room" });
  }

  const nights = nightsBetween(checkIn, checkOut);
  const totalPrice = nights * room.pricePerNight;

  const booking = {
    id: bookingId++,
    userId: req.user.id,
    roomId: room.id,
    guests,
    checkIn: normalizeISODate(checkIn),
    checkOut: normalizeISODate(checkOut),
    nights,
    totalPrice,
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);

  res.status(201).json({
    ...booking,
    room
  });
});

app.listen(PORT, () => {
  console.log(`Hotel booking backend running on http://localhost:${PORT}`);
});
