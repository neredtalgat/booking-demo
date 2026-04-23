import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { removeToast } from "../store/uiSlice";

function ToastItem({ toast }) {
  const dispatch = useDispatch();

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(removeToast(toast.id));
    }, 3200);

    return () => clearTimeout(timer);
  }, [dispatch, toast.id]);

  return (
    <article className={`toast toast--${toast.type}`}>
      <p>{toast.message}</p>
      <button type="button" onClick={() => dispatch(removeToast(toast.id))}>
        x
      </button>
    </article>
  );
}

export default function ToastContainer() {
  const toasts = useSelector((state) => state.ui.toasts);

  if (!toasts.length) {
    return null;
  }

  return (
    <section className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </section>
  );
}