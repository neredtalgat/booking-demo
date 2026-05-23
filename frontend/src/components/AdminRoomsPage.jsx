import { useEffect, useRef, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createRoom,
  deleteRoom,
  getRoomById,
  getRooms,
  updateRoom,
  getCategories,
  BASE_URL,
} from "../api/client";
import { addToast } from "../store/uiSlice";
import ConfirmModal from "./ConfirmModal";

const initialForm = {
  name: "",
  city: "",
  pricePerNight: "",
  maxGuests: "",
  amenities: "Wi-Fi",
  categoryId: "",
  imageUrl: "",
};

export default function AdminRoomsPage() {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const fileInputRef = useRef(null);
  const formRef = useRef(null);

  const loadRooms = useCallback(async () => {
    try {
      const data = await getRooms({});
      setRooms(data);
    } catch (err) {
      dispatch(addToast(err.message, "error"));
    }
  }, [dispatch]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
        if (data.length > 0 && !form.categoryId) {
          setForm((prev) => ({ ...prev, categoryId: String(data[0].id) }));
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    };

    loadCategories();
    loadRooms();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...initialForm, categoryId: categories.length > 0 ? String(categories[0].id) : "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    if (!form.categoryId) {
      setStatus("Category is required");
      dispatch(addToast("Category is required", "error"));
      return;
    }

    const payload = {
      name: form.name,
      city: form.city,
      pricePerNight: Number(form.pricePerNight),
      maxGuests: Number(form.maxGuests),
      amenities: form.amenities,
      categoryId: Number(form.categoryId),
      imageUrl: form.imageUrl || null,
    };

    setFormBusy(true);
    try {
      if (editingId) {
        await updateRoom(token, editingId, payload);
        setStatus("Room updated.");
        dispatch(addToast(`Room #${editingId} updated`, "success"));
      } else {
        await createRoom(token, payload);
        setStatus("Room created.");
        dispatch(addToast("Room created", "success"));
      }

      resetForm();
      await loadRooms();
    } catch (err) {
      setStatus(err.message);
      dispatch(addToast(err.message, "error"));
    } finally {
      setFormBusy(false);
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
        amenities: room.amenities.join(", "),
        categoryId: String(room.categoryId),
        imageUrl: room.imageUrl || "",
      });
      dispatch(addToast(`Editing: ${room.name}`, "info"));
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setStatus(err.message);
      dispatch(addToast(err.message, "error"));
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadBusy(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`${BASE_URL}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setForm((p) => ({ ...p, imageUrl: data.url }));
      dispatch(addToast("Photo uploaded", "success"));
    } catch (err) {
      dispatch(addToast(err.message, "error"));
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setStatus("");
    setDeleteBusy(true);
    try {
      await deleteRoom(token, pendingDelete.id);
      setStatus(`Room #${pendingDelete.id} deleted.`);
      dispatch(addToast(`Room #${pendingDelete.id} deleted`, "success"));
      setPendingDelete(null);
      await loadRooms();
    } catch (err) {
      setStatus(err.message);
      dispatch(addToast(err.message, "error"));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section>
      <h1>Manage rooms (admin)</h1>
      <form ref={formRef} className="card form-stack" onSubmit={handleSubmit}>
        <label htmlFor="room-name">Name</label>
        <input id="room-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />

        <label htmlFor="room-city">City</label>
        <input id="room-city" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required />

        <label htmlFor="room-price">Price per night</label>
        <input id="room-price" type="number" min="1" value={form.pricePerNight} onChange={(e) => setForm((p) => ({ ...p, pricePerNight: e.target.value }))} required />

        <label htmlFor="room-guests">Max guests</label>
        <input id="room-guests" type="number" min="1" value={form.maxGuests} onChange={(e) => setForm((p) => ({ ...p, maxGuests: e.target.value }))} required />

        <label htmlFor="room-category">Category</label>
        <select id="room-category" value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))} required>
          <option value="">Select a category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <label htmlFor="room-amenities">Amenities (comma separated)</label>
        <input id="room-amenities" value={form.amenities} onChange={(e) => setForm((p) => ({ ...p, amenities: e.target.value }))} required />

        <span className="form-field-label">Photo</span>
        {form.imageUrl && (
          <div className="upload-preview">
            <img src={form.imageUrl} alt="Preview" className="upload-preview__img" />
            <button
              type="button"
              className="upload-preview__remove"
              onClick={() => setForm((p) => ({ ...p, imageUrl: "" }))}
              title="Remove photo"
            >
              ✕
            </button>
          </div>
        )}
        <label className={`upload-zone${uploadBusy ? " upload-zone--busy" : ""}`}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageUpload}
            disabled={uploadBusy}
          />
          <span className="upload-zone__icon">↑</span>
          <span>{uploadBusy ? "Uploading…" : form.imageUrl ? "Replace photo" : "Choose photo"}</span>
          <span className="upload-zone__hint">JPG, PNG, WebP · max 5 MB</span>
        </label>

        <div className="inline-actions">
          <button type="submit" disabled={formBusy || uploadBusy}>
            {formBusy ? "Saving…" : editingId ? "Update room" : "Create room"}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm} disabled={formBusy}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {status && <p className="status">{status}</p>}

      <div className="booking-list">
        {rooms.map((room) => (
          <article key={room.id} className="card admin-room-card">
            {room.imageUrl && (
              <img className="admin-room-card__image" src={room.imageUrl} alt={room.name} loading="lazy" />
            )}
            <div className="admin-room-card__body">
              <div className="room-card__meta">
                <span className="room-card__category">{room.categoryName}</span>
                <span className="room-card__city">{room.city}</span>
              </div>
              <h3>{room.name}</h3>
              <p className="room-price">${room.pricePerNight}<span className="per-night"> / night</span></p>
              <p className="muted">Up to {room.maxGuests} guests &middot; {room.amenities.join(", ")}</p>
              <div className="inline-actions">
                <button type="button" onClick={() => handleEdit(room.id)}>Edit</button>
                <button type="button" className="btn-danger" onClick={() => setPendingDelete(room)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={`Delete room #${pendingDelete?.id || ""}`}
        description="Deleting room will also remove related bookings. Continue?"
        busy={deleteBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
