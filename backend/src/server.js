import crypto from "crypto";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { query as dbQuery } from "./database.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts, please try again later.",
  skipSuccessfulRequests: true,
});

app.use(limiter);
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);

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
  try {
    const actualHash = crypto.scryptSync(password, String(salt || ""), 64).toString("hex");
    const actualBuffer = Buffer.from(actualHash, "hex");
    const expectedBuffer = Buffer.from(String(expectedHash || ""), "hex");

    if (
      actualBuffer.length === 0 ||
      expectedBuffer.length === 0 ||
      actualBuffer.length !== expectedBuffer.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function serializeRoom(row) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    pricePerNight: Number(row.price_per_night),
    maxGuests: row.max_guests,
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    categoryId: row.category_id,
    categoryName: row.category_name || "Unknown",
    createdAt: row.created_at,
  };
}

// Auth Middleware
async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing auth token" });
    }

    const token = header.slice(7);

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const result = await dbQuery(
      "SELECT id, name, email, role FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = result.rows[0];
    req.token = token;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
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
  const categoryId = Number(payload?.categoryId);
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

  if (!Number.isFinite(categoryId) || categoryId < 1) {
    return { error: "categoryId is required and must be a valid category" };
  }

  return {
    room: {
      name,
      city,
      pricePerNight,
      maxGuests,
      amenities,
      categoryId
    }
  };
}

async function buildBookingPayload(input) {
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

  const roomResult = await dbQuery("SELECT * FROM rooms WHERE id = $1", [roomId]);
  const room = roomResult.rows[0];

  if (!room) {
    return { error: "Room not found", status: 404 };
  }

  if (guests > room.max_guests) {
    return { error: `Room allows up to ${room.max_guests} guests` };
  }

  return {
    payload: {
      room,
      roomId,
      guests,
      checkIn,
      checkOut,
      nights: nightsBetween(checkIn, checkOut),
    },
  };
}

