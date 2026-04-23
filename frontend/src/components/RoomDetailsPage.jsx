import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { createBooking, getRoomById } from "../api/client";
import BookingForm from "./BookingForm";
import { addToast } from "../store/uiSlice";

export default function RoomDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyBooking, setBusyBooking] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const loadRoom = async () => {
      setLoading(true);
      setStatus("");
      try {
        const data = await getRoomById(id);
        setRoom(data);
      } catch (err) {
        setStatus(err.message);
        dispatch(addToast(err.message, "error"));
      } finally {
        setLoading(false);
      }
    };

    loadRoom();
  }, [dispatch, id]);

  const handleBook = async (payload) => {
    setBusyBooking(true);
    setStatus("");
    try {
      await createBooking(token, payload);
      setStatus("Booking created successfully.");
      dispatch(addToast("Booking created successfully", "success"));
      navigate("/bookings");
    } catch (err) {
      setStatus(err.message);
      dispatch(addToast(err.message, "error"));
      throw err;
    } finally {
      setBusyBooking(false);
    }
  };

  if (loading) {
    return <p className="muted">Loading room...</p>;
  }

  if (!room) {
    return (
      <section className="room-details-page">
        <button className="btn-secondary" type="button" onClick={() => navigate("/rooms")}>
          Back to rooms
        </button>
        {status && <p className="error">{status}</p>}
      </section>
    );
  }

  return (
    <section className="room-details-page">
      <button className="btn-secondary" type="button" onClick={() => navigate("/rooms")}>
        Back to rooms
      </button>

      <article className="card room-details-card">
        <h1>{room.name}</h1>
        <p>{room.city}</p>
        <p>${room.pricePerNight} / night</p>
        <p>Guests up to {room.maxGuests}</p>
        <p className="muted">{room.amenities.join(", ")}</p>
      </article>

      <article className="card room-details-booking">
        <BookingForm room={room} busy={busyBooking} onSubmit={handleBook} />
      </article>

      {status && <p className="status">{status}</p>}
    </section>
  );
}
