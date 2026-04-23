import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "hotel_booking",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
});

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

async function seedRooms() {
  const client = await pool.connect();
  try {
    const seeds = roomSeedData();
    const placeholders = seeds
      .map((_, idx) => {
        const start = idx * 5;
        return `($${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5})`;
      })
      .join(",\n");

    const values = seeds.flatMap((item) => item);

    await client.query(`
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

    await client.query(
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

    console.log(`Seeded/updated ${seeds.length} rooms`);
  } finally {
    client.release();
    await pool.end();
  }
}

seedRooms().catch((error) => {
  console.error("Seed rooms failed:", error);
  process.exit(1);
});
