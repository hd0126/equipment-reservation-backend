const { query, run, get } = require('../config/database');

class Permission {
  // Permission levels
  static LEVELS = {
    NORMAL: 'normal',       // 일반사용자 - 승인 필요
    AUTONOMOUS: 'autonomous', // 자율사용자 - 즉시 승인
    MANAGER: 'manager'      // 장비담당자 - 권한 관리 가능
  };

  // Grant permission to user for equipment with level
  static async grant(equipmentId, userId, grantedBy, permissionLevel = 'normal') {
    const sql = `
      INSERT INTO equipment_permissions (equipment_id, user_id, granted_by, permission_level)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (equipment_id, user_id) 
      DO UPDATE SET permission_level = $4, granted_by = $3, granted_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    return await get(sql, [equipmentId, userId, grantedBy, permissionLevel]);
  }

  // Update permission level
  static async updateLevel(equipmentId, userId, permissionLevel) {
    const sql = `
      UPDATE equipment_permissions 
      SET permission_level = $3 
      WHERE equipment_id = $1 AND user_id = $2
    `;
    return await run(sql, [equipmentId, userId, permissionLevel]);
  }

  // Revoke permission
  static async revoke(equipmentId, userId) {
    const sql = 'DELETE FROM equipment_permissions WHERE equipment_id = $1 AND user_id = $2';
    return await run(sql, [equipmentId, userId]);
  }

  // Check if user has permission for equipment (returns permission details)
  static async hasPermission(equipmentId, userId) {
    const sql = 'SELECT id, permission_level FROM equipment_permissions WHERE equipment_id = $1 AND user_id = $2';
    const result = await get(sql, [equipmentId, userId]);
    return result;
  }

  // Check if user can manage equipment permissions (is manager for this equipment)
  static async canManageEquipment(equipmentId, userId) {
    const sql = `
      SELECT ep.permission_level 
      FROM equipment_permissions ep
      WHERE ep.equipment_id = $1 AND ep.user_id = $2 AND ep.permission_level = 'manager'
    `;
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
      ORDER BY 
        CASE ep.permission_level 
          WHEN 'manager' THEN 1 
          WHEN 'autonomous' THEN 2 
          ELSE 3 
        END,
        ep.granted_at DESC
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

  // Get equipment list that user manages (permission_level = 'manager')
  static async getManagedEquipment(userId) {
    const sql = `
      SELECT e.id, e.name, e.location
      FROM equipment e
      JOIN equipment_permissions ep ON e.id = ep.equipment_id
      WHERE ep.user_id = $1 AND ep.permission_level = 'manager'
      ORDER BY e.name
    `;
    return await query(sql, [userId]);
  }
}

module.exports = Permission;
