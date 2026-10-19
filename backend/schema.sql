CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY, full_name VARCHAR(120) NOT NULL, email VARCHAR(150) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'citizen' CHECK(role IN ('citizen','admin')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_requests (
 id SERIAL PRIMARY KEY, reference_number VARCHAR(32) UNIQUE NOT NULL,
 user_id INT NOT NULL REFERENCES users(id), category VARCHAR(50) NOT NULL,
 location VARCHAR(500) NOT NULL, description TEXT NOT NULL, image_path TEXT,
 outage_started_at TIMESTAMPTZ, power_restored BOOLEAN NOT NULL DEFAULT FALSE,
 status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','In Progress','Resolved')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS request_status_history (
 id SERIAL PRIMARY KEY, request_id INT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
 old_status VARCHAR(20), new_status VARCHAR(20) NOT NULL, changed_by INT REFERENCES users(id),
 changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_requests_user ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests(status);

-- Services ziko available to citizens
CREATE TABLE IF NOT EXISTS service_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO service_categories (name, description)
VALUES
('Street Lighting', 'Broken streetlights and lighting faults'),
('Water and Sanitation', 'Water shortages, leaks and drainage issues'),
('Garbage Collection', 'Missed collections and waste management'),
('Electricity', 'Power outages and electrical infrastructure'),
('Road Maintenance', 'Potholes and damaged road infrastructure'),
('Other', 'Other public service requests')
ON CONFLICT (name) DO NOTHING;
