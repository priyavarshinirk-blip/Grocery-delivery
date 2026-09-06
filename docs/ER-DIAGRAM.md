# ER / Collection Diagram

```mermaid
erDiagram
    USERS ||--o{ ORDERS : "places (customerId)"
    USERS ||--o| DELIVERYPARTNERS : "is (userId)"
    USERS }o--|| DARKSTORES : "staffs (assignedStore)"
    DARKSTORES ||--o{ STORESTOCK : "stocks"
    DARKSTORES ||--o{ ORDERS : "fulfils (storeId)"
    PRODUCTS ||--o{ STORESTOCK : "tracked per store"
    PRODUCTS ||--o{ ORDERS : "referenced in items[] snapshot"
    DELIVERYPARTNERS ||--o{ ORDERS : "delivers (deliveryPartnerId)"

    USERS {
        ObjectId _id
        string name
        string email
        string passwordHash
        string role "customer | store_staff | delivery_partner | admin"
        ObjectId assignedStore "FK -> DarkStores, store_staff only"
        object defaultAddress "embedded, customer only"
    }

    DARKSTORES {
        ObjectId _id
        string name
        string area
        object location "GeoJSON Point, 2dsphere indexed"
        array serviceablePincodes
        boolean isActive
    }

    PRODUCTS {
        ObjectId _id
        string name
        string category
        number price
        string unit
        boolean isActive
    }

    STORESTOCK {
        ObjectId _id
        ObjectId storeId "FK -> DarkStores"
        ObjectId productId "FK -> Products"
        number quantity
        number reorderPoint
    }

    ORDERS {
        ObjectId _id
        ObjectId customerId "FK -> Users"
        ObjectId storeId "FK -> DarkStores"
        array items "EMBEDDED: productId, name, price snapshot, quantity"
        number totalAmount
        string status "PLACED..DELIVERED/FAILED"
        array statusHistory "EMBEDDED: status, at, by"
        ObjectId deliveryPartnerId "FK -> DeliveryPartners, nullable"
        object deliveryAddress "EMBEDDED snapshot"
        object deliverySlot "EMBEDDED, optional"
    }

    DELIVERYPARTNERS {
        ObjectId _id
        ObjectId userId "FK -> Users, unique"
        boolean isAvailable
        ObjectId currentOrder "FK -> Orders, nullable"
        string vehicleType
    }
```

## Reference vs. Embedding rationale

| Data | Decision | Why |
|---|---|---|
| `Order.items[]` | **Embedded** | Always read together with the order; immutable after placement (price is a snapshot); never queried independently of its parent order. |
| `Order.statusHistory[]` | **Embedded** | Small, append-only, always read with the order, and is the direct input to the performance-report aggregation (module 12) — no separate `orderEvents` collection needed. |
| `Order.deliveryAddress` / `deliverySlot` | **Embedded** | Must freeze the delivery address at order time even if the customer edits their profile later. |
| `Order.customerId`, `Order.storeId`, `Order.deliveryPartnerId` | **Referenced** | Large, shared, independently-updated entities (a store or partner is not "owned" by one order). |
| `StoreStock.storeId` / `productId` | **Referenced** | `storeStock` is a many-to-many join table by nature — a product exists across many stores, and quantity is updated on almost every order, independently of both the store and product documents. |
| `User.assignedStore` | **Referenced** | A dark store is a shared entity independently managed by admins; embedding it would duplicate and desynchronize store data across every staff user. |
| `User.defaultAddress` | **Embedded** | Small, 1:1 with the user, no independent lifecycle. |
