# HudumaTrack — Murang'a County Public Service Request System

HudumaTrack is a full-stack web application developed to simplify the reporting, management, and tracking of public service issues within **Murang'a County, Kenya**.

Inspired by Kenya's eCitizen approach to digital public services, the system provides a centralized platform where citizens can report infrastructure and service-related problems while administrators monitor requests, update their progress, and analyze service delivery.

**Disclaimer:** HudumaTrack is an independent software development project created for demonstration purposes. It is not affiliated with or endorsed by the County Government of Murang'a or any government agency.

## Project Objectives

- Provide citizens with an accessible platform for reporting public service issues.
- Enable transparent tracking of service requests.
- Support administrators in managing and resolving reported issues.
- Provide basic analytics to monitor service delivery performance.
- Demonstrate the application of full-stack development, database management, authentication, and RESTful APIs.

## Key Features

### Citizen Portal
- Citizen registration and secure login.
- Submission of service requests with category, location, and description.
- Optional photo evidence uploads (JPEG, PNG, WebP; maximum 5 MB).
- Murang'a County location selection, including sub-county and specific location.
- Unique reference numbers for submitted requests.
- Personal request history and status tracking.

### Administrator Portal
- Dashboard displaying submitted service requests.
- View and manage citizen reports.
- Update request statuses: **Pending → In Progress → Resolved**.
- View basic analytics, including total, open, and resolved requests.
- Monitor reported power outages and restoration status.

### Additional Features
- Responsive user interface.
- Request filtering by status.
- Database-backed status history.
- Protected API endpoints with role-based authorization.
- Restricted access to uploaded evidence.
- Separate tracking of power restoration and ticket resolution.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, Vite, JavaScript |
| Styling | CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Authentication | JWT, bcrypt |
| File Uploads | Multer |
| Development Tools | Visual Studio Code, pgAdmin, Git, GitHub |

## System Architecture

HudumaTrack follows a client-server architecture:

**React Frontend → Express REST API → PostgreSQL Database**

The frontend handles user interaction and displays service requests. The backend manages authentication, request processing, authorization, and database operations. PostgreSQL stores user information, service requests, and status history.

## Project Structure

```text
public-service-system/
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── schema.sql
│   ├── seed-admin.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── ...
│   ├── package.json
│   └── ...
├── .gitignore
└── README.md
```

## Local Development Setup

### Prerequisites

- Node.js 20 or later
- npm
- PostgreSQL
- pgAdmin or psql

### 1. Clone the Repository

```bash
git clone https://github.com/Tiphanychemi/HudumaTrack-Muranga-County.git
cd HudumaTrack-Muranga-County
```

### 2. Configure the Database

Create a PostgreSQL database named:

```text
public_service_db
```

Run the SQL commands in `backend/schema.sql` using pgAdmin Query Tool or psql.

### 3. Configure Environment Variables

Create `backend/.env` using `backend/.env.example` as a template.

Configure the database connection, JWT secret, administrator email, and administrator password.

Keep `.env` private and exclude it from version control.

### 4. Start the Backend

```bash
cd backend
npm install
npm run seed:admin
npm run dev
```

The backend runs at `http://localhost:5000`.

### 5. Start the Frontend

Open a separate terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Application Workflow

1. A citizen registers and logs into HudumaTrack.
2. The citizen selects a service category and provides the location and description of the issue.
3. The citizen may attach a photograph as supporting evidence.
4. The system records the request and generates a unique tracking reference.
5. An administrator reviews the submitted request.
6. The administrator updates its status as work progresses.
7. The citizen can view the latest request status through their dashboard.
8. The administrator dashboard summarizes requests by status.

## REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | API health check |
| POST | `/api/auth/register` | Register a citizen |
| POST | `/api/auth/login` | Authenticate a user |
| GET | `/api/requests` | Retrieve citizen requests |
| POST | `/api/requests` | Submit a service request |
| GET | `/api/requests/:id` | Retrieve request details |
| GET | `/api/requests/:id/image` | Retrieve authorized photo evidence |
| GET | `/api/admin/requests` | Retrieve all reports as administrator |
| PATCH | `/api/admin/requests/:id` | Update request status |
| GET | `/api/admin/analytics` | Retrieve administrative analytics |

## Testing

The following scenarios are intended for functional verification:

- Register and authenticate a citizen.
- Submit a report with the required fields.
- Submit a report with optional image evidence.
- Verify generation of a tracking reference.
- Confirm the initial status is Pending.
- Verify the report appears in the administrator dashboard.
- Update its status to In Progress and Resolved.
- Confirm that the citizen can view the updated status.
- Verify that analytics reflect submitted and resolved reports.
- Confirm that citizens cannot access administrator-only endpoints.

## Future Improvements

- Email and SMS notifications when request statuses change.
- Interactive maps for identifying reported locations.
- Sub-county-based analytics and service performance comparisons.
- Administrative assignment of requests to relevant departments.
- Deployment to a secure cloud environment.
- Improved accessibility, security testing, and automated testing.

## Project Status

**Development and testing in progress.**

The application currently runs in a local development environment. Core features are implemented, with end-to-end testing and further refinements ongoing.

