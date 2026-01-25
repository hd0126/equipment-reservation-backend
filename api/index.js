require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('../config/database');
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

    // Check and create default equipment
    const allEquipment = await Equipment.findAll();
    if (allEquipment.length === 0) {
      const equipments = [
        {
          name: 'UV aligner (SUSS)',
          desc: 'SUSS MicroTec MA6 Mask Aligner for photolithography',
          loc: 'Yellow Room 101',
          img: 'https://images.unsplash.com/photo-1581093458791-9d42e1d6b770?w=400'
        },
        {
          name: 'UV aligner (MIDAS)',
          desc: 'MIDAS MDA-400M Mask Aligner (Contact/Proximity)',
          loc: 'Yellow Room 102',
          img: 'https://images.unsplash.com/photo-1581093458791-9d42e1d6b770?w=400'
        },
        {
          name: 'E-beam Evaporator',
          desc: 'Electron Beam Physical Vapor Deposition System',
          loc: 'Thin Film Lab',
          img: 'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=400'
        },
        {
          name: 'Sputter System',
          desc: 'RF/DC Magnetron Sputtering System for metal deposition',
          loc: 'Thin Film Lab',
          img: 'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=400'
        },
        {
          name: 'Reactive Ion Etcher (RIE)',
          desc: 'Plasma etching system for silicon and dielectrics',
          loc: 'Etch Lab 201',
          img: 'https://images.unsplash.com/photo-1606324331299-a26d6f6c1b43?w=400'
        },
        {
          name: 'FESEM',
          desc: 'Field Emission Scanning Electron Microscope',
          loc: 'Analysis Room',
          img: 'https://images.unsplash.com/photo-1581093458791-9d42e1d6b770?w=400'
        }
      ];

      for (const eq of equipments) {
        await Equipment.create(eq.name, eq.desc, eq.loc, eq.img);
      }
      console.log(`✓ Default ${equipments.length} equipments created`);
    }
  } catch (error) {
    console.error('Auto-seed error:', error);
  }
};

// Middleware
app.use(cors()); // Allow all origins for troubleshooting
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use(['/equipment', '/api/equipment'], equipmentRoutes);
app.use(['/reservations', '/api/reservations'], reservationRoutes);

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
