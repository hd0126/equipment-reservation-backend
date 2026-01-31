const { query, run, get } = require('../config/database');

class Equipment {
  // Create new equipment
  static async create(name, description, location, status = 'available', imageUrl = null, brochureUrl = null, manualUrl = null, quickGuideUrl = null, imageFileUrl = null) {
    const sql = `
      INSERT INTO equipment (name, description, location, status, image_url, brochure_url, manual_url, quick_guide_url, image_file_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    const result = await get(sql, [name, description, location, status, imageUrl, brochureUrl, manualUrl, quickGuideUrl, imageFileUrl]);
    return result.id;
  }

  // Get all equipment
  static async findAll() {
    const sql = 'SELECT * FROM equipment ORDER BY created_at DESC';
    return await query(sql);
  }

  // Get all equipment with manager info (alias)
  static async getAll() {
    const sql = `
      SELECT e.*, 
             m.username as manager_name
      FROM equipment e
      LEFT JOIN (
        SELECT DISTINCT ON (ep.equipment_id) ep.equipment_id, u.username
        FROM equipment_permissions ep
        JOIN users u ON ep.user_id = u.id
        WHERE ep.permission_level = 'manager'
        ORDER BY ep.equipment_id, ep.granted_at DESC
      ) m ON e.id = m.equipment_id
      ORDER BY e.created_at DESC
    `;
    return await query(sql);
  }

  // Get equipment by ID
  static async findById(id) {
    const sql = 'SELECT * FROM equipment WHERE id = $1';
    return await get(sql, [id]);
  }

  // Update equipment
  static async update(id, name, description, location, status, imageUrl, brochureUrl = null, manualUrl = null, quickGuideUrl = null, imageFileUrl = null) {
    const sql = `
      UPDATE equipment 
      SET name = $1, description = $2, location = $3, status = $4, image_url = $5, brochure_url = $6, manual_url = $7, quick_guide_url = $8, image_file_url = $9
      WHERE id = $10
    `;
    return await run(sql, [name, description, location, status, imageUrl, brochureUrl, manualUrl, quickGuideUrl, imageFileUrl, id]);
  }

  // Delete equipment
  static async delete(id) {
    const sql = 'DELETE FROM equipment WHERE id = $1';
    return await run(sql, [id]);
  }

  // Get available equipment
  static async getAvailable() {
    const sql = 'SELECT * FROM equipment WHERE status = $1 ORDER BY name';
    return await query(sql, ['available']);
  }

  // Update equipment status
  static async updateStatus(id, status) {
    const sql = 'UPDATE equipment SET status = $1 WHERE id = $2';
    return await run(sql, [status, id]);
  }
}

module.exports = Equipment;
