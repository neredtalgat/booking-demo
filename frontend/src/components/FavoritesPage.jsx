import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getFavorites, removeFavorite } from "../api/client";
import { addToast } from "../store/uiSlice";

export default function FavoritesPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector((state) => state.auth.token);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getFavorites(token);
        setFavorites(data);
      } catch (err) {
        dispatch(addToast(err.message, "error"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, dispatch]);

  const handleRemove = async (roomId) => {
    try {
      await removeFavorite(token, roomId);
      setFavorites((prev) => prev.filter((r) => r.id !== roomId));
      dispatch(addToast("Removed from favorites", "info"));
    } catch (err) {
      dispatch(addToast(err.message, "error"));
    }
  };

  return (
    <section className="rooms-page">
      <h1>My Favorites</h1>

      {loading && <p className="muted">Loading...</p>}

      {!loading && favorites.length === 0 && (
        <p className="muted">No favorites yet. Browse rooms and add some!</p>
      )}

      <div className="room-grid">
        {favorites.map((room) => (
          <article className="card room-card" key={room.id}>
            {room.imageUrl
              ? <img className="room-card__image" src={room.imageUrl} alt={room.name} loading="lazy" />
              : <div className="room-card__image-placeholder" />
            }
            <div className="room-card__body">
              <div className="room-card__meta">
                <span className="room-card__category">{room.categoryName}</span>
                <span className="room-card__city">{room.city}</span>
              </div>
              <h3>{room.name}</h3>
              <p className="room-price">
                ${room.pricePerNight}<span className="per-night"> / night</span>
              </p>
              <p className="muted">Up to {room.maxGuests} guests &middot; {room.amenities.slice(0, 3).join(", ")}</p>
              <div className="inline-actions">
                <button type="button" className="btn-cta" onClick={() => navigate(`/rooms/${room.id}`)}>
                  Reserve
                </button>
                <button
                  type="button"
                  className="btn-favorite btn-favorite--active"
                  onClick={() => handleRemove(room.id)}
                  title="Remove from favorites"
                >
                  ♥
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
