const { query, run, get } = require('../config/database');

class Equipment {
  // Create new equipment
  static async create(name, description, location, status = 'available', imageUrl = null) {
    const sql = `
      INSERT INTO equipment (name, description, location, status, image_url)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await run(sql, [name, description, location, status, imageUrl]);
    return result.id;
  }

  // Get all equipment
  static async getAll() {
    const sql = 'SELECT * FROM equipment ORDER BY created_at DESC';
    return await query(sql);
  }

  // Get equipment by ID
  static async findById(id) {
    const sql = 'SELECT * FROM equipment WHERE id = ?';
    return await get(sql, [id]);
  }

  // Update equipment
  static async update(id, name, description, location, status, imageUrl) {
    const sql = `
      UPDATE equipment 
      SET name = ?, description = ?, location = ?, status = ?, image_url = ?
      WHERE id = ?
    `;
    return await run(sql, [name, description, location, status, imageUrl, id]);
  }

  // Delete equipment
  static async delete(id) {
    const sql = 'DELETE FROM equipment WHERE id = ?';
    return await run(sql, [id]);
  }

  // Get available equipment
  static async getAvailable() {
    const sql = 'SELECT * FROM equipment WHERE status = ? ORDER BY name';
    return await query(sql, ['available']);
  }

  // Update equipment status
  static async updateStatus(id, status) {
    const sql = 'UPDATE equipment SET status = ? WHERE id = ?';
    return await run(sql, [status, id]);
  }
}

module.exports = Equipment;
