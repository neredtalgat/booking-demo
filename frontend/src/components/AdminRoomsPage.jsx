import { useEffect, useState } from "react";
import {
  createRoom,
  deleteRoom,
  getRoomById,
  getRooms,
  updateRoom
} from "../api/client";
import { useAuth } from "../context/AuthContext";

const initialForm = {
  name: "",
  city: "",
  pricePerNight: "",
  maxGuests: "",
  amenities: "Wi-Fi"
};

export default function AdminRoomsPage() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState("");

  const loadRooms = async () => {
    const data = await getRooms({});
    setRooms(data);
  };

  useEffect(() => {
    loadRooms().catch((err) => setStatus(err.message));
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    const payload = {
      name: form.name,
      city: form.city,
      pricePerNight: Number(form.pricePerNight),
      maxGuests: Number(form.maxGuests),
      amenities: form.amenities
    };

    try {
      if (editingId) {
        await updateRoom(token, editingId, payload);
        setStatus("Room updated.");
      } else {
        await createRoom(token, payload);
        setStatus("Room created.");
      }

      resetForm();
      await loadRooms();
    } catch (err) {
      setStatus(err.message);
    }
  };

  const handleEdit = async (id) => {
    setStatus("");
    try {
      const room = await getRoomById(id);
      setEditingId(room.id);
      setForm({
        name: room.name,
        city: room.city,
        pricePerNight: String(room.pricePerNight),
        maxGuests: String(room.maxGuests),
        amenities: room.amenities.join(", ")
      });
    } catch (err) {
      setStatus(err.message);
    }
  };

  const handleDelete = async (id) => {
    setStatus("");
    try {
      await deleteRoom(token, id);
      setStatus(`Room #${id} deleted.`);
      await loadRooms();
    } catch (err) {
      setStatus(err.message);
    }
  };

  return (
    <section>
      <h1>Manage rooms (admin)</h1>
      <form className="card form-stack" onSubmit={handleSubmit}>
        <label>Name</label>
        <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />

        <label>City</label>
        <input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required />

        <label>Price per night</label>
        <input type="number" min="1" value={form.pricePerNight} onChange={(e) => setForm((p) => ({ ...p, pricePerNight: e.target.value }))} required />

        <label>Max guests</label>
        <input type="number" min="1" value={form.maxGuests} onChange={(e) => setForm((p) => ({ ...p, maxGuests: e.target.value }))} required />

        <label>Amenities (comma separated)</label>
        <input value={form.amenities} onChange={(e) => setForm((p) => ({ ...p, amenities: e.target.value }))} required />

        <div className="inline-actions">
          <button type="submit">{editingId ? "Update room" : "Create room"}</button>
          {editingId && (
            <button type="button" onClick={resetForm}>Cancel edit</button>
          )}
        </div>
      </form>

      {status && <p className="status">{status}</p>}

      <div className="booking-list">
        {rooms.map((room) => (
          <article key={room.id} className="card">
            <h3>{room.name}</h3>
            <p>{room.city} | ${room.pricePerNight} / night</p>
            <p>Guests: up to {room.maxGuests}</p>
            <p className="muted">{room.amenities.join(", ")}</p>
            <div className="inline-actions">
              <button type="button" onClick={() => handleEdit(room.id)}>Edit</button>
              <button type="button" onClick={() => handleDelete(room.id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