async function hasBookingConflict({ roomId, checkIn, checkOut, ignoreBookingId = null }) {
  const query =
    ignoreBookingId === null
      ? "SELECT * FROM bookings WHERE room_id = $1"
      : "SELECT * FROM bookings WHERE room_id = $1 AND id != $2";

  const params = ignoreBookingId === null ? [roomId] : [roomId, ignoreBookingId];
  const result = await dbQuery(query, params);

  return result.rows.some((booking) =>
    overlap(checkIn, checkOut, parseDate(booking.check_in), parseDate(booking.check_out))
  );
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Auth Routes
app.post("/auth/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !email.includes("@") || password.length < 6) {
      return res.status(400).json({ message: "name, valid email, and password(>=6) are required" });
    }

    const existsResult = await dbQuery("SELECT id FROM users WHERE email = $1", [email]);
    if (existsResult.rows.length > 0) {
      return res.status(409).json({ message: "User with this email already exists" });
    }

    const { salt, hash } = hashPassword(password);
    const result = await dbQuery(
      "INSERT INTO users (name, email, password_salt, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role",
      [name, email, salt, hash, "guest"]
    );

    const user = result.rows[0];
    res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const userResult = await dbQuery("SELECT * FROM users WHERE email = $1", [email]);
    const user = userResult.rows[0];

    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await dbQuery("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)", [
      token,
      user.id,
      expiresAt,
    ]);

    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/auth/logout", authMiddleware, async (req, res) => {
  try {
    await dbQuery("DELETE FROM sessions WHERE token = $1", [req.token]);
    res.json({ message: "Logged out" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/users/me", authMiddleware, (req, res) => {
  res.json(sanitizeUser(req.user));
});

// User Routes
app.get("/users", authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await dbQuery("SELECT id, name, email, role FROM users");
    res.json(result.rows.map(sanitizeUser));
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/users/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await dbQuery("SELECT id, name, email, role FROM users WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (req.user.role !== "admin" && req.user.id !== id) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(sanitizeUser(result.rows[0]));
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/users/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userResult = await dbQuery("SELECT * FROM users WHERE id = $1", [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    if (req.user.role !== "admin" && req.user.id !== id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const name = req.body?.name;
    const password = req.body?.password;

    let updateQuery = "UPDATE users SET";
    const params = [];
    let paramCount = 1;

    if (name !== undefined) {
      const trimmedName = String(name).trim() || user.name;
      updateQuery += ` name = $${paramCount++}`;
      params.push(trimmedName);
    }

    if (password !== undefined) {
      const textPassword = String(password);
      if (textPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const { salt, hash } = hashPassword(textPassword);
      if (params.length > 0) updateQuery += ",";
      updateQuery += ` password_salt = $${paramCount++}, password_hash = $${paramCount++}`;
      params.push(salt, hash);
    }

    if (params.length === 0) {
      const result = await dbQuery("SELECT id, name, email, role FROM users WHERE id = $1", [id]);
      return res.json(sanitizeUser(result.rows[0]));
    }

    updateQuery += ` WHERE id = $${paramCount}`;
    params.push(id);

    const result = await dbQuery(updateQuery + " RETURNING id, name, email, role", params);
    res.json(sanitizeUser(result.rows[0]));
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/users/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const userResult = await dbQuery("SELECT id FROM users WHERE id = $1", [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    await dbQuery("DELETE FROM users WHERE id = $1", [id]);
    res.status(204).send();
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Category Routes
app.get("/categories", async (req, res) => {
  try {
    const result = await dbQuery("SELECT id, name, created_at FROM categories ORDER BY name");
    res.json(result.rows);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await dbQuery("SELECT id, name, created_at FROM categories WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/categories", authMiddleware, adminOnly, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const result = await dbQuery(
      "INSERT INTO categories (name) VALUES ($1) RETURNING id, name, created_at",
      [name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Category with this name already exists" });
    }
    console.error("Create category error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/categories/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const result = await dbQuery(
      "UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name, created_at",
      [name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Category with this name already exists" });
    }
    console.error("Update category error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/categories/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const roomCheck = await dbQuery("SELECT id FROM rooms WHERE category_id = $1 LIMIT 1", [id]);
    if (roomCheck.rows.length > 0) {
      return res.status(409).json({ message: "Cannot delete category with existing rooms" });
    }

    const result = await dbQuery("DELETE FROM categories WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Room Routes
app.get("/rooms", async (req, res) => {
  try {
    const city = String(req.query.city || "").trim().toLowerCase();
    const guests = Number(req.query.guests || 0);
    const categoryId = Number(req.query.categoryId || 0);
    const checkInRaw = req.query.checkIn;
    const checkOutRaw = req.query.checkOut;

    let query = "SELECT r.*, c.name as category_name FROM rooms r LEFT JOIN categories c ON r.category_id = c.id WHERE 1=1";
    const params = [];
    let paramCount = 1;

    if (city) {
      query += ` AND LOWER(r.city) LIKE $${paramCount++}`;
      params.push(`%${city}%`);
    }

    if (categoryId > 0) {
      query += ` AND r.category_id = $${paramCount++}`;
      params.push(categoryId);
    }

    if (guests > 0) {
      query += ` AND r.max_guests >= $${paramCount++}`;
      params.push(guests);
    }

    const roomsResult = await dbQuery(query, params);
    let filtered = roomsResult.rows;

    if (checkInRaw && checkOutRaw) {
      const checkIn = parseDate(checkInRaw);
      const checkOut = parseDate(checkOutRaw);

      if (!checkIn || !checkOut || checkOut <= checkIn) {
        return res.status(400).json({ message: "Invalid date range" });
      }

      const bookingsResult = await dbQuery("SELECT * FROM bookings");
      const bookings = bookingsResult.rows;

      filtered = filtered.filter((room) => {
        const roomBookings = bookings.filter((b) => b.room_id === room.id);
        return roomBookings.every((booking) => {
          const bookedIn = parseDate(booking.check_in);
          const bookedOut = parseDate(booking.check_out);
          return !overlap(checkIn, checkOut, bookedIn, bookedOut);
        });
      });
    }

    res.json(filtered.map(serializeRoom));
  } catch (error) {
    console.error("Get rooms error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/rooms/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await dbQuery("SELECT r.*, c.name as category_name FROM rooms r LEFT JOIN categories c ON r.category_id = c.id WHERE r.id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json(serializeRoom(result.rows[0]));
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/rooms", authMiddleware, adminOnly, async (req, res) => {
  try {
    const validated = validateRoomPayload(req.body);
    if (validated.error) {
      return res.status(400).json({ message: validated.error });
    }

    const { name, city, pricePerNight, maxGuests, amenities, categoryId } = validated.room;

    const categoryResult = await dbQuery("SELECT id FROM categories WHERE id = $1", [categoryId]);
    if (categoryResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const result = await dbQuery(
      "INSERT INTO rooms (name, city, price_per_night, max_guests, amenities, category_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING * , (SELECT name FROM categories WHERE id = $6) as category_name",
      [name, city, pricePerNight, maxGuests, amenities, categoryId]
    );

    res.status(201).json(serializeRoom(result.rows[0]));
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/rooms/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const roomResult = await dbQuery("SELECT * FROM rooms WHERE id = $1", [id]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    const room = roomResult.rows[0];
    const validated = validateRoomPayload({ ...room, pricePerNight: room.price_per_night, maxGuests: room.max_guests, categoryId: room.category_id, ...req.body });

    if (validated.error) {
      return res.status(400).json({ message: validated.error });
    }

    const { name, city, pricePerNight, maxGuests, amenities, categoryId } = validated.room;

    const categoryResult = await dbQuery("SELECT id FROM categories WHERE id = $1", [categoryId]);
    if (categoryResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const result = await dbQuery(
      "UPDATE rooms SET name = $1, city = $2, price_per_night = $3, max_guests = $4, amenities = $5, category_id = $6 WHERE id = $7 RETURNING *, (SELECT name FROM categories WHERE id = $6) as category_name",
      [name, city, pricePerNight, maxGuests, amenities, categoryId, id]
    );

    res.json(serializeRoom(result.rows[0]));
  } catch (error) {
    console.error("Update room error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/rooms/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const roomResult = await dbQuery("SELECT id FROM rooms WHERE id = $1", [id]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    await dbQuery("DELETE FROM rooms WHERE id = $1", [id]);
    res.status(204).send();
  } catch (error) {
    console.error("Delete room error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Booking Routes (one-to-many: room -> bookings)
app.get("/bookings", authMiddleware, async (req, res) => {
  try {
    let query;
    const params = [];

    if (req.user.role === "admin") {
      query = `
        SELECT
          b.id AS booking_id,
          b.user_id,
          b.room_id,
          b.guests,
          b.check_in,
          b.check_out,
          b.nights,
          b.total_price,
          b.created_at,
          u.id AS user_id_ref,
          u.name AS user_name,
          u.email AS user_email,
          u.role AS user_role,
          r.id AS room_id_ref,
          r.name AS room_name,
          r.city,
          r.price_per_night,
          r.max_guests,
          r.amenities
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
      `;
    } else {
      query = `
        SELECT
          b.id AS booking_id,
          b.user_id,
          b.room_id,
          b.guests,
          b.check_in,
          b.check_out,
          b.nights,
          b.total_price,
          b.created_at,
          u.id AS user_id_ref,
          u.name AS user_name,
          u.email AS user_email,
          u.role AS user_role,
          r.id AS room_id_ref,
          r.name AS room_name,
          r.city,
          r.price_per_night,
          r.max_guests,
          r.amenities
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        WHERE b.user_id = $1
      `;
      params.push(req.user.id);
    }

    const result = await dbQuery(query, params);

    const bookings = result.rows.map((row) => ({
      id: row.booking_id,
      userId: row.user_id,
      roomId: row.room_id,
      guests: row.guests,
      checkIn: row.check_in,
      checkOut: row.check_out,
      nights: row.nights,
      totalPrice: row.total_price,
      createdAt: row.created_at,
      room: {
        id: row.room_id_ref,
        name: row.room_name,
        city: row.city,
        pricePerNight: row.price_per_night,
        maxGuests: row.max_guests,
        amenities: row.amenities,
      },
      user: {
        id: row.user_id_ref,
        name: row.user_name,
        email: row.user_email,
        role: row.user_role,
      },
    }));

    res.json(bookings);
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/bookings/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await dbQuery(
      `SELECT
        b.id AS booking_id,
        b.user_id,
        b.room_id,
        b.guests,
        b.check_in,
        b.check_out,
        b.nights,
        b.total_price,
        b.created_at,
        r.id AS room_id_ref,
        r.name AS room_name,
        r.city,
        r.price_per_night,
        r.max_guests,
        r.amenities
       FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const row = result.rows[0];

    if (req.user.role !== "admin" && row.user_id !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const booking = {
      id: row.booking_id,
      userId: row.user_id,
      roomId: row.room_id,
      guests: row.guests,
      checkIn: row.check_in,
      checkOut: row.check_out,
      nights: row.nights,
      totalPrice: row.total_price,
      createdAt: row.created_at,
      room: {
        id: row.room_id_ref,
        name: row.room_name,
        city: row.city,
        pricePerNight: row.price_per_night,
        maxGuests: row.max_guests,
        amenities: row.amenities,
      },
    };

    res.json(booking);
  } catch (error) {
    console.error("Get booking error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/bookings", authMiddleware, async (req, res) => {
  try {
    const prepared = await buildBookingPayload(req.body);
    if (prepared.error) {
      return res.status(prepared.status || 400).json({ message: prepared.error });
    }

    const { room, roomId, guests, checkIn, checkOut, nights } = prepared.payload;

    if (await hasBookingConflict({ roomId, checkIn, checkOut })) {
      return res.status(409).json({ message: "Selected dates are already booked for this room" });
    }

    const result = await dbQuery(
      `INSERT INTO bookings (user_id, room_id, guests, check_in, check_out, nights, total_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.id,
        roomId,
        guests,
        normalizeISODate(checkIn),
        normalizeISODate(checkOut),
        nights,
        nights * room.price_per_night,
      ]
    );

    const booking = result.rows[0];
    res.status(201).json({
      id: booking.id,
      userId: booking.user_id,
      roomId: booking.room_id,
      guests: booking.guests,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      totalPrice: booking.total_price,
      createdAt: booking.created_at,
      room,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/bookings/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const bookingResult = await dbQuery("SELECT * FROM bookings WHERE id = $1", [id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = bookingResult.rows[0];

    if (req.user.role !== "admin" && booking.user_id !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.body?.roomId !== undefined && Number(req.body.roomId) !== booking.room_id) {
      return res.status(400).json({ message: "Room ID cannot be changed for an existing booking" });
    }

    const prepared = await buildBookingPayload({ ...booking, ...req.body, roomId: booking.room_id });
    if (prepared.error) {
      return res.status(prepared.status || 400).json({ message: prepared.error });
    }

    const { room, roomId, guests, checkIn, checkOut, nights } = prepared.payload;

    if (await hasBookingConflict({ roomId, checkIn, checkOut, ignoreBookingId: id })) {
      return res.status(409).json({ message: "Selected dates are already booked for this room" });
    }

    const result = await dbQuery(
      `UPDATE bookings
       SET room_id = $1, guests = $2, check_in = $3, check_out = $4, nights = $5, total_price = $6
       WHERE id = $7
       RETURNING *`,
      [roomId, guests, normalizeISODate(checkIn), normalizeISODate(checkOut), nights, nights * room.price_per_night, id]
    );

    const updatedBooking = result.rows[0];
    res.json({
      id: updatedBooking.id,
      userId: updatedBooking.user_id,
      roomId: updatedBooking.room_id,
      guests: updatedBooking.guests,
      checkIn: updatedBooking.check_in,
      checkOut: updatedBooking.check_out,
      nights: updatedBooking.nights,
      totalPrice: updatedBooking.total_price,
      createdAt: updatedBooking.created_at,
      room,
    });
  } catch (error) {
    console.error("Update booking error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/bookings/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const bookingResult = await dbQuery("SELECT * FROM bookings WHERE id = $1", [id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = bookingResult.rows[0];

    if (req.user.role !== "admin" && booking.user_id !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    await dbQuery("DELETE FROM bookings WHERE id = $1", [id]);
    res.status(204).send();
  } catch (error) {
    console.error("Delete booking error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Hotel booking backend running on http://localhost:${PORT}`);
  console.log("📚 Demo users: admin@hotel.com/12345admin, guest@hotel.com/12345guest");
  console.log("💾 Connected to PostgreSQL database");
});
