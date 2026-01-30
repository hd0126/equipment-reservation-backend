const { query, run, get } = require('../config/database');

class Permission {
    // Grant permission to user for equipment
    static async grant(equipmentId, userId, grantedBy) {
        const sql = `
      INSERT INTO equipment_permissions (equipment_id, user_id, granted_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (equipment_id, user_id) DO NOTHING
      RETURNING id
    `;
        return await get(sql, [equipmentId, userId, grantedBy]);
    }

    // Revoke permission
    static async revoke(equipmentId, userId) {
        const sql = 'DELETE FROM equipment_permissions WHERE equipment_id = $1 AND user_id = $2';
        return await run(sql, [equipmentId, userId]);
    }

    // Check if user has permission for equipment
    static async hasPermission(equipmentId, userId) {
        const sql = 'SELECT id FROM equipment_permissions WHERE equipment_id = $1 AND user_id = $2';
        const result = await get(sql, [equipmentId, userId]);
        return !!result;
    }

    // Get all users with permission for equipment
    static async getByEquipment(equipmentId) {
        const sql = `
      SELECT ep.*, u.username, u.email, u.department, u.user_role,
             g.username as granted_by_name
      FROM equipment_permissions ep
      JOIN users u ON ep.user_id = u.id
      LEFT JOIN users g ON ep.granted_by = g.id
      WHERE ep.equipment_id = $1
      ORDER BY ep.granted_at DESC
    `;
        return await query(sql, [equipmentId]);
    }

    // Get all equipment permissions for user
    static async getByUser(userId) {
        const sql = `
      SELECT ep.*, e.name as equipment_name, e.location
      FROM equipment_permissions ep
      JOIN equipment e ON ep.equipment_id = e.id
      WHERE ep.user_id = $1
      ORDER BY ep.granted_at DESC
    `;
        return await query(sql, [userId]);
    }

    // Get users without permission for specific equipment (for granting)
    static async getUsersWithoutPermission(equipmentId) {
        const sql = `
      SELECT id, username, email, department, user_role
      FROM users
      WHERE id NOT IN (
        SELECT user_id FROM equipment_permissions WHERE equipment_id = $1
      )
      AND user_role IN ('intern', 'student', 'staff')
      ORDER BY department, username
    `;
        return await query(sql, [equipmentId]);
    }
}

module.exports = Permission;
