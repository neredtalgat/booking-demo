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

function roomSeedData() {
  return [
    ["Deluxe City View", "Almaty", 120.0, 2, ["Wi-Fi", "Breakfast", "Air conditioning"]],
    ["Family Suite", "Astana", 180.0, 4, ["Wi-Fi", "Breakfast", "Kitchen", "Parking"]],
    ["Business Room", "Shymkent", 90.0, 2, ["Wi-Fi", "Desk", "Airport shuttle"]],
    ["Lake View Studio", "Borovoe", 140.0, 2, ["Wi-Fi", "Balcony", "Breakfast"]],
    ["City Center Loft", "Almaty", 160.0, 3, ["Wi-Fi", "Kitchen", "Washer"]],
    ["Budget Twin", "Karaganda", 65.0, 2, ["Wi-Fi", "Heating"]],
    ["Royal Suite", "Astana", 260.0, 4, ["Wi-Fi", "Spa", "Breakfast", "Parking"]],
    ["Mountain Cabin", "Almaty", 200.0, 5, ["Fireplace", "Kitchen", "Parking"]],
    ["Airport Express Room", "Shymkent", 85.0, 2, ["Wi-Fi", "Shuttle", "Breakfast"]],
    ["Seaside Apartment", "Aktau", 170.0, 4, ["Wi-Fi", "Kitchen", "Sea view"]],
  ];
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
      ALTER COLUMN max_guests SET NOT NULL;
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
  const placeholders = seeds
    .map((_, idx) => {
      const start = idx * 5;
      return `($${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5})`;
    })
    .join(",\n");

  const values = seeds.flatMap((item) => item);

  await appClient.query(
    `
      INSERT INTO rooms (name, city, price_per_night, max_guests, amenities)
      VALUES ${placeholders}
      ON CONFLICT (name, city) DO UPDATE SET
        price_per_night = EXCLUDED.price_per_night,
        max_guests = EXCLUDED.max_guests,
        amenities = EXCLUDED.amenities;
    `,
    values
  );
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
        CREATE TABLE IF NOT EXISTS rooms (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          city VARCHAR(255),
          price_per_night DECIMAL(10, 2),
          max_guests INTEGER,
          amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
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
