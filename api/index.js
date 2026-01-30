require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase, query, run, get } = require('../config/database');
const User = require('../models/User');
const Equipment = require('../models/Equipment');

// Import routes
const authRoutes = require('../routes/auth');
const equipmentRoutes = require('../routes/equipment');
const reservationRoutes = require('../routes/reservation');
const uploadRoutes = require('../routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Auto-seed default users and equipment
const autoSeed = async () => {
  try {
    // Check and create admin user
    const existingAdmin = await User.findByEmail('admin@test.com');
    if (!existingAdmin) {
      await User.create('admin', 'admin@test.com', 'admin123', 'admin');
      console.log('✓ Default admin user created');
    }

    // Check and create regular user
    const existingUser = await User.findByEmail('user@test.com');
    if (!existingUser) {
      await User.create('testuser', 'user@test.com', 'user123', 'user');
      console.log('✓ Default test user created');
    }

    // Check if first equipment already exists (prevents race condition)
    const existingEquipment = await get('SELECT id FROM equipment WHERE name = $1', ['UV aligner (SUSS)']);

    if (!existingEquipment) {
      console.log('Seeding equipment (first item not found)...');

      const equipments = [
        {
          name: 'UV aligner (SUSS)',
          desc: 'SUSS MicroTec MA6 Mask Aligner for photolithography',
          loc: 'Yellow Room 101',
          img: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=300&fit=crop'
        },
        {
          name: 'UV aligner (MIDAS)',
          desc: 'MIDAS MDA-400M Mask Aligner (Contact/Proximity)',
          loc: 'Yellow Room 102',
          img: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop'
        },
        {
          name: 'Spincoater (SUSS)',
          desc: 'SUSS MicroTec LabSpin for photoresist coating',
          loc: 'Yellow Room 101',
          img: 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?w=400&h=300&fit=crop'
        },
        {
          name: 'Spincoater (MIDAS)',
          desc: 'MIDAS Spin Coater for general purpose',
          loc: 'Yellow Room 102',
          img: 'https://images.unsplash.com/photo-1581093450021-4a7360e9a6b5?w=400&h=300&fit=crop'
        },
        {
          name: 'RIE (SORONA)',
          desc: 'Sorona Plasma Etch System',
          loc: 'Etch Lab 202',
          img: 'https://images.unsplash.com/photo-1581091226033-d5c48150dbaa?w=400&h=300&fit=crop'
        },
        {
          name: 'ICP-RIE (OXFORD)',
          desc: 'Oxford Instruments Plasmalab System 100',
          loc: 'Etch Lab 201',
          img: 'https://images.unsplash.com/photo-1581091877018-dac6a371d50f?w=400&h=300&fit=crop'
        }
      ];

      for (const eq of equipments) {
        // Use INSERT with conflict check to prevent duplicates
        try {
          await Equipment.create(eq.name, eq.desc, eq.loc, 'available', eq.img);
        } catch (insertError) {
          // Ignore duplicate errors
          console.log(`Equipment ${eq.name} might already exist, skipping`);
        }
      }
      console.log(`✓ Seeded ${equipments.length} equipments`);
    } else {
      console.log('⏭ Equipment already exists, skipping seed');
    }

  } catch (error) {
    console.error('Auto-seed error:', error);
  }
};

// Middleware
app.use(cors()); // Allow all origins for troubleshooting
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Multer setup for file uploads (Memory Storage)
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB limit
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize database middleware (for Vercel/Serverless)
let dbInitialized = false;

app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDatabase();
      await autoSeed();
      dbInitialized = true;
      console.log('Database initialized for this instance');
    } catch (error) {
      console.error('Database initialization failed:', error);
      return res.status(500).json({ error: 'Database connection failed' });
    }
  }
  next();
});

// Routes (Handle both paths for Vercel routing compatibility)
app.use(['/auth', '/api/auth'], authRoutes);
app.use(['/reservations', '/api/reservations'], reservationRoutes);
app.use(['/upload', '/api/upload'], uploadRoutes);

// Permission Routes
const permissionRoutes = require('../routes/permission');
app.use(['/permissions', '/api/permissions'], permissionRoutes);

// Equipment Log Routes
const equipmentLogRoutes = require('../routes/equipmentLog');
app.use(['/equipment-logs', '/api/equipment-logs'], equipmentLogRoutes);

// Equipment Routes with File Upload Support
const router = express.Router();

