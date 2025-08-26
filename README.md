# Sales & Reservations API – Node.js/Express

## Versions

- [English](#english-version)
- [Español](#spanish-version)

---

<a id="english-version"></a>

## English Version

### Description

API to manage **sales** and **reservations** (generic for restaurants, barbershops, appointment-based services, etc.).  
Auth via **API Key** using header `x-api-key`.

**Key points**

- Amounts are stored/calculated in **cents** (minor units).
- Responses also include **EUR display fields** (`subtotal`, `tax`, `total` and `...Formatted`) for convenience.
- `GET` endpoints are public by default; **`POST`/`PATCH` require** `x-api-key`.

### Environment

Create `.env` from the example and adjust:

```env
PORT=3000
API_KEY=supersecreto123  # ← replace with your own
TAX_RATE=0.21
CURRENCY=EUR
DATABASE_URL="file:./dev.db"
```

### How to run locally

```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run dev
```

- Health: `http://localhost:3000/api/health`
- Swagger UI: `http://localhost:3000/api/docs`

### Seed demo data

```bash
npm run seed      # runs prisma/seed.js (customers, products, orders, reservations)
```

### Main routes

**System**

- `GET /api/health` – healthcheck
- `GET /api/docs` – Swagger UI

**Customers**

- `GET /api/v1/customers?take&skip&q`
- `POST /api/v1/customers` _(x-api-key)_

**Products**

- `GET /api/v1/products?take&skip&q`
- `POST /api/v1/products` _(x-api-key)_

**Reservations**

- `GET /api/v1/reservations?take&skip&customerId&status&dateFrom&dateTo`
- `POST /api/v1/reservations` _(x-api-key)_

**Orders**

- `GET /api/v1/orders?take&skip&customerId&status&dateFrom&dateTo&updatedSince`
- `GET /api/v1/orders/:id`
- `POST /api/v1/orders` _(x-api-key)_ → calculates `subtotalCents`, `taxCents`, `totalCents` and returns EUR display fields
- `PATCH /api/v1/orders/:id` _(x-api-key)_ → `{ "status": "PAID" | "CANCELLED" }`

> **Pagination:** `take` (max 200) & `skip`.  
> **Filtering:** `dateFrom`/`dateTo` filter by `createdAt` (ISO-8601), `updatedSince` by `updatedAt`.

### Money fields

- Stored: `subtotalCents`, `taxCents`, `totalCents`, `currencyCode` (ISO-4217).
- Display (added in responses):  
  `subtotal`, `tax`, `total` (EUR numbers) and  
  `subtotalFormatted`, `taxFormatted`, `totalFormatted`.

### Power BI (quick)

1. **Get Data → Web → Advanced**  
   URL: `http://localhost:3000/api/v1/orders?dateFrom=2025-01-01T00:00:00Z&dateTo=2025-12-31T23:59:59Z&take=200&skip=0`  
   Header: `x-api-key: YOUR_KEY`
2. In Power Query, **divide by 100** the `*_Cents` fields or use provided `subtotal/tax/total`.
3. Expand `customer` and `items` if you need line-level detail.
4. For incremental refresh, call with `updatedSince=<last imported timestamp>`.

### Zapier (quick)

- **Pull new/updated orders**: every 15 minutes `GET /api/v1/orders?updatedSince=<timestamp>&take=200` with header `x-api-key`.
- **Create reservation**: `POST /api/v1/reservations` with `x-api-key` and JSON body from your source app.

### Online demo

Add your public URL once deployed (e.g., `https://api.yourdomain.com/api/docs`).

---

<a id="spanish-version"></a>

## Versión en Español

### Descripción

API para gestionar **ventas** y **reservas** (genérica para restaurantes, barberías, servicios por cita, etc.).  
Autenticación por **API Key** en el header `x-api-key`.

**Puntos clave**

- Los importes se guardan/calculan en **céntimos**.
- Las respuestas incluyen campos **en EUR** (`subtotal`, `tax`, `total` y `...Formatted`) para visualización.
- Los `GET` son públicos; **`POST`/`PATCH` requieren** `x-api-key`.

### Variables de entorno

Crea `.env` desde el ejemplo y ajusta:

```env
PORT=3000
API_KEY=supersecreto123  # ← reemplaza con la tuya
TAX_RATE=0.21
CURRENCY=EUR
DATABASE_URL="file:./dev.db"
```

### Cómo levantar en local

```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run dev
```

- Health: `http://localhost:3000/api/health`
- Swagger UI: `http://localhost:3000/api/docs`

### Semilla de datos (seed)

```bash
npm run seed
```

### Rutas principales

**Sistema**

- `GET /api/health` – estado
- `GET /api/docs` – Swagger UI

**Clientes**

- `GET /api/v1/customers?take&skip&q`
- `POST /api/v1/customers` _(x-api-key)_

**Productos**

- `GET /api/v1/products?take&skip&q`
- `POST /api/v1/products` _(x-api-key)_

**Reservas**

- `GET /api/v1/reservations?take&skip&customerId&status&dateFrom&dateTo`
- `POST /api/v1/reservations` _(x-api-key)_

**Pedidos**

- `GET /api/v1/orders?take&skip&customerId&status&dateFrom&dateTo&updatedSince`
- `GET /api/v1/orders/:id`
- `POST /api/v1/orders` _(x-api-key)_ → calcula totales en céntimos y devuelve campos en EUR
- `PATCH /api/v1/orders/:id` _(x-api-key)_ → `{ "status": "PAID" | "CANCELLED" }`

> **Paginación:** `take` (máx 200) & `skip`.  
> **Filtros:** `dateFrom`/`dateTo` por `createdAt` (ISO-8601) y `updatedSince` por `updatedAt`.

### Información importante

- Importes persistidos: `subtotalCents`, `taxCents`, `totalCents`, `currencyCode` (ISO-4217).
- Campos de visualización añadidos en respuestas:  
  `subtotal`, `tax`, `total` (en EUR) y `subtotalFormatted`, `taxFormatted`, `totalFormatted`.

### Demo online

Añade aquí tu URL pública tras el despliegue (p. ej. `https://api.tudominio.com/api/docs`).
