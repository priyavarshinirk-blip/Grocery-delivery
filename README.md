# P19 — Online Grocery Delivery Platform (Quick Commerce Backend)

**Course**: Advanced JavaScript Backend Frameworks — Node.js & Express.js  
**Project Code**: P19  
**Semester**: 5th Semester  
**Section/Batch**: 5BTCSDS  
**GitHub repository**: Add the final repository URL here before PDF submission.

## Team Details
| Name | Roll No | Department | Section |
|Priyavarshini.R|2462351|ADSE|5BTCSDS|
|S.Gopika Anand|2462355|ADSE|5BTCSDS|
|Rohith.V|2462353|ADSE|5BTCSDS|
|Rakshwanth.K|2462352|ADSE|5BTCSDS|

## Problem Statement
Quick-commerce grocery platforms need a backend that coordinates four distinct actors — customers, dark-store staff, delivery partners, and admins — through a single, consistent order lifecycle. This project implements that backend: it validates stock at the correct dark store before accepting an order, enforces a strict pick → pack → assign → deliver workflow instead of freeform status edits, and gives store managers visibility into operational performance.

## Tech Stack
- **Runtime**: Node.js (v18+) with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Auth**: JWT (jsonwebtoken) + bcrypt password hashing (bcryptjs)
- **Validation**: express-validator
- **Security headers**: helmet, cors
- **Logging**: morgan
- **Docs/Testing**: Postman collection (`docs/postman_collection.json`)

## Project Structure
```
project-root/
  config/db.js              MongoDB connection
  models/                   Mongoose schemas (one file per collection)
  routes/                   Express route definitions, grouped by resource
  controllers/              Business logic for each route
  middleware/
    auth.js                 JWT verification + role restriction
    validate.js              express-validator error formatter
    errorHandler.js          Centralized error handling + 404 handler
    validators/              Per-resource express-validator rule sets
  utils/
    AppError.js              Operational error class
    catchAsync.js             Wraps async handlers -> forwards rejections to errorHandler
    orderStateMachine.js      Single source of truth for valid order transitions
    nearestStore.js           Nearest-serviceable-dark-store resolution
    response.js               Consistent success response shape
    seed.js                   Seeds demo data (npm run seed)
  docs/
    ER-DIAGRAM.md             Mermaid ER diagram + embed/reference rationale
    postman_collection.json   Full Postman collection (happy + failure paths)
  app.js                     Express app assembly (no listen())
  server.js                  Entry point - loads env, connects DB, starts server
  .env.example
```

## Setup Instructions
1. **Prerequisites**: Node.js 18+, a running MongoDB instance (local `mongod` or a MongoDB Atlas connection string).
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure environment**
  ```powershell
  Copy-Item .env.example .env
  ```
   Then edit `.env`:
   - `MONGO_URI` — your MongoDB connection string
   - `JWT_SECRET` — a long random string (never commit real secrets)
   - `PORT`, `JWT_EXPIRES_IN`, `DEFAULT_REORDER_POINT` — optional, sensible defaults provided
4. **Seed demo data** (creates 2 dark stores, 18 products, per-store stock, and one user per role)
   ```bash
   npm run seed
   ```
   Seeded accounts (all use password `Password123!`):
   | Role | Email |
   |---|---|
   | admin | admin@grocery.test |
   | store_staff (Koramangala) | staff.koramangala@grocery.test |
   | customer | customer@grocery.test |
   | delivery_partner | delivery@grocery.test |
5. **Run the server**
   ```bash
   npm start        # production
   npm run dev      # nodemon, auto-restart
   ```
   Server starts on `http://localhost:5000` (or your configured `PORT`). Health check: `GET /api/health`.
6. **Import the Postman collection**: `docs/postman_collection.json`. It captures tokens and ids into collection variables automatically as you run requests top-to-bottom, starting with the **Auth** folder.
7. **Run the optional frontend**
  ```powershell
  Set-Location frontend
  npm.cmd install
  npm.cmd run dev
  ```
  Open `http://localhost:5173`. The frontend uses the backend at `http://localhost:5000/api` by default.

## Implemented Modules
| # | Module | Where |
|---|---|---|
| 1 | User Registration & Authentication | `routes/authRoutes.js`, `controllers/authController.js` |
| 2 | Dark-Store Management | `routes/darkStoreRoutes.js` |
| 3 | Product Catalog & Store-Wise Stock | `routes/productRoutes.js`, `routes/storeStockRoutes.js` |
| 4 | Order Placement with Nearest-Store Check | `controllers/orderController.js#placeOrder`, `utils/nearestStore.js` |
| 5 | Order Picking & Packing Workflow | `controllers/orderController.js#updateStatus` |
| 6 | Delivery Partner Assignment | `controllers/orderController.js#assignDeliveryPartner` |
| 7 | Delivery Status Tracking | `controllers/orderController.js#updateStatus` |
| 8 | Real-Time Order Status for Customer | `GET /api/orders/:id` |
| 9 | Stock Replenishment Alerts | `controllers/storeStockController.js#lowStockAlerts` |
| 10 | Delivery Time Slot Selection | `Order.deliverySlot` (embedded), accepted in `POST /api/orders` |
| 11 | Customer Order History & Reorder | `GET /api/orders`, `POST /api/orders/:id/reorder` |
| 12 | Store & Delivery Performance Reports | `controllers/reportController.js` |
| 13 | Role-Based Access Control | `middleware/auth.js` (`protect`, `restrictTo`) + ownership checks in each controller |