// Get all equipment
router.get('/', async (req, res) => {
  try {
    const equipment = await Equipment.findAll();
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get equipment by ID
router.get('/:id', async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create equipment (Admin only) - Supports both JSON URL and File Upload
// Note: We redefine POST here to support file upload middleware
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, description, location } = req.body;
    let image_url = req.body.image_url; // Default to URL if provided

    // If file is uploaded, convert to Base64
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const mimeType = req.file.mimetype;
      image_url = `data:${mimeType};base64,${b64}`;
    }

    if (!image_url) {
      // Fallback image
      image_url = 'https://images.unsplash.com/photo-1581093458791-9d42e1d6b770?w=400';
    }

    const id = await Equipment.create(name, description, location, image_url);
    res.status(201).json({ message: 'Equipment created successfully', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update equipment
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, description, location, status, brochure_url, manual_url, quick_guide_url } = req.body;
    let image_url = req.body.image_url;

    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const mimeType = req.file.mimetype;
      image_url = `data:${mimeType};base64,${b64}`;
    }

    // Call Equipment.update with document URLs
    await Equipment.update(req.params.id, name, description, location, status, image_url, brochure_url, manual_url, quick_guide_url);
    res.json({ message: 'Equipment updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete equipment
router.delete('/:id', async (req, res) => {
  try {
    await Equipment.delete(req.params.id);
    res.json({ message: 'Equipment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mount manual equipment routes
app.use(['/equipment', '/api/equipment'], router);

// Statistics API (Enhanced)
const { verifyToken: statsVerifyToken, isAdmin: statsIsAdmin } = require('../middleware/auth');
app.get(['/stats', '/api/stats'], statsVerifyToken, statsIsAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const hasDateFilter = start_date && end_date;

    // Equipment usage stats (with total hours)
    const equipmentStats = await query(`
      SELECT
        e.id,
        e.name as equipment_name,
        COUNT(r.id) as total_reservations,
        COUNT(CASE WHEN r.status = 'confirmed' THEN 1 END) as confirmed_count,
        COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) as cancelled_count,
        COALESCE(SUM(
          CASE WHEN r.status = 'confirmed'
          THEN EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600
          ELSE 0 END
        ), 0) as total_hours
      FROM equipment e
      LEFT JOIN reservations r ON e.id = r.equipment_id
        ${hasDateFilter ? 'AND r.start_time >= $1 AND r.start_time < $2' : ''}
      GROUP BY e.id, e.name
      ORDER BY total_hours DESC
    `, hasDateFilter ? [start_date, end_date] : []);

    // User usage stats (with total hours)
    const userStats = await query(`
      SELECT
        u.id,
        u.username,
        u.email,
        COUNT(r.id) as total_reservations,
        COUNT(CASE WHEN r.status = 'confirmed' THEN 1 END) as confirmed_count,
        COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) as cancelled_count,
        COALESCE(SUM(
          CASE WHEN r.status = 'confirmed'
          THEN EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600
          ELSE 0 END
        ), 0) as total_hours
      FROM users u
      LEFT JOIN reservations r ON u.id = r.user_id
        ${hasDateFilter ? 'AND r.start_time >= $1 AND r.start_time < $2' : ''}
      GROUP BY u.id, u.username, u.email
      ORDER BY total_hours DESC
    `, hasDateFilter ? [start_date, end_date] : []);

    // User-Equipment usage matrix (top 20)
    const userEquipmentStats = await query(`
      SELECT
        u.username,
        e.name as equipment_name,
        COUNT(r.id) as reservation_count,
        COALESCE(SUM(
          CASE WHEN r.status = 'confirmed'
          THEN EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600
          ELSE 0 END
        ), 0) as total_hours
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.status = 'confirmed'
        ${hasDateFilter ? 'AND r.start_time >= $1 AND r.start_time < $2' : ''}
      GROUP BY u.username, e.name
      ORDER BY total_hours DESC
      LIMIT 20
    `, hasDateFilter ? [start_date, end_date] : []);

    // Monthly reservation trends (last 6 months or filtered period)
    const monthlyStats = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', start_time), 'YYYY-MM') as month,
        COUNT(*) as count,
        COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600), 0) as total_hours
      FROM reservations
      WHERE status = 'confirmed'
        ${hasDateFilter ? 'AND start_time >= $1 AND start_time < $2' : 'AND start_time >= NOW() - INTERVAL \'6 months\''}
      GROUP BY DATE_TRUNC('month', start_time)
      ORDER BY month DESC
    `, hasDateFilter ? [start_date, end_date] : []);

    res.json({
      equipmentStats: equipmentStats || [],
      userStats: userStats || [],
      userEquipmentStats: userEquipmentStats || [],
      monthlyStats: monthlyStats || []
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint (Handle both paths just in case)
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'OK', message: 'Equipment Reservation System API' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server if run directly (Local / Railway / Traditional Hosting)
if (require.main === module) {
  initDatabase()
    .then(async () => {
      await autoSeed();
      app.listen(PORT, () => {
        console.log(`\n=================================`);
        console.log(`Server running on port ${PORT}`);
        console.log(`API available at http://localhost:${PORT}/api`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log(`=================================\n`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
    });
}

// Export for Vercel
module.exports = app;
