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

    // Drop and recreate tables to fix schema issues (VARCHAR limit)
    // Force reset equipment data for update
    // Note: We use run() which was imported from database config
    try {
      await run('DELETE FROM equipment');
      console.log('⚠ Equipment table cleared for update v2');

      // Recreate Equipment table with TEXT type for flexibility
      await run(`
        CREATE TABLE IF NOT EXISTS equipment (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          location TEXT,
          status TEXT DEFAULT 'available',
          image_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Recreate Reservations table
      await run(`
        CREATE TABLE IF NOT EXISTS reservations (
          id SERIAL PRIMARY KEY,
          equipment_id INTEGER NOT NULL REFERENCES equipment(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          purpose TEXT,
          status TEXT DEFAULT 'confirmed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Tables recreated with TEXT types');
    } catch (e) {
      console.error('Schema update failed:', e);
    }

    const equipments = [
      {
        name: 'UV aligner (SUSS)',
        desc: 'SUSS MicroTec MA6 Mask Aligner for photolithography',
        loc: 'Yellow Room 101',
        img: 'https://cdn.pixabay.com/photo/2019/06/18/06/33/microscope-4281729_1280.jpg' // Represents alignment system
      },
      {
        name: 'UV aligner (MIDAS)',
        desc: 'MIDAS MDA-400M Mask Aligner (Contact/Proximity)',
        loc: 'Yellow Room 102',
        img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Mask_Aligner.jpg/640px-Mask_Aligner.jpg' // Generic Mask Aligner
      },
      {
        name: 'E-beam Evaporator',
        desc: 'Electron Beam Physical Vapor Deposition System',
        loc: 'Thin Film Lab',
        img: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/PVD_coating_machine.jpg'
      },
      {
        name: 'Sputter System',
        desc: 'RF/DC Magnetron Sputtering System for metal deposition',
        loc: 'Thin Film Lab',
        img: 'https://live.staticflickr.com/65535/49692468301_f2b9b5a5b5_b.jpg' // Vacuum chamber look
      },
      {
        name: 'Reactive Ion Etcher (RIE)',
        desc: 'Plasma etching system for silicon and dielectrics',
        loc: 'Etch Lab 201',
        img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Plasma_etcher.jpg/640px-Plasma_etcher.jpg'
      },
      {
        name: 'FESEM',
        desc: 'Field Emission Scanning Electron Microscope',
        loc: 'Analysis Room',
        img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Electron_Microscope.jpg/640px-Electron_Microscope.jpg'
      },
      {
        name: 'Spincoater (SUSS)',
        desc: 'SUSS MicroTec LabSpin for photoresist coating',
        loc: 'Yellow Room 101',
        img: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Spin_coater.jpg'
      },
      {
        name: 'Spincoater (MIDAS)',
        desc: 'MIDAS Spin Coater for general purpose',
        loc: 'Yellow Room 102',
        img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Spin_coating.jpg/640px-Spin_coating.jpg'
      },
      {
        name: 'RIE (SORONA)',
        desc: 'Sorona Plasma Etch System',
        loc: 'Etch Lab 202',
        img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Plasma_etcher.jpg/640px-Plasma_etcher.jpg' // Similar RIE
      },
      {
        name: 'ICP-RIE (OXFORD)',
        desc: 'Oxford Instruments Plasmalab System 100',
        loc: 'Etch Lab 201',
        img: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Oxford_PlasmaLab_80_Plus.jpg'
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

// Update equipment
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, description, location, status } = req.body;
    let image_url = req.body.image_url;

    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const mimeType = req.file.mimetype;
      image_url = `data:${mimeType};base64,${b64}`;
    }

    const data = { name, description, location, status };
    if (image_url) data.image_url = image_url;

    await Equipment.update(req.params.id, data);
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
