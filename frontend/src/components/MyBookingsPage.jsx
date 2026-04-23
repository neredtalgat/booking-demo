import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  deleteBooking,
  getBookingById,
  getMyBookings,
  updateBooking
} from "../api/client";
import { addToast } from "../store/uiSlice";
import ConfirmModal from "./ConfirmModal";

export default function MyBookingsPage() {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ checkIn: "", checkOut: "", guests: "" });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getMyBookings(token);
      setBookings(data);
      dispatch(addToast(`Bookings loaded: ${data.length}`, "info"));
    } catch (err) {
      setError(err.message);
      dispatch(addToast(err.message, "error"));
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
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: String(booking.guests)
    });
  };

  const saveEdit = async (id) => {
    setError("");
    try {
      await updateBooking(token, id, {
        checkIn: editForm.checkIn,
        checkOut: editForm.checkOut,
        guests: Number(editForm.guests)
      });
      dispatch(addToast(`Booking #${id} updated`, "success"));
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
      dispatch(addToast(err.message, "error"));
    }
  };

  const removeBooking = async () => {
    if (!pendingDelete) {
      return;
    }

    setError("");
    setDeleteBusy(true);
    try {
      await deleteBooking(token, pendingDelete.id);
      dispatch(addToast(`Booking #${pendingDelete.id} deleted`, "success"));
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err.message);
      dispatch(addToast(err.message, "error"));
    } finally {
      setDeleteBusy(false);
    }
  };

  const showOne = async (id) => {
    setError("");
    try {
      const data = await getBookingById(token, id);
      setDetail(data);
      dispatch(addToast(`Opened booking #${id}`, "success"));
    } catch (err) {
      setError(err.message);
      dispatch(addToast(err.message, "error"));
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
                  <button type="button" onClick={() => setPendingDelete(booking)}>Delete</button>
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

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={`Delete booking #${pendingDelete?.id || ""}`}
        description="This action cannot be undone. Do you want to continue?"
        busy={deleteBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={removeBooking}
      />
    </section>
  );
}
