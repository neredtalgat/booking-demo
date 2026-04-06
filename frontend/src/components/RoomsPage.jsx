import { useEffect, useState } from "react";
import { createBooking, getRoomById, getRooms } from "../api/client";
import { useAuth } from "../context/AuthContext";
import BookingForm from "./BookingForm";

export default function RoomsPage() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState({ city: "", guests: "", checkIn: "", checkOut: "" });
  const [activeRoom, setActiveRoom] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [busyBooking, setBusyBooking] = useState(false);
  const [status, setStatus] = useState("");

  const loadRooms = async (params) => {
    setLoading(true);
    setStatus("");
    try {
      const data = await getRooms(params);
      setRooms(data);
      if (!data.length) {
        setStatus("No rooms available for the selected filters.");
      }
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms({});
  }, []);

  const handleSearch = (event) => {
    event.preventDefault();
    loadRooms(search);
  };

  const handleBook = async (payload) => {
    setBusyBooking(true);
    setStatus("");
    try {
      await createBooking(token, payload);
      setStatus("Booking created successfully.");
      setActiveRoom(null);
      await loadRooms(search);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusyBooking(false);
    }
  };

  const handleView = async (id) => {
    setStatus("");
    try {
      const room = await getRoomById(id);
      setSelectedRoom(room);
    } catch (err) {
      setStatus(err.message);
    }
  };

  return (
    <section className="rooms-page">
      <h1>Find a room</h1>

      <form className="card search-grid" onSubmit={handleSearch}>
        <label>City</label>
        <input value={search.city} onChange={(e) => setSearch((prev) => ({ ...prev, city: e.target.value }))} placeholder="Almaty" />

        <label>Guests</label>
        <input
          type="number"
          min="1"
          value={search.guests}
          onChange={(e) => setSearch((prev) => ({ ...prev, guests: e.target.value }))}
          placeholder="2"
        />

        <label>Check-in</label>
        <input type="date" value={search.checkIn} onChange={(e) => setSearch((prev) => ({ ...prev, checkIn: e.target.value }))} />

        <label>Check-out</label>
        <input type="date" value={search.checkOut} onChange={(e) => setSearch((prev) => ({ ...prev, checkOut: e.target.value }))} />

        <button type="submit">Search</button>
      </form>

      {status && <p className="status">{status}</p>}
      {loading && <p className="muted">Loading rooms...</p>}

      <div className="room-grid">
        {rooms.map((room) => (
          <article className="card room-card" key={room.id}>
            <h3>{room.name}</h3>
            <p>{room.city}</p>
            <p>${room.pricePerNight} / night</p>
            <p>Guests up to {room.maxGuests}</p>
            <p className="muted">{room.amenities.join(", ")}</p>
            <div className="inline-actions">
              <button type="button" onClick={() => setActiveRoom(room)}>
                Book room
              </button>
              <button type="button" onClick={() => handleView(room.id)}>
                View details
              </button>
            </div>
          </article>
        ))}
      </div>

      {selectedRoom && (
        <section className="card modal">
          <div className="modal-head">
            <h3>Room #{selectedRoom.id}</h3>
            <button type="button" onClick={() => setSelectedRoom(null)}>Close</button>
          </div>
          <p>Name: {selectedRoom.name}</p>
          <p>City: {selectedRoom.city}</p>
          <p>Price: ${selectedRoom.pricePerNight}</p>
          <p>Max guests: {selectedRoom.maxGuests}</p>
          <p className="muted">{selectedRoom.amenities.join(", ")}</p>
        </section>
      )}

      {activeRoom && (
        <section className="card modal">
          <div className="modal-head">
            <h3>{activeRoom.name}</h3>
            <button type="button" onClick={() => setActiveRoom(null)}>Close</button>
          </div>
          <BookingForm room={activeRoom} busy={busyBooking} onSubmit={handleBook} />
        </section>
      )}
    </section>
  );
}
