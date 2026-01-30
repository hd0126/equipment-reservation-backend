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
    // Create Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table ready');

    // Create Equipment table
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

    // Add document URL columns to existing equipment table (migration)
    try {
      await pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS brochure_url TEXT`);
      await pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS manual_url TEXT`);
      await pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS quick_guide_url TEXT`);
      console.log('Document URL columns ready');
    } catch (e) {
      // Columns might already exist, ignore error
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
