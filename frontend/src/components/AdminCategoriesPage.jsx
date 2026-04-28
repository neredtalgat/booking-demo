import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from "../api/client";
import { addToast } from "../store/uiSlice";
import ConfirmModal from "./ConfirmModal";

const initialForm = {
  name: ""
};

export default function AdminCategoriesPage() {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      setStatus(err.message);
      dispatch(addToast(err.message, "error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    const name = form.name.trim();
    if (!name) {
      setStatus("Category name is required");
      dispatch(addToast("Category name is required", "error"));
      return;
    }

    try {
      if (editingId) {
        await updateCategory(token, editingId, { name });
        setStatus("Category updated.");
        dispatch(addToast(`Category #${editingId} updated`, "success"));
      } else {
        await createCategory(token, { name });
        setStatus("Category created.");
        dispatch(addToast("Category created", "success"));
      }

      resetForm();
      await loadCategories();
    } catch (err) {
      setStatus(err.message);
      dispatch(addToast(err.message, "error"));
    }
  };

  const handleEdit = (category) => {
    setStatus("");
    setEditingId(category.id);
    setForm({ name: category.name });
    dispatch(addToast(`Category #${category.id} opened for edit`, "info"));
  };

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setStatus("");
    setDeleteBusy(true);
    try {
      await deleteCategory(token, pendingDelete.id);
      setStatus(`Category #${pendingDelete.id} deleted.`);
      dispatch(addToast(`Category #${pendingDelete.id} deleted`, "success"));
      setPendingDelete(null);
      await loadCategories();
    } catch (err) {
      setStatus(err.message);
      dispatch(addToast(err.message, "error"));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section>
      <h1>Manage categories (admin)</h1>
      
      <form className="card form-stack" onSubmit={handleSubmit}>
        <label>Category name</label>
        <input 
          value={form.name} 
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} 
          placeholder="Enter category name"
          required 
        />

        <div className="inline-actions">
          <button type="submit">{editingId ? "Update category" : "Create category"}</button>
          {editingId && (
            <button type="button" onClick={resetForm}>Cancel edit</button>
          )}
        </div>
      </form>

      {status && <p className="status">{status}</p>}

      {loading && <p className="muted">Loading categories...</p>}
      
      {!loading && !categories.length && <p className="muted">No categories yet.</p>}

      <div className="booking-list">
        {categories.map((category) => (
          <article key={category.id} className="card">
            <h3>{category.name}</h3>
            <p className="muted">ID: {category.id}</p>
            <div className="inline-actions">
              <button type="button" onClick={() => handleEdit(category)}>Edit</button>
              <button type="button" onClick={() => setPendingDelete(category)}>Delete</button>
            </div>
          </article>
        ))}
      </div>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={`Delete category #${pendingDelete?.id || ""}`}
        description={`Are you sure you want to delete "${pendingDelete?.name || ""}"? Rooms using this category will be affected.`}
        busy={deleteBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
