const { query, run, get } = require('../config/database');

class EquipmentLog {
  // Add log entry
  static async create(equipmentId, userId, logType, content, reservationId = null) {
    const sql = `
      INSERT INTO equipment_logs (equipment_id, user_id, log_type, content, reservation_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const result = await get(sql, [equipmentId, userId, logType, content, reservationId]);
    return result ? result.id : null;
  }

  // Get logs for equipment (newest first)
  static async getByEquipment(equipmentId, limit = 10) {
    const sql = `
      SELECT el.*, u.username, u.department
      FROM equipment_logs el
      LEFT JOIN users u ON el.user_id = u.id
      WHERE el.equipment_id = $1
      ORDER BY el.created_at DESC
      LIMIT $2
    `;
    return await query(sql, [equipmentId, limit]);
  }

  // Get logs for reservation
  static async getByReservation(reservationId) {
    const sql = `
      SELECT el.*, u.username
      FROM equipment_logs el
      LEFT JOIN users u ON el.user_id = u.id
      WHERE el.reservation_id = $1
      ORDER BY el.created_at DESC
    `;
    return await query(sql, [reservationId]);
  }

  // Get recent logs across all equipment
  static async getRecent(limit = 20) {
    const sql = `
      SELECT el.*, u.username, e.name as equipment_name
      FROM equipment_logs el
      LEFT JOIN users u ON el.user_id = u.id
      LEFT JOIN equipment e ON el.equipment_id = e.id
      ORDER BY el.created_at DESC
      LIMIT $1
    `;
    return await query(sql, [limit]);
  }

  // Delete log entry
  static async delete(logId) {
    const sql = 'DELETE FROM equipment_logs WHERE id = $1';
    return await run(sql, [logId]);
  }

  // Find log by ID
  static async findById(logId) {
    const sql = `
          SELECT el.*, u.username, u.department
          FROM equipment_logs el
          LEFT JOIN users u ON el.user_id = u.id
          WHERE el.id = $1
        `;
    return await get(sql, [logId]);
  }

  // Update log content
  static async update(logId, content) {
    const sql = 'UPDATE equipment_logs SET content = $1 WHERE id = $2';
    return await run(sql, [content, logId]);
  }
}

module.exports = EquipmentLog;
