const { query, run, get } = require('../config/database');

class Reservation {
  // Create new reservation
  static async create(equipmentId, userId, startTime, endTime, purpose, status = 'confirmed') {
    const sql = `
      INSERT INTO reservations (equipment_id, user_id, start_time, end_time, purpose, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const result = await get(sql, [equipmentId, userId, startTime, endTime, purpose, status]);
    return result.id;
  }

  // Check for conflicting reservations
  static async checkConflict(equipmentId, startTime, endTime, excludeReservationId = null) {
    let sql = `
      SELECT * FROM reservations 
      WHERE equipment_id = $1 
      AND status != 'cancelled'
      AND (
        (start_time <= $2 AND end_time > $2) OR
        (start_time < $3 AND end_time >= $3) OR
        (start_time >= $2 AND end_time <= $3)
      )
    `;
    let params = [equipmentId, startTime, endTime];

    if (excludeReservationId) {
      sql += ' AND id != $4';
      params.push(excludeReservationId);
    }

    const conflicts = await query(sql, params);
    return conflicts.length > 0;
  }

  // Get all reservations with user and equipment info
  static async getAll() {
    const sql = `
      SELECT 
        r.*,
        u.username,
        u.email,
        e.name as equipment_name,
        e.location as equipment_location
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN equipment e ON r.equipment_id = e.id
      ORDER BY r.start_time DESC
    `;
    return await query(sql);
  }

  // Get reservations by user ID
  static async getByUserId(userId) {
    const sql = `
      SELECT 
        r.*,
        e.name as equipment_name,
        e.location as equipment_location
      FROM reservations r
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.user_id = $1
      ORDER BY r.start_time DESC
    `;
    return await query(sql, [userId]);
  }

  // Get reservations by equipment ID
  static async getByEquipmentId(equipmentId) {
    const sql = `
      SELECT 
        r.*,
        u.username,
        u.email
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      WHERE r.equipment_id = $1 AND r.status != 'cancelled'
      ORDER BY r.start_time ASC
    `;
    return await query(sql, [equipmentId]);
  }

  // Get reservation by ID
  static async findById(id) {
    const sql = `
      SELECT 
        r.*,
        u.username,
        u.email,
        e.name as equipment_name,
        e.location as equipment_location
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.id = $1
    `;
    return await get(sql, [id]);
  }

  // Update reservation
  static async update(id, startTime, endTime, purpose, status) {
    const sql = `
      UPDATE reservations 
      SET start_time = $1, end_time = $2, purpose = $3, status = $4
      WHERE id = $5
    `;
    return await run(sql, [startTime, endTime, purpose, status, id]);
  }

  // Cancel reservation
  static async cancel(id) {
    const sql = 'UPDATE reservations SET status = $1 WHERE id = $2';
    return await run(sql, ['cancelled', id]);
  }

  // Delete reservation
  static async delete(id) {
    const sql = 'DELETE FROM reservations WHERE id = $1';
    return await run(sql, [id]);
  }

  // Get upcoming reservations
  static async getUpcoming(limit = 10) {
    const sql = `
      SELECT 
        r.*,
        u.username,
        e.name as equipment_name
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.start_time >= NOW() AND r.status = 'confirmed'
      ORDER BY r.start_time ASC
      LIMIT $1
    `;
    return await query(sql, [limit]);
  }

  // Get reservations in date range
  static async getByDateRange(startDate, endDate) {
    const sql = `
      SELECT 
        r.*,
        u.username,
        e.name as equipment_name,
        e.location as equipment_location
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.start_time >= $1 AND r.end_time <= $2 AND r.status != 'cancelled'
      ORDER BY r.start_time ASC
    `;
    return await query(sql, [startDate, endDate]);
  }
}

module.exports = Reservation;
