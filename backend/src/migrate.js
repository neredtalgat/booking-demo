import crypto from "crypto";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const bootstrapPool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
});

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function categorySeedData() {
  return [
    "Standard",
    "Economy",
    "Deluxe",
    "Luxury",
    "Suite",
    "Studio",
    "Apartment",
    "Villa",
  ];
}

const SEED_BASE_URL = process.env.BACKEND_URL || "http://localhost:8080";

function roomSeedData() {
  return [
    ["Deluxe City View",    "Almaty",   120.0, 2, ["Wi-Fi", "Breakfast", "Air conditioning"], "Deluxe",   `${SEED_BASE_URL}/uploads/seed-deluxe-city-almaty.jpg`],
    ["Royal Suite",         "Astana",   260.0, 4, ["Wi-Fi", "Spa", "Breakfast", "Parking"],   "Luxury",   `${SEED_BASE_URL}/uploads/seed-royal-suite-astana.jpg`],
    ["Mountain Cabin",      "Almaty",   200.0, 5, ["Fireplace", "Kitchen", "Parking"],         "Villa",    `${SEED_BASE_URL}/uploads/seed-mountain-cabin-almaty.jpg`],
    ["Seaside Apartment",   "Aktau",    170.0, 4, ["Wi-Fi", "Kitchen", "Sea view"],            "Apartment",`${SEED_BASE_URL}/uploads/seed-seaside-aktau.jpg`],
    ["Airport Express Room","Shymkent",  85.0, 2, ["Wi-Fi", "Shuttle", "Breakfast"],           "Standard", `${SEED_BASE_URL}/uploads/seed-airport-express-shymkent.jpg`],
  ];
}

async function ensureCategoriesSeed(appClient) {
  const categories = categorySeedData();

  // Clear existing categories to ensure clean state
  await appClient.query(`DELETE FROM categories`);

  for (const categoryName of categories) {
    await appClient.query(
      `INSERT INTO categories (name) VALUES ($1)`,
      [categoryName]
    );
  }
}

async function ensureRoomsSeed(appClient) {
  await appClient.query(`
    DELETE FROM rooms
    WHERE name IS NULL
       OR city IS NULL
       OR price_per_night IS NULL
       OR max_guests IS NULL
       OR price_per_night <= 0
       OR max_guests <= 0;
  `);

  await appClient.query(`
    WITH duplicates AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY LOWER(name), LOWER(city) ORDER BY id) AS rn
      FROM rooms
    )
    DELETE FROM rooms
    WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
  `);

  await appClient.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'rooms_name_city_unique'
      ) THEN
        ALTER TABLE rooms ADD CONSTRAINT rooms_name_city_unique UNIQUE (name, city);
      END IF;
    END$$;
  `);

  await appClient.query(`
    ALTER TABLE rooms
      ALTER COLUMN name SET NOT NULL,
      ALTER COLUMN city SET NOT NULL,
      ALTER COLUMN price_per_night SET NOT NULL,
      ALTER COLUMN max_guests SET NOT NULL,
      ALTER COLUMN category_id SET NOT NULL;
  `);

  await appClient.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rooms_price_positive_check'
      ) THEN
        ALTER TABLE rooms ADD CONSTRAINT rooms_price_positive_check CHECK (price_per_night > 0);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rooms_guests_positive_check'
      ) THEN
        ALTER TABLE rooms ADD CONSTRAINT rooms_guests_positive_check CHECK (max_guests > 0);
      END IF;
    END$$;
  `);

  const seeds = roomSeedData();

  for (const [name, city, price, guests, amenities, categoryName, imageUrl] of seeds) {
    const categoryResult = await appClient.query(
      `SELECT id FROM categories WHERE name = $1`,
      [categoryName]
    );

    if (categoryResult.rows.length === 0) {
      console.warn(`Category "${categoryName}" not found for room "${name}"`);
      continue;
    }

    const categoryId = categoryResult.rows[0].id;

    await appClient.query(
      `INSERT INTO rooms (name, city, price_per_night, max_guests, amenities, category_id, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (name, city) DO UPDATE SET
         price_per_night = EXCLUDED.price_per_night,
         max_guests = EXCLUDED.max_guests,
         amenities = EXCLUDED.amenities,
         category_id = EXCLUDED.category_id,
         image_url = EXCLUDED.image_url;
      `,
      [name, city, price, guests, amenities, categoryId, imageUrl || null]
    );
  }
}

async function migrate() {
  let appPool;
  const client = await bootstrapPool.connect();

  try {
    console.log("Starting migration...");

    const dbName = process.env.DB_NAME || "hotel_booking";
    const dbExists = await client.query(`SELECT FROM pg_database WHERE datname = $1`, [dbName]);

    if (dbExists.rows.length === 0) {
      console.log(`Creating database ${dbName}...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database ${dbName} created successfully`);
    }

    client.release();

    appPool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      database: dbName,
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
    });

    const appClient = await appPool.connect();

    try {
      console.log("Creating tables...");

      await appClient.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_salt VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'guest',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await appClient.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await appClient.query(`
        CREATE TABLE IF NOT EXISTS rooms (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          city VARCHAR(255),
          price_per_night DECIMAL(10, 2),
          max_guests INTEGER,
          amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
          category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
          image_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await appClient.query(`
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS image_url TEXT;
      `);

      // Ensure bookings.room_id FK has ON DELETE CASCADE (fix for older DBs)
      await appClient.query(`
        DO $$
        DECLARE
          v_confdeltype char;
        BEGIN
          SELECT confdeltype INTO v_confdeltype
          FROM pg_constraint
          WHERE conname = 'bookings_room_id_fkey';

          IF FOUND AND v_confdeltype <> 'c' THEN
            ALTER TABLE bookings DROP CONSTRAINT bookings_room_id_fkey;
            ALTER TABLE bookings ADD CONSTRAINT bookings_room_id_fkey
              FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
          END IF;
        END$$;
      `);

      await appClient.query(`
        DELETE FROM rooms;
      `);

      await appClient.query(`
        CREATE INDEX IF NOT EXISTS idx_rooms_category_id ON rooms(category_id);
      `);

      await appClient.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          guests INTEGER NOT NULL,
          check_in DATE NOT NULL,
          check_out DATE NOT NULL,
          nights INTEGER NOT NULL,
          total_price DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await appClient.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          token VARCHAR(255) PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL
        )
      `);

      await appClient.query(`
        CREATE TABLE IF NOT EXISTS user_favorites (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, room_id)
        )
      `);

      await appClient.query(`
        CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_favorites_room_id ON user_favorites(room_id);
      `);

      await appClient.query(`
        CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
        CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      `);

      const adminPassword = hashPassword("12345admin");
      const guestPassword = hashPassword("12345guest");

      await appClient.query(
        `
          INSERT INTO users (name, email, password_salt, password_hash, role)
          VALUES
            ($1, $2, $3, $4, $5),
            ($6, $7, $8, $9, $10)
          ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            password_salt = EXCLUDED.password_salt,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role;
        `,
        [
          "Admin User",
          "admin@hotel.com",
          adminPassword.salt,
          adminPassword.hash,
          "admin",
          "Guest User",
          "guest@hotel.com",
          guestPassword.salt,
          guestPassword.hash,
          "guest",
        ]
      );

      await ensureCategoriesSeed(appClient);
      await ensureRoomsSeed(appClient);

      console.log("Migration completed successfully");
    } finally {
      appClient.release();
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await bootstrapPool.end();
    if (appPool) {
      await appPool.end();
    }
  }
}

migrate();
