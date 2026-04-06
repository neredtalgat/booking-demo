import { useEffect, useState } from "react";
import { getMyBookings } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function MyBookingsPage() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getMyBookings(token);
        setBookings(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  return (
    <section>
      <h1>My bookings</h1>
      {loading && <p className="muted">Loading bookings...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !bookings.length && <p className="muted">No bookings yet.</p>}

      <div className="booking-list">
        {bookings.map((booking) => (
          <article className="card" key={booking.id}>
            <h3>{booking.room?.name || `Room #${booking.roomId}`}</h3>
            <p>{booking.room?.city}</p>
            <p>
              {booking.checkIn} - {booking.checkOut}
            </p>
            <p>Guests: {booking.guests}</p>
            <p>Total: ${booking.totalPrice}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
