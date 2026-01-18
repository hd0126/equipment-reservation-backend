require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./config/database');
const User = require('./models/User');
const Equipment = require('./models/Equipment');

// Import routes
const authRoutes = require('./routes/auth');
const equipmentRoutes = require('./routes/equipment');
const reservationRoutes = require('./routes/reservation');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/reservations', reservationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
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
      await Equipment.create('Microscope A', 'High-resolution optical microscope', 'Lab 101', 'https://images.unsplash.com/photo-1581093458791-9d42e1d6b770?w=400');
      await Equipment.create('3D Printer', 'Professional-grade 3D printer', 'Maker Space', 'https://images.unsplash.com/photo-1606324331299-a26d6f6c1b43?w=400');
      await Equipment.create('Oscilloscope', 'Digital storage oscilloscope', 'Electronics Lab', 'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=400');
      console.log('✓ Default equipment created');
    }
  } catch (error) {
    console.error('Auto-seed error:', error);
  }
};

// Initialize database and start server
initDatabase()
  .then(async () => {
    // Auto-seed default data
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

module.exports = app;
