# Qullqa (`qullqa-webapp`)

## Overview

Qullqa is a Vue 3 + Vite web application built with a Domain-Driven Design (DDD) architecture. It is a SaaS inventory management platform designed for independent convenience stores (*bodegas*) and pharmacies in Peru, helping business owners track stock, manage sales, monitor alerts, coordinate suppliers, and visualize key business metrics — all from a single interface.

The application is organized by bounded contexts, keeping business logic separated from UI and infrastructure concerns across all feature modules.

## Goals

- Deliver a practical DDD-oriented frontend architecture, fully separated by bounded context.
- Keep domain concepts explicit through entities, assemblers, stores, and API services per context.
- Provide a complete operational solution covering inventory, POS sales, supplier replenishment, IoT delivery tracking, and real-time stock alerts.
- Support internationalization (i18n) in English and Latin American Spanish out of the box.

## Tech Stack

- Vue 3
- Vite
- Pinia
- Vue Router
- Vue I18n
- PrimeVue + PrimeFlex + PrimeIcons
- Axios
- `json-server` for local mock API

## Project Structure (DDD-Oriented)

```text
src/
├── shared/                               # Shared cross-context concerns
│   ├── infrastructure/                   # BaseApi, BaseEndpoint (Axios wrappers)
│   └── presentation/                     # Layout, LanguageSwitcher, shared views
│
├── iam/                                  # Identity & Access Management
│   ├── domain/                           # User, Role entities
│   ├── application/                      # IamStore (Pinia)
│   ├── infrastructure/                   # IamApi, assemblers, auth guard
│   └── presentation/                     # SignIn, SignUp, UserList views
│
├── subscription/                         # Subscription & Plan Management
│   ├── domain/                           # Plan, Subscription entities
│   ├── application/                      # SubscriptionStore
│   ├── infrastructure/                   # SubscriptionApi, assemblers
│   └── presentation/                     # PlanPage, SubscriptionSummary views
│
├── product-inventory/                    # Product & Inventory Management
│   ├── domain/                           # Product, Inventory, Batch entities
│   ├── application/                      # ProductStore
│   ├── infrastructure/                   # ProductApi, assemblers
│   └── presentation/                     # ProductList, ProductForm, InventoryList, BatchIntake views
│
├── sales-pos/                            # Sales & POS Management
│   ├── domain/                           # Sale, SaleDetail, Customer entities
│   ├── application/                      # SalesStore
│   ├── infrastructure/                   # SalesApi, assemblers
│   └── presentation/                     # POSScreen, SaleList, CustomerList views
│
├── alerts/                               # Alerts & Operational Monitoring
│   ├── domain/                           # Alert entity
│   ├── application/                      # AlertsStore
│   ├── infrastructure/                   # AlertsApi, assemblers
│   └── presentation/                     # AlertsDashboard, AlertDetail views
│
├── supplier/                             # Supplier & Replenishment Management
│   ├── domain/                           # Supplier, Purchase, PurchaseDetail entities
│   ├── application/                      # SupplierStore
│   ├── infrastructure/                   # SupplierApi, assemblers
│   └── presentation/                     # SupplierList, PurchaseOrderList views
│
├── dashboard/                            # Dashboard & Analytics
│   ├── domain/                           # MetricsSnapshot entity
│   ├── application/                      # DashboardStore
│   ├── infrastructure/                   # DashboardApi, assemblers
│   └── presentation/                     # BusinessDashboard, ReportsView views
│
└── delivery/                             # Delivery Tracking (IoT)
    ├── domain/                           # Delivery entity
    ├── application/                      # DeliveryStore
    ├── infrastructure/                   # DeliveryApi, assemblers
    └── presentation/                     # DeliveryStatusView, DeliveryTrackingView views
```

## Bounded Contexts

### IAM Context
Handles user authentication, registration, and role-based access control. Includes sign-in and sign-up flows, user management, and role assignment per business.

### Subscription & Plan Context
Manages available subscription plans (Basic, Pro, Enterprise) and the active plan linked to each business. Allows plan comparison and upgrades.

### Product & Inventory Context
Core context of the application. Manages product catalog, stock levels per warehouse, batch registration with expiration dates, and stock intake history for both bodegas and pharmacies.

### Sales & POS Context
Handles point-of-sale transactions, sale detail lines, customer records, and payment methods (cash, card, Yape, Plin).

### Alerts & Monitoring Context
Generates and tracks operational alerts for low stock levels and near-expiration batches, with severity classification and resolution status.

### Supplier & Replenishment Context
Manages supplier records and purchase orders. Tracks order statuses (generated, received, delayed, cancelled) and links them to delivery tracking.

### Dashboard & Analytics Context
Provides KPI snapshots for each business: total products, low-stock count, inventory value, total sales, and sales count. Supports report generation by type and date range.

### Delivery Tracking Context
Tracks IoT-enabled deliveries linked to purchase orders. Records GPS coordinates and delivery status transitions (in transit, completed, delayed).

### Shared Context
Provides cross-cutting infrastructure: `BaseApi` centralizes Axios configuration, and `BaseEndpoint` standardizes CRUD operations across all contexts. Shared UI layout and navigation components live here.

## Layer Responsibilities

### Domain Layer
Defines business concepts as plain JavaScript classes. Stays framework-agnostic — no Vue or HTTP code.

### Application Layer
Coordinates state and use cases through Pinia stores. Delegates API calls to the infrastructure layer and exposes computed properties and actions to the presentation layer.

### Infrastructure Layer
Communicates with external APIs via Axios. Maps raw API responses to domain entities through assembler classes.

### Presentation Layer
Renders UI components and handles user interactions. Calls store actions and reacts to reactive state.

## Running the Project

### Prerequisites
- Node.js + npm installed (compatible with Vite 9+)

### 1) Install dependencies
```bash
npm install
```

### 2) Start the mock API (`json-server`)
```bash
cd server
npm install
npm start
# Mock API running at http://localhost:3000
```

The server reads `server/db.json` and exposes all resources under `/api/v1/*`.

### 3) Start the Vue app
In a separate terminal:
```bash
npm run dev
```

### 4) Build for production
```bash
npm run build
```

### 5) Preview production build
```bash
npm run preview
```
