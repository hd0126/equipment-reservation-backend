const { Pool } = require('pg');

// PostgreSQL connection pool
// Railway automatically provides DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

// Initialize database tables
const initDatabase = async () => {
  try {
    // Create Users table with extended fields
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        department VARCHAR(50),
        phone VARCHAR(20),
        user_role VARCHAR(20) DEFAULT 'staff',
        supervisor VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table ready');

    // Create Equipment table with manager
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'available' CHECK(status IN ('available', 'maintenance')),
        image_url TEXT,
        brochure_url TEXT,
        manual_url TEXT,
        quick_guide_url TEXT,
        manager_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Equipment table ready');

    // Create Reservations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER NOT NULL REFERENCES equipment(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        purpose TEXT,
        status VARCHAR(50) DEFAULT 'confirmed' CHECK(status IN ('pending', 'confirmed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Reservations table ready');

    // Create Equipment Permissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_permissions (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        granted_by INTEGER REFERENCES users(id),
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(equipment_id, user_id)
      )
    `);
    console.log('Equipment Permissions table ready');

    // Create Equipment Logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_logs (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        reservation_id INTEGER REFERENCES reservations(id),
        log_type VARCHAR(20) DEFAULT 'usage_remark',
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Equipment Logs table ready');

    // Migration: Add new columns to existing tables
    try {
      // Users table migrations
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(50)`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS user_role VARCHAR(20) DEFAULT 'staff'`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor VARCHAR(100)`);

      // Migrate role to user_role: admin → admin, user → staff
      await pool.query(`UPDATE users SET user_role = 'admin' WHERE role = 'admin' AND (user_role IS NULL OR user_role = 'staff')`);
      await pool.query(`UPDATE users SET user_role = 'staff' WHERE role = 'user' AND (user_role IS NULL OR user_role = '')`);

      // Equipment table migrations
      await pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS brochure_url TEXT`);
      await pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS manual_url TEXT`);
      await pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS quick_guide_url TEXT`);
      await pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id)`);

      // Set admin as default manager for equipment without manager
      await pool.query(`
        UPDATE equipment SET manager_id = (SELECT id FROM users WHERE user_role = 'admin' LIMIT 1)
        WHERE manager_id IS NULL
      `);

      // Equipment Permissions table migrations
      await pool.query(`ALTER TABLE equipment_permissions ADD COLUMN IF NOT EXISTS permission_level VARCHAR(20) DEFAULT 'normal'`);
      // permission_level: 'normal' (승인필요), 'autonomous' (자율사용), 'manager' (장비담당)

      console.log('Migration columns ready');
    } catch (e) {
      console.log('Migration note:', e.message);
    }

    console.log('✓ Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
};

// Helper function to run queries
const query = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows;
};

// Helper function to run single query and return metadata
const run = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return {
    id: result.rows[0]?.id || null,
    changes: result.rowCount
  };
};

// Helper function to get single row
const get = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
};

module.exports = {
  pool,
  initDatabase,
  query,
  run,
  get
};
