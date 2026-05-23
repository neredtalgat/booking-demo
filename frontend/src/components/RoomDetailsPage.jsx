import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { createBooking, getRoomById, getFavorites, addFavorite, removeFavorite } from "../api/client";
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
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const loadRoom = async () => {
      setLoading(true);
      setStatus("");
      try {
        const [data, favs] = await Promise.all([
          getRoomById(id),
          getFavorites(token).catch(() => []),
        ]);
        setRoom(data);
        setIsFavorite(favs.some((r) => r.id === Number(id)));
      } catch (err) {
        setStatus(err.message);
        dispatch(addToast(err.message, "error"));
      } finally {
        setLoading(false);
      }
    };

    loadRoom();
  }, [dispatch, id, token]);

  const handleToggleFavorite = async () => {
    try {
      if (isFavorite) {
        await removeFavorite(token, id);
        setIsFavorite(false);
        dispatch(addToast("Removed from favorites", "info"));
      } else {
        await addFavorite(token, id);
        setIsFavorite(true);
        dispatch(addToast("Added to favorites", "success"));
      }
    } catch (err) {
      dispatch(addToast(err.message, "error"));
    }
  };

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
        {room.imageUrl
          ? <img className="room-details-image" src={room.imageUrl} alt={room.name} />
          : <div className="room-details-image room-details-image--placeholder" />
        }
        <div className="room-details-body">
          <div className="room-details-header">
            <div>
              <span className="room-card__category">{room.categoryName}</span>
              <h1>{room.name}</h1>
              <p className="muted">{room.city}</p>
            </div>
            <button
              type="button"
              className={`btn-favorite btn-favorite--lg${isFavorite ? " btn-favorite--active" : ""}`}
              onClick={handleToggleFavorite}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              {isFavorite ? "♥" : "♡"}
            </button>
          </div>
          <p className="room-price room-price--lg">
            ${room.pricePerNight}<span className="per-night"> / night</span>
          </p>
          <p className="muted">Up to {room.maxGuests} guests &middot; {room.amenities.join(", ")}</p>
        </div>
      </article>

      <article className="card room-details-booking">
        <BookingForm room={room} busy={busyBooking} onSubmit={handleBook} />
      </article>

      {status && <p className="status">{status}</p>}
    </section>
  );
}
