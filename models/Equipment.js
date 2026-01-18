const { query, run, get } = require('../config/database');

class Equipment {
  // Create new equipment
  static async create(name, description, location, status = 'available', imageUrl = null) {
    const sql = `
      INSERT INTO equipment (name, description, location, status, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const result = await get(sql, [name, description, location, status, imageUrl]);
    return result.id;
  }

  // Get all equipment
  static async findAll() {
    const sql = 'SELECT * FROM equipment ORDER BY created_at DESC';
    return await query(sql);
  }

  // Get all equipment (alias)
  static async getAll() {
    return await this.findAll();
  }

  // Get equipment by ID
  static async findById(id) {
    const sql = 'SELECT * FROM equipment WHERE id = $1';
    return await get(sql, [id]);
  }

  // Update equipment
  static async update(id, name, description, location, status, imageUrl) {
    const sql = `
      UPDATE equipment 
      SET name = $1, description = $2, location = $3, status = $4, image_url = $5
      WHERE id = $6
    `;
    return await run(sql, [name, description, location, status, imageUrl, id]);
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
