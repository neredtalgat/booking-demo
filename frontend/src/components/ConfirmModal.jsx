export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  busy = false,
  onConfirm,
  onCancel
}) {
  if (!open) {
    return null;
  }

  return (
    <section className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <article className="card modal confirm-modal">
        <div className="modal-head">
          <h3>{title}</h3>
        </div>
        <p>{description}</p>
        <div className="inline-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Please wait..." : confirmText}
          </button>
        </div>
      </article>
    </section>
  );
}