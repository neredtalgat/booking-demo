import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getRooms, getCategories, getFavorites, addFavorite, removeFavorite } from "../api/client";
import { addToast } from "../store/uiSlice";

export default function RoomsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector((state) => state.auth.token);
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState({ city: "", guests: "", checkIn: "", checkOut: "", categoryId: "" });
  const [status, setStatus] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    };
    const loadFavorites = async () => {
      try {
        const data = await getFavorites(token);
        setFavoriteIds(new Set(data.map((r) => r.id)));
      } catch {
        // non-critical
      }
    };
    loadCategories();
    loadFavorites();
    loadRooms({});
  }, []);

  const loadRooms = async (params) => {
    setLoading(true);
    setStatus("");
    try {
      const data = await getRooms(params);
      setRooms(data);
      if (!data.length) {
        setStatus("No rooms available for the selected filters.");
      }
      dispatch(addToast(`Rooms loaded: ${data.length}`, "info"));
    } catch (err) {
      setStatus(err.message);
      dispatch(addToast(err.message, "error"));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (room) => {
    const isFav = favoriteIds.has(room.id);
    try {
      if (isFav) {
        await removeFavorite(token, room.id);
        setFavoriteIds((prev) => { const next = new Set(prev); next.delete(room.id); return next; });
        dispatch(addToast("Removed from favorites", "info"));
      } else {
        await addFavorite(token, room.id);
        setFavoriteIds((prev) => new Set(prev).add(room.id));
        dispatch(addToast("Added to favorites", "success"));
      }
    } catch (err) {
      dispatch(addToast(err.message, "error"));
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const params = {};
    if (search.city) params.city = search.city;
    if (search.guests) params.guests = search.guests;
    if (search.checkIn) params.checkIn = search.checkIn;
    if (search.checkOut) params.checkOut = search.checkOut;
    if (search.categoryId) params.categoryId = search.categoryId;
    loadRooms(params);
  };

  return (
    <section className="rooms-page">
      <div className="rooms-hero">
        <h1 className="rooms-hero__title">Find your perfect room</h1>
        <p className="rooms-hero__sub">Explore hotels across Kazakhstan — from city stays to mountain retreats</p>

        <form className="search-glass search-grid" onSubmit={handleSearch}>
          <div className="form-stack compact">
            <label>City</label>
            <input value={search.city} onChange={(e) => setSearch((prev) => ({ ...prev, city: e.target.value }))} placeholder="Almaty" />
          </div>

          <div className="form-stack compact">
            <label>Guests</label>
            <input
              type="number"
              min="1"
              value={search.guests}
              onChange={(e) => setSearch((prev) => ({ ...prev, guests: e.target.value }))}
              placeholder="2"
            />
          </div>

          <div className="form-stack compact">
            <label>Category</label>
            <select
              value={search.categoryId}
              onChange={(e) => setSearch((prev) => ({ ...prev, categoryId: e.target.value }))}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="form-stack compact">
            <label>Check-in</label>
            <input type="date" value={search.checkIn} onChange={(e) => setSearch((prev) => ({ ...prev, checkIn: e.target.value }))} />
          </div>

          <div className="form-stack compact">
            <label>Check-out</label>
            <input type="date" value={search.checkOut} onChange={(e) => setSearch((prev) => ({ ...prev, checkOut: e.target.value }))} />
          </div>

          <button type="submit" className="btn-cta">Search</button>
        </form>
      </div>

      {status && <p className="status">{status}</p>}
      {loading && <p className="muted">Loading rooms...</p>}

      <div className="room-grid">
        {rooms.map((room) => (
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
              <p className="muted">Up to {room.maxGuests} guests &middot; {room.amenities.slice(0, 3).join(", ")}{room.amenities.length > 3 ? "…" : ""}</p>
              <div className="inline-actions">
                <button type="button" className="btn-cta" onClick={() => navigate(`/rooms/${room.id}`)}>
                  Reserve
                </button>
                <button
                  type="button"
                  className={`btn-favorite${favoriteIds.has(room.id) ? " btn-favorite--active" : ""}`}
                  onClick={() => handleToggleFavorite(room)}
                  title={favoriteIds.has(room.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  {favoriteIds.has(room.id) ? "♥" : "♡"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
