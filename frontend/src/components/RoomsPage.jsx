import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getRooms, getCategories } from "../api/client";
import { addToast } from "../store/uiSlice";

export default function RoomsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState({ city: "", guests: "", checkIn: "", checkOut: "", categoryId: "" });
  const [status, setStatus] = useState("");

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    };
    loadCategories();
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
      <h1>Find a room</h1>

      <form className="card search-grid" onSubmit={handleSearch}>
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

        <button type="submit">Search</button>
      </form>

      {status && <p className="status">{status}</p>}
      {loading && <p className="muted">Loading rooms...</p>}

      <div className="room-grid">
        {rooms.map((room) => (
          <article className="card room-card" key={room.id}>
            <h3>{room.name}</h3>
            <p><strong>{room.categoryName}</strong> | {room.city}</p>
            <p>${room.pricePerNight} / night</p>
            <p>Guests up to {room.maxGuests}</p>
            <p className="muted">{room.amenities.join(", ")}</p>
            <div className="inline-actions">
              <button type="button" onClick={() => navigate(`/rooms/${room.id}`)}>
                Reserve
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