## Order Workflow (State Machine)
```
PLACED --(store_staff)--> PICKING --(store_staff)--> PACKED --(store_staff, via /assign)--> ASSIGNED
  --(delivery_partner)--> OUT_FOR_DELIVERY --(delivery_partner)--> DELIVERED

Any of PLACED / PICKING / PACKED / ASSIGNED / OUT_FOR_DELIVERY --> FAILED (role-gated, see utils/orderStateMachine.js)
DELIVERED and FAILED are terminal.
```
All transitions are validated centrally in `utils/orderStateMachine.js` (`canTransition`, `isRoleAllowed`). Assignment is handled by a dedicated `PUT /api/orders/:id/assign` endpoint (not the generic status endpoint) because it also has to select and lock a delivery partner. If an order fails before delivery, reserved stock is automatically restored (`restoreStock`) and the delivery partner (if any) is freed up.

## API Endpoint Reference

### Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register as customer / store_staff / delivery_partner |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | Authenticated | Get current user |
| PATCH | `/api/auth/me` | Authenticated | Update name, email, phone, or default address |
| POST | `/api/auth/create-admin` | Admin | Provision another admin account |

### Dark Stores
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/dark-stores` | Authenticated | List stores |
| GET | `/api/dark-stores/:id` | Authenticated | Get one store |
| POST | `/api/dark-stores` | Admin | Create store |
| PUT | `/api/dark-stores/:id` | Admin | Update store |
| DELETE | `/api/dark-stores/:id` | Admin | Deactivate store (soft delete) |

### Products
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/products?category=&search=` | Authenticated | Browse catalog |
| GET | `/api/products/:id` | Authenticated | Get one product |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Deactivate product (soft delete) |

### Store Stock
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/store-stock` | Admin | Create/overwrite a store's stock for a product |
| GET | `/api/store-stock/store/:storeId` | Authenticated | Browse products + stock at a store |
| PATCH | `/api/store-stock/:id/adjust` | Admin, Store Staff | Relative stock adjustment (rejects negative result) |
| GET | `/api/store-stock/low-stock?storeId=` | Admin, Store Staff | Replenishment alerts (qty <= reorderPoint) |

### Orders
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/orders` | Customer | Place order (nearest-store check + stock validation) |
| GET | `/api/orders?status=&page=&limit=` | Authenticated | Role-scoped list (own orders / own store / own deliveries / all) |
| GET | `/api/orders/:id` | Owner-scoped | Order detail / live status |
| PUT | `/api/orders/:id/status` | Role-gated by transition | Advance the order through the workflow (pick, pack, out-for-delivery, delivered, failed) |
| PUT | `/api/orders/:id/assign` | Admin, Store Staff (own store) | Assign a delivery partner (PACKED -> ASSIGNED) |
| POST | `/api/orders/:id/reorder` | Customer (own order) | Re-place a past order |

### Delivery Partners
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/delivery-partners?isAvailable=` | Admin, Store Staff | List partners |
| GET | `/api/delivery-partners/me` | Delivery Partner | Own profile |
| PATCH | `/api/delivery-partners/me/availability` | Delivery Partner | Toggle availability |

### Reports
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/reports/performance?storeId=&from=&to=` | Admin, Store Staff (own store) | Order volume, delivered/failed counts, avg pick/pack/delivery time per store |

### Sample Request/Response
`POST /api/orders`
```json
// Request
{
  "items": [{ "productId": "665f1...", "quantity": 2 }],
  "deliveryAddress": { "line1": "12 MG Road", "area": "Koramangala", "pincode": "560034" },
  "deliverySlot": { "date": "2026-09-10", "startTime": "10:00", "endTime": "12:00" }
}
// 201 Response
{
  "success": true,
  "message": "Order placed successfully",
  "data": { "order": { "_id": "...", "status": "PLACED", "totalAmount": 54, "...": "..." }, "resolvedStore": { "id": "...", "name": "Koramangala Dark Store" } }
}
```
`PUT /api/orders/:id/status` with an invalid transition
```json
// 409 Response
{ "success": false, "message": "Cannot transition order from PLACED to DELIVERED", "errorCode": "INVALID_TRANSITION" }
```

