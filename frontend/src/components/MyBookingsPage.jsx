import { useEffect, useState } from "react";
import {
  deleteBooking,
  getBookingById,
  getMyBookings,
  updateBooking
} from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function MyBookingsPage() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ roomId: "", checkIn: "", checkOut: "", guests: "" });

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

  useEffect(() => {
    load();
  }, [token]);

  const startEdit = (booking) => {
    setEditingId(booking.id);
    setEditForm({
      roomId: String(booking.roomId),
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: String(booking.guests)
    });
  };

  const saveEdit = async (id) => {
    setError("");
    try {
      await updateBooking(token, id, {
        roomId: Number(editForm.roomId),
        checkIn: editForm.checkIn,
        checkOut: editForm.checkOut,
        guests: Number(editForm.guests)
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeBooking = async (id) => {
    setError("");
    try {
      await deleteBooking(token, id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const showOne = async (id) => {
    setError("");
    try {
      const data = await getBookingById(token, id);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    }
  };

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
            {editingId === booking.id ? (
              <div className="form-stack compact">
                <label>Room ID</label>
                <input value={editForm.roomId} onChange={(e) => setEditForm((p) => ({ ...p, roomId: e.target.value }))} />
                <label>Check-in</label>
                <input type="date" value={editForm.checkIn} onChange={(e) => setEditForm((p) => ({ ...p, checkIn: e.target.value }))} />
                <label>Check-out</label>
                <input type="date" value={editForm.checkOut} onChange={(e) => setEditForm((p) => ({ ...p, checkOut: e.target.value }))} />
                <label>Guests</label>
                <input type="number" min="1" value={editForm.guests} onChange={(e) => setEditForm((p) => ({ ...p, guests: e.target.value }))} />
                <div className="inline-actions">
                  <button type="button" onClick={() => saveEdit(booking.id)}>Save</button>
                  <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p>
                  {booking.checkIn} - {booking.checkOut}
                </p>
                <p>Guests: {booking.guests}</p>
                <p>Total: ${booking.totalPrice}</p>
                <div className="inline-actions">
                  <button type="button" onClick={() => startEdit(booking)}>Edit</button>
                  <button type="button" onClick={() => removeBooking(booking.id)}>Delete</button>
                  <button type="button" onClick={() => showOne(booking.id)}>View by id</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>

      {detail && (
        <section className="card modal">
          <div className="modal-head">
            <h3>Booking #{detail.id}</h3>
            <button type="button" onClick={() => setDetail(null)}>Close</button>
          </div>
          <p>Room ID: {detail.roomId}</p>
          <p>Dates: {detail.checkIn} - {detail.checkOut}</p>
          <p>Guests: {detail.guests}</p>
          <p>Total: ${detail.totalPrice}</p>
        </section>
      )}
    </section>
  );
}
