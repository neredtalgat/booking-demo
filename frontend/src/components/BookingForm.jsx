import { useMemo, useState } from "react";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function BookingForm({ room, onSubmit, busy }) {
  const [checkIn, setCheckIn] = useState(todayISO());
  const [checkOut, setCheckOut] = useState(tomorrowISO());
  const [guests, setGuests] = useState(1);
  const [error, setError] = useState("");

  const totalNights = useMemo(() => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const ms = end.getTime() - start.getTime();
    return ms > 0 ? Math.ceil(ms / 86400000) : 0;
  }, [checkIn, checkOut]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (new Date(checkOut) <= new Date(checkIn)) {
      setError("Check-out must be later than check-in");
      return;
    }

    try {
      await onSubmit({ roomId: room.id, checkIn, checkOut, guests: Number(guests) });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <h4>Book this room</h4>
      <label>Check-in</label>
      <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} required />

      <label>Check-out</label>
      <input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} required />

      <label>Guests (max {room.maxGuests})</label>
      <input
        type="number"
        min="1"
        max={room.maxGuests}
        value={guests}
        onChange={(event) => setGuests(event.target.value)}
        required
      />

      <p className="muted">
        {totalNights > 0 ? `${totalNights} night(s), total $${totalNights * room.pricePerNight}` : "Choose valid dates"}
      </p>
      {error && <p className="error">{error}</p>}
      <button disabled={busy} type="submit">
        {busy ? "Booking..." : "Confirm booking"}
      </button>
    </form>
  );
}
