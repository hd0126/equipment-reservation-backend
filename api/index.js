require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase, run } = require('../config/database');
const User = require('../models/User');
const Equipment = require('../models/Equipment');

// Import routes
const authRoutes = require('../routes/auth');
const equipmentRoutes = require('../routes/equipment');
const reservationRoutes = require('../routes/reservation');

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

    // Check equipment count first
    const countResult = await run('SELECT COUNT(*) as count FROM equipment');
    const count = parseInt(countResult.rows ? countResult.rows[0].count : 0);
    console.log(`Current equipment count: ${count}`);

    // Always force reset for this update
    await run('DELETE FROM equipment');
    console.log('⚠ Equipment table cleared for update');

    // Reset ID sequence
    try {
      await run("ALTER SEQUENCE equipment_id_seq RESTART WITH 1");
    } catch (e) {
      console.log('Sequence reset skipped');
    }

    const equipments = [
      {
        name: 'UV aligner (SUSS)',
        desc: 'SUSS MicroTec MA6 Mask Aligner',
        loc: 'Yellow Room 101',
        img: 'https://images.unsplash.com/photo-1581093458791-9d42e1d6b770?w=400'
      },
      {
        name: 'UV aligner (MIDAS)',
        desc: 'MIDAS MDA-400M Mask Aligner',
        loc: 'Yellow Room 102',
        img: 'https://images.unsplash.com/photo-1581093458791-9d42e1d6b770?w=400'
      },
      {
        name: 'Spincoater (SUSS)',
        desc: 'SUSS MicroTec LabSpin',
        loc: 'Yellow Room 101',
        img: 'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=400'
      },
      {
        name: 'Spincoater (MIDAS)',
        desc: 'MIDAS Spin Coater',
        loc: 'Yellow Room 102',
        img: 'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=400'
      },
      {
        name: 'RIE (SORONA)',
        desc: 'Sorona Plasma Etch System',
        loc: 'Etch Lab 202',
        img: 'https://images.unsplash.com/photo-1606324331299-a26d6f6c1b43?w=400'
      },
      {
        name: 'ICP-RIE (OXFORD)',
        desc: 'Oxford Instruments Plasmalab System 100',
        loc: 'Etch Lab 201',
        img: 'https://images.unsplash.com/photo-1606324331299-a26d6f6c1b43?w=400'
      }
    ];

    for (const eq of equipments) {
      await Equipment.create(eq.name, eq.desc, eq.loc, eq.img);
    }
    console.log(`✓ Inserted ${equipments.length} equipments`);

  } catch (error) {
    console.error('Auto-seed error:', error);
  }
};

// Middleware
app.use(cors()); // Allow all origins for troubleshooting
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Mount manual equipment routes
app.use(['/equipment', '/api/equipment'], router);

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
