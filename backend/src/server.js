import crypto from "crypto";
import express from "express";
import cors from "cors";

const app = express();
const PORT = 8080;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

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

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const actualHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

const users = [];
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
  }
];

const bookings = [];
const sessions = new Map();
let userIdCounter = 1;
let roomIdCounter = 104;
let bookingIdCounter = 1;

function createSeedUser({ name, email, password, role = "guest" }) {
  const { salt, hash } = hashPassword(password);
  const user = {
    id: userIdCounter++,
    name,
    email: email.toLowerCase(),
    role,
    passwordSalt: salt,
    passwordHash: hash
  };
  users.push(user);
}

createSeedUser({ name: "Admin User", email: "admin@hotel.com", password: "admin123", role: "admin" });
createSeedUser({ name: "Guest User", email: "guest@hotel.com", password: "guest123", role: "guest" });

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing auth token" });
  }

  const token = header.slice(7);
  const userId = sessions.get(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  const user = users.find((u) => u.id === userId);
  if (!user) {
    sessions.delete(token);
    return res.status(401).json({ message: "Session expired" });
  }

  req.user = user;
  req.token = token;
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin role required" });
  }
  next();
}

function validateRoomPayload(payload) {
  const name = String(payload?.name || "").trim();
  const city = String(payload?.city || "").trim();
  const pricePerNight = Number(payload?.pricePerNight);
  const maxGuests = Number(payload?.maxGuests);
  const amenitiesInput = payload?.amenities;
  const amenities = Array.isArray(amenitiesInput)
    ? amenitiesInput.map((item) => String(item).trim()).filter(Boolean)
    : String(amenitiesInput || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  if (!name || !city || !Number.isFinite(pricePerNight) || !Number.isFinite(maxGuests) || maxGuests < 1) {
    return { error: "name, city, pricePerNight, maxGuests are required" };
  }

  return {
    room: {
      name,
      city,
      pricePerNight,
      maxGuests,
      amenities
    }
  };
}

function buildBookingPayload(input) {
  const roomId = Number(input?.roomId);
  const guests = Number(input?.guests);
  const checkIn = parseDate(input?.checkIn);
  const checkOut = parseDate(input?.checkOut);

  if (!roomId || !guests || !checkIn || !checkOut) {
    return { error: "roomId, guests, checkIn and checkOut are required" };
  }

  if (checkOut <= checkIn) {
    return { error: "checkOut must be later than checkIn" };
  }

  const room = rooms.find((r) => r.id === roomId);
  if (!room) {
    return { error: "Room not found", status: 404 };
  }

  if (guests > room.maxGuests) {
    return { error: `Room allows up to ${room.maxGuests} guests` };
  }

  return {
    payload: {
      room,
      roomId,
      guests,
      checkIn,
      checkOut,
      nights: nightsBetween(checkIn, checkOut)
    }
  };
}

function hasBookingConflict({ roomId, checkIn, checkOut, ignoreBookingId = null }) {
  return bookings
    .filter((booking) => booking.roomId === roomId && booking.id !== ignoreBookingId)
    .some((booking) => overlap(checkIn, checkOut, parseDate(booking.checkIn), parseDate(booking.checkOut)));
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/register", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!name || !email.includes("@") || password.length < 6) {
    return res.status(400).json({ message: "name, valid email, and password(>=6) are required" });
  }

  if (users.some((user) => user.email === email)) {
    return res.status(409).json({ message: "User with this email already exists" });
  }

  const { salt, hash } = hashPassword(password);
  const user = {
    id: userIdCounter++,
    name,
    email,
    role: "guest",
    passwordSalt: salt,
    passwordHash: hash
  };

  users.push(user);

  res.status(201).json({ user: sanitizeUser(user) });
});

app.post("/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = users.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, user.id);

  res.json({ token, user: sanitizeUser(user) });
});

app.post("/auth/logout", authMiddleware, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: "Logged out" });
});

app.get("/users", authMiddleware, adminOnly, (_req, res) => {
  res.json(users.map(sanitizeUser));
});

app.get("/users/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const target = users.find((user) => user.id === id);

  if (!target) {
    return res.status(404).json({ message: "User not found" });
  }

  if (req.user.role !== "admin" && req.user.id !== id) {
    return res.status(403).json({ message: "Access denied" });
  }

  res.json(sanitizeUser(target));
});

app.put("/users/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (req.user.role !== "admin" && req.user.id !== id) {
    return res.status(403).json({ message: "Access denied" });
  }

  const name = req.body?.name;
  const password = req.body?.password;

  if (name !== undefined) {
    user.name = String(name).trim() || user.name;
  }

  if (password !== undefined) {
    const textPassword = String(password);
    if (textPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const { salt, hash } = hashPassword(textPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
  }

  res.json(sanitizeUser(user));
});

