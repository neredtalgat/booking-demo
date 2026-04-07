const BASE_URL = "http://localhost:8080";

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if(response.status === 401){
      localStorage.removeItem("hotel_auth");
      if(typeof window !== "undefined" && window.location.pathname !== "/login"){
        window.location.href = "/login";
      }
    }
    throw new Error(data.message || "Request failed");
  }
  return data;
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function register(payload) {
  return request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export function getMe(token){
  return request("/users/me", {
    headers: {...authHeader(token)}
  });
}

export function getRooms(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== "" && value !== undefined && value !== null) {
      query.set(key, value);
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/rooms${suffix}`);
}

export function getRoomById(id) {
  return request(`/rooms/${id}`);
}

export function createRoom(token, payload) {
  return request("/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(payload)
  });
}

export function updateRoom(token, id, payload) {
  return request(`/rooms/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(payload)
  });
}

export function deleteRoom(token, id) {
  return request(`/rooms/${id}`, {
    method: "DELETE",
    headers: { ...authHeader(token) }
  });
}

export function getMyBookings(token) {
  return request("/bookings", {
    headers: { ...authHeader(token) }
  });
}

export function getBookingById(token, id) {
  return request(`/bookings/${id}`, {
    headers: { ...authHeader(token) }
  });
}

export function createBooking(token, payload) {
  return request("/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token)
    },
    body: JSON.stringify(payload)
  });
}

export function updateBooking(token, id, payload) {
  return request(`/bookings/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token)
    },
    body: JSON.stringify(payload)
  });
}

export function deleteBooking(token, id) {
  return request(`/bookings/${id}`, {
    method: "DELETE",
    headers: { ...authHeader(token) }
  });
}
