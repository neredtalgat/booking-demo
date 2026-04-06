# Hotel Booking System

Проект собран на основе структуры из `week10-project1.rar` (React + Context + Router), но адаптирован под домен бронирования отелей.

## Что реализовано

- Frontend (React + Vite):
  - логин по email
  - переключение темы
  - поиск номеров по городу/гостям/датам
  - создание брони
  - список моих бронирований
- Backend (Express):
  - `POST /auth/login`
  - `GET /rooms`
  - `GET /bookings` (auth)
  - `POST /bookings` (auth)
  - проверка пересечений бронирований по датам

## Запуск

1. Backend:

```bash
cd backend
npm install
npm run dev
```

2. Frontend:

```bash
cd frontend
npm install
npm run dev
```

- Backend: http://localhost:8080
- Frontend: http://localhost:5173

## Демодоступ

Для входа можно использовать:

- `guest@hotel.com`
- `admin@hotel.com`
- либо любой email в корректном формате
