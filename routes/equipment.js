const express = require('express');
const Equipment = require('../models/Equipment');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all equipment (public)
router.get('/', async (req, res) => {
  try {
    const equipment = await Equipment.getAll();
    res.json(equipment);
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({ error: 'Failed to get equipment' });
  }
});

// Get available equipment (public)
router.get('/available', async (req, res) => {
  try {
    const equipment = await Equipment.getAvailable();
    res.json(equipment);
  } catch (error) {
    console.error('Get available equipment error:', error);
    res.status(500).json({ error: 'Failed to get available equipment' });
  }
});

// Get equipment by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json(equipment);
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({ error: 'Failed to get equipment' });
  }
});

// Create equipment (admin only)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, description, location, status, image_url } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Equipment name is required' });
    }

    const equipmentId = await Equipment.create(name, description, location, status, image_url);
    res.status(201).json({
      message: 'Equipment created successfully',
      equipmentId
    });
  } catch (error) {
    console.error('Create equipment error:', error);
    res.status(500).json({ error: 'Failed to create equipment' });
  }
});

// Update equipment (admin only)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, description, location, status, image_url } = req.body;

    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    await Equipment.update(
      req.params.id,
      name || equipment.name,
      description || equipment.description,
      location || equipment.location,
      status || equipment.status,
      image_url !== undefined ? image_url : equipment.image_url
    );

    res.json({ message: 'Equipment updated successfully' });
  } catch (error) {
    console.error('Update equipment error:', error);
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

// Update equipment status (admin only)
router.patch('/:id/status', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['available', 'maintenance'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (available/maintenance)' });
    }

    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    await Equipment.updateStatus(req.params.id, status);
    res.json({ message: 'Equipment status updated successfully' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update equipment status' });
  }
});

// Delete equipment (admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    await Equipment.delete(req.params.id);
    res.json({ message: 'Equipment deleted successfully' });
  } catch (error) {
    console.error('Delete equipment error:', error);
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

module.exports = router;