## Database Schema Summary
See `docs/ER-DIAGRAM.md` for the full ER diagram and the reference-vs-embedding rationale for every relationship. Summary:
- **users**: single collection for all 4 roles, discriminated by `role`; `assignedStore` (ref) for staff, `defaultAddress` (embedded) for customers.
- **darkStores**: geo-indexed (`2dsphere`) for nearest-store resolution; `serviceablePincodes` gates which orders it can serve.
- **products**: catalog; price is authoritative here but **snapshotted** into `orders.items[]` at order time.
- **storeStock**: the many-to-many join between stores and products; compound unique index on `(storeId, productId)`.
- **orders**: `items[]`, `statusHistory[]`, `deliveryAddress`, `deliverySlot` are embedded (always read with the order, snapshot semantics, or feed the performance-report aggregation directly); `customerId`, `storeId`, `deliveryPartnerId` are referenced (shared, independently updated entities).
- **deliveryPartners**: extends `users` 1:1 with delivery-specific state (`isAvailable`, `currentOrder`).

## Security
- Passwords hashed with bcrypt (cost factor 10), never stored or logged in plaintext.
- JWT secret and Mongo URI are read from `process.env` only — `.env` is gitignored, `.env.example` ships with no real values.
- Every protected route runs `protect` (verifies JWT, loads the live user) then `restrictTo(...)` where role matters.
- Ownership is checked in controllers (`assertOrderAccess`, store-scoping on staff, self-scoping on delivery partners) in addition to role checks — a store_staff token from Store A cannot touch Store B's orders.
- All request bodies are validated server-side with express-validator before touching business logic (never relies on frontend/Postman-side checks).

## Error Handling
`middleware/errorHandler.js` normalizes every thrown/rejected error (`AppError`, Mongoose `ValidationError`/`CastError`/duplicate-key, JWT errors, or anything unexpected) into one JSON shape:
```json
{ "success": false, "message": "...", "errorCode": "...", "details": [ /* optional, validation only */ ] }
```
`catchAsync` wraps every async controller so a rejected promise is forwarded to this handler instead of crashing the process; `server.js` also has a defensive `unhandledRejection` listener as a last resort.

## Known Limitations / Assumptions
- Single currency (INR-style numbers, no currency field) and single timezone, as permitted by the spec's assumptions.
- The customer frontend lives in `frontend/` and runs separately with `npm.cmd install` then `npm.cmd run dev`; it provides catalog browsing, authentication, profile editing, cart checkout, order history, privacy, and terms pages.
- Payment gateways, SMS/email notifications, and maps/geocoding are out of scope and are not stubbed with fake success responses — geolocation for nearest-store resolution uses coordinates supplied directly in the request/customer profile rather than a third-party geocoding API.
- Stock deduction uses atomic conditional updates with manual compensation (rollback) instead of a multi-document MongoDB transaction, because transactions require a replica set, which a default standalone `mongod` does not provide. Order creation failures restore all deductions before returning the error. If deployed against a replica set / Atlas cluster, this can be upgraded to a session-based transaction with no schema changes.
- The frontend does not include staff/admin operational dashboards; those roles are demonstrated through the API/Postman collection.
- Email changes update the login identity immediately and are protected by format validation and a unique-email conflict check; no email verification provider is included.
- `POST /api/auth/create-admin` requires an existing admin token — there is intentionally no open "become admin" endpoint. Bootstrap the first admin via `npm run seed` or by inserting a document directly.

## Postman Testing Checklist Coverage
The collection covers the main end-to-end API workflow and representative failure cases in `docs/postman_collection.json`:
- Happy path create/read/update for auth (register/login/me)
- Validation failure (400) — e.g. register with missing fields, negative product price
- Authentication failure (401) — protected route with no token, wrong password
- Authorization failure (403) — customer calling admin-only routes, wrong-role status transitions, wrong owner reading another customer's order
- Business-rule conflict (409) — out-of-stock order, no serviceable store for a pincode, invalid order-status transition, duplicate email/store name, assigning a partner to an already-assigned order
- Not-found (404) — invalid dark-store id, invalid order id

The frontend also provides a live customer demonstration at `http://localhost:5173` when both the backend and frontend processes are running.

## Running the Test Sweep
1. `npm run seed`
2. `npm start`
3. Import `docs/postman_collection.json` into Postman, set `baseUrl` if not running on port 5000, and run the **Auth** folder first (it populates tokens), then run the remaining folders in order.

## University Submission Checklist
- [x] Node.js + Express.js backend
- [x] MongoDB + Mongoose models and indexes
- [x] JWT authentication and bcrypt password hashing
- [x] Server-side validation middleware
- [x] Centralized JSON error handling
- [x] Thirteen implemented functional modules (minimum required: twelve)
- [x] Postman collection covering the API workflow and representative failures
- [x] `.gitignore` excludes `.env` and `node_modules`
- [x] `.env.example` included
- [ ] Create or confirm the GitHub repository and replace the repository placeholder above
- [ ] Push the complete source with contribution history from all team members
- [ ] Prepare the single LMS PDF with a Team Details page, GitHub link, overview, and module summary
- [ ] Add at least seven report pages, code/output screenshots, and the required file name
- [ ] Prepare the 10–15 slide PPT covering problem, objectives, architecture, modules, schema, demo, learnings, and challenges
- [ ] Rehearse the 8–10 minute demo and ensure every team member can explain every module
