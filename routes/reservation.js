const express = require('express');
const Reservation = require('../models/Reservation');
const Equipment = require('../models/Equipment');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all reservations (admin only)
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const reservations = await Reservation.getAll();
    res.json(reservations);
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ error: 'Failed to get reservations' });
  }
});

// Get reservations for equipment managers (limited to their managed equipment)
router.get('/manager', verifyToken, async (req, res) => {
  try {
    const Permission = require('../models/Permission');
    const managedEquipment = await Permission.getManagedEquipment(req.user.id);
    const equipmentIds = managedEquipment.map(e => e.id);

    if (equipmentIds.length === 0) {
      return res.json([]);
    }

    const reservations = await Reservation.getByEquipmentIds(equipmentIds);
    res.json(reservations);
  } catch (error) {
    console.error('Get manager reservations error:', error);
    res.status(500).json({ error: 'Failed to get reservations' });
  }
});

// Get current user's reservations
router.get('/my', verifyToken, async (req, res) => {
  try {
    const reservations = await Reservation.getByUserId(req.user.id);
    res.json(reservations);
  } catch (error) {
    console.error('Get user reservations error:', error);
    res.status(500).json({ error: 'Failed to get reservations' });
  }
});

// Get upcoming reservations
router.get('/upcoming', verifyToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const reservations = await Reservation.getUpcoming(limit);
    res.json(reservations);
  } catch (error) {
    console.error('Get upcoming reservations error:', error);
    res.status(500).json({ error: 'Failed to get upcoming reservations' });
  }
});

// Get reservations by equipment ID
router.get('/equipment/:id', verifyToken, async (req, res) => {
  try {
    const reservations = await Reservation.getByEquipmentId(req.params.id);
    res.json(reservations);
  } catch (error) {
    console.error('Get equipment reservations error:', error);
    res.status(500).json({ error: 'Failed to get equipment reservations' });
  }
});

// Get reservations by date range (for calendar view)
router.get('/range', verifyToken, async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const reservations = await Reservation.getByDateRange(start, end);
    res.json(reservations);
  } catch (error) {
    console.error('Get reservations by range error:', error);
    res.status(500).json({ error: 'Failed to get reservations' });
  }
});

// Get reservation by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Check if user owns this reservation or is admin
    if (reservation.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(reservation);
  } catch (error) {
    console.error('Get reservation error:', error);
    res.status(500).json({ error: 'Failed to get reservation' });
  }
});

// Check for reservation conflicts
router.post('/check-conflict', verifyToken, async (req, res) => {
  try {
    const { equipment_id, start_time, end_time, exclude_id } = req.body;

    if (!equipment_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'Equipment ID, start time, and end time are required' });
    }

    // Validate times
    const start = new Date(start_time);
    const end = new Date(end_time);

    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    const hasConflict = await Reservation.checkConflict(equipment_id, start_time, end_time, exclude_id);

    res.json({
      hasConflict,
      message: hasConflict ? 'Time slot is not available' : 'Time slot is available'
    });
  } catch (error) {
    console.error('Check conflict error:', error);
    res.status(500).json({ error: 'Failed to check conflict' });
  }
});

// Create new reservation
router.post('/', verifyToken, async (req, res) => {
  try {
    const { equipment_id, start_time, end_time, purpose } = req.body;

    // Validation
    if (!equipment_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'Equipment ID, start time, and end time are required' });
    }

    // Validate times
    const start = new Date(start_time);
    const end = new Date(end_time);
    const now = new Date();

    if (start < now) {
      return res.status(400).json({ error: 'Cannot create reservation in the past' });
    }

    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Check if equipment exists and is available
    const equipment = await Equipment.findById(equipment_id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    if (equipment.status !== 'available') {
      return res.status(400).json({ error: 'Equipment is not available' });
    }

    // Check for conflicts
    const hasConflict = await Reservation.checkConflict(equipment_id, start_time, end_time);
    if (hasConflict) {
      return res.status(409).json({ error: 'Time slot is already reserved' });
    }

    // Determine reservation status based on user permission level
    const Permission = require('../models/Permission');
    let initialStatus = 'pending'; // Default: needs approval

    // Admin is always auto-confirmed
    if (req.user.user_role === 'admin') {
      initialStatus = 'confirmed';
    } else {
      // Check permission level for this equipment
      const permission = await Permission.hasPermission(equipment_id, req.user.id);
      if (permission) {
        // autonomous and manager get auto-confirmed
        if (permission.permission_level === 'autonomous' || permission.permission_level === 'manager') {
          initialStatus = 'confirmed';
        }
        // normal stays as pending
      }
    }

    // Create reservation
    const reservationId = await Reservation.create(
      equipment_id,
      req.user.id,
      start_time,
      end_time,
      purpose || '',
      initialStatus
    );

    res.status(201).json({
      message: initialStatus === 'confirmed'
        ? '예약이 확정되었습니다.'
        : '예약이 등록되었습니다. 승인 대기 중입니다.',
      reservationId,
      status: initialStatus
    });
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// Update reservation
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { start_time, end_time, purpose, status } = req.body;

    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Check if user owns this reservation or is admin
    if (reservation.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If updating times, check for conflicts
    if (start_time && end_time) {
      const start = new Date(start_time);
      const end = new Date(end_time);

      if (end <= start) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }

      const hasConflict = await Reservation.checkConflict(
        reservation.equipment_id,
        start_time,
        end_time,
        req.params.id
      );

      if (hasConflict) {
        return res.status(409).json({ error: 'Time slot is already reserved' });
      }
    }

    await Reservation.update(
      req.params.id,
      start_time || reservation.start_time,
      end_time || reservation.end_time,
      purpose !== undefined ? purpose : reservation.purpose,
      status || reservation.status
    );

    res.json({ message: 'Reservation updated successfully' });
  } catch (error) {
    console.error('Update reservation error:', error);
    res.status(500).json({ error: 'Failed to update reservation' });
  }
});

// Cancel reservation
router.patch('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Check if user owns this reservation or is admin
    if (reservation.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Reservation.cancel(req.params.id);
    res.json({ message: 'Reservation cancelled successfully' });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

// Restore cancelled reservation (admin only)
router.patch('/:id/restore', verifyToken, isAdmin, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (reservation.status !== 'cancelled') {
      return res.status(400).json({ error: 'Only cancelled reservations can be restored' });
    }

    // Check for conflicts before restoring
    const hasConflict = await Reservation.checkConflict(
      reservation.equipment_id,
      reservation.start_time,
      reservation.end_time,
      req.params.id
    );

    if (hasConflict) {
      return res.status(409).json({ error: 'Cannot restore - time slot is now occupied by another reservation' });
    }

    await Reservation.update(
      req.params.id,
      reservation.start_time,
      reservation.end_time,
      reservation.purpose,
      'confirmed'
    );

    res.json({ message: 'Reservation restored successfully' });
  } catch (error) {
    console.error('Restore reservation error:', error);
    res.status(500).json({ error: 'Failed to restore reservation' });
  }
});

// Delete reservation (admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    await Reservation.delete(req.params.id);
    res.json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    console.error('Delete reservation error:', error);
    res.status(500).json({ error: 'Failed to delete reservation' });
  }
});

module.exports = router;