app.delete("/users/:id", authMiddleware, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const index = users.findIndex((user) => user.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "User not found" });
  }

  users.splice(index, 1);

  for (let i = bookings.length - 1; i >= 0; i -= 1) {
    if (bookings[i].userId === id) {
      bookings.splice(i, 1);
    }
  }

  for (const [token, userId] of sessions.entries()) {
    if (userId === id) {
      sessions.delete(token);
    }
  }

  res.status(204).send();
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
      const roomBookings = bookings.filter((booking) => booking.roomId === room.id);
      return roomBookings.every((booking) => {
        const bookedIn = parseDate(booking.checkIn);
        const bookedOut = parseDate(booking.checkOut);
        return !overlap(checkIn, checkOut, bookedIn, bookedOut);
      });
    });
  }

  res.json(filtered);
});

app.get("/rooms/:id", (req, res) => {
  const room = rooms.find((item) => item.id === Number(req.params.id));
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }
  res.json(room);
});

app.post("/rooms", authMiddleware, adminOnly, (req, res) => {
  const validated = validateRoomPayload(req.body);
  if (validated.error) {
    return res.status(400).json({ message: validated.error });
  }

  const room = { id: roomIdCounter++, ...validated.room };
  rooms.push(room);
  res.status(201).json(room);
});

app.put("/rooms/:id", authMiddleware, adminOnly, (req, res) => {
  const room = rooms.find((item) => item.id === Number(req.params.id));
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  const validated = validateRoomPayload({ ...room, ...req.body });
  if (validated.error) {
    return res.status(400).json({ message: validated.error });
  }

  Object.assign(room, validated.room);
  res.json(room);
});

app.delete("/rooms/:id", authMiddleware, adminOnly, (req, res) => {
  const roomId = Number(req.params.id);
  const index = rooms.findIndex((room) => room.id === roomId);
  if (index === -1) {
    return res.status(404).json({ message: "Room not found" });
  }

  rooms.splice(index, 1);
  for (let i = bookings.length - 1; i >= 0; i -= 1) {
    if (bookings[i].roomId === roomId) {
      bookings.splice(i, 1);
    }
  }

  res.status(204).send();
});

app.get("/bookings", authMiddleware, (req, res) => {
  const result = (req.user.role === "admin" ? bookings : bookings.filter((b) => b.userId === req.user.id)).map((booking) => ({
    ...booking,
    room: rooms.find((room) => room.id === booking.roomId) || null,
    user: sanitizeUser(users.find((user) => user.id === booking.userId) || { id: null, name: "Deleted", email: "deleted@user", role: "guest" })
  }));

  res.json(result);
});

app.get("/bookings/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const booking = bookings.find((item) => item.id === id);
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  if (req.user.role !== "admin" && booking.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }

  res.json({
    ...booking,
    room: rooms.find((room) => room.id === booking.roomId) || null
  });
});

app.post("/bookings", authMiddleware, (req, res) => {
  const prepared = buildBookingPayload(req.body);
  if (prepared.error) {
    return res.status(prepared.status || 400).json({ message: prepared.error });
  }

  const { room, roomId, guests, checkIn, checkOut, nights } = prepared.payload;

  if (hasBookingConflict({ roomId, checkIn, checkOut })) {
    return res.status(409).json({ message: "Selected dates are already booked for this room" });
  }

  const booking = {
    id: bookingIdCounter++,
    userId: req.user.id,
    roomId,
    guests,
    checkIn: normalizeISODate(checkIn),
    checkOut: normalizeISODate(checkOut),
    nights,
    totalPrice: nights * room.pricePerNight,
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);
  res.status(201).json({ ...booking, room });
});

app.put("/bookings/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const booking = bookings.find((item) => item.id === id);
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  if (req.user.role !== "admin" && booking.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }

  const prepared = buildBookingPayload({ ...booking, ...req.body });
  if (prepared.error) {
    return res.status(prepared.status || 400).json({ message: prepared.error });
  }

  const { room, roomId, guests, checkIn, checkOut, nights } = prepared.payload;

  if (hasBookingConflict({ roomId, checkIn, checkOut, ignoreBookingId: booking.id })) {
    return res.status(409).json({ message: "Selected dates are already booked for this room" });
  }

  booking.roomId = roomId;
  booking.guests = guests;
  booking.checkIn = normalizeISODate(checkIn);
  booking.checkOut = normalizeISODate(checkOut);
  booking.nights = nights;
  booking.totalPrice = nights * room.pricePerNight;

  res.json({ ...booking, room });
});

app.delete("/bookings/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const index = bookings.findIndex((item) => item.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const booking = bookings[index];
  if (req.user.role !== "admin" && booking.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }

  bookings.splice(index, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Hotel booking backend running on http://localhost:${PORT}`);
  console.log("Demo users: admin@hotel.com/admin123, guest@hotel.com/guest123");
});
