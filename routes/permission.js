const express = require('express');
const Permission = require('../models/Permission');
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { get, query } = require('../config/database');

const router = express.Router();

// Middleware to check if user can manage equipment permissions
const canManageEquipment = async (req, res, next) => {
    const equipmentId = req.params.equipmentId || req.params.id;
    const userId = req.user.id;
    const userRole = req.user.user_role;

    // Admin can manage all
    if (userRole === 'admin') {
        return next();
    }

    // Check if user has manager permission for this equipment
    const canManage = await Permission.canManageEquipment(equipmentId, userId);
    if (canManage) {
        return next();
    }

    // Legacy: Equipment manager role can manage their own equipment
    if (userRole === 'equipment_manager') {
        const equipment = await get('SELECT manager_id FROM equipment WHERE id = $1', [equipmentId]);
        if (equipment && equipment.manager_id === userId) {
            return next();
        }
    }

    return res.status(403).json({ error: '이 장비의 권한을 관리할 수 없습니다.' });
};

// Get permissions for equipment
router.get('/equipment/:equipmentId', verifyToken, canManageEquipment, async (req, res) => {
    try {
        const permissions = await Permission.getByEquipment(req.params.equipmentId);
        res.json(permissions);
    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({ error: '권한 조회에 실패했습니다.' });
    }
});

// Get users without permission for equipment (candidates for granting)
router.get('/equipment/:equipmentId/candidates', verifyToken, canManageEquipment, async (req, res) => {
    try {
        const users = await Permission.getUsersWithoutPermission(req.params.equipmentId);
        res.json(users);
    } catch (error) {
        console.error('Get candidates error:', error);
        res.status(500).json({ error: '사용자 목록 조회에 실패했습니다.' });
    }
});

// Grant permission with level
router.post('/equipment/:equipmentId/grant', verifyToken, canManageEquipment, async (req, res) => {
    try {
        const { userId, permissionLevel } = req.body;
        const equipmentId = req.params.equipmentId;
        const granterId = req.user.id;
        const granterRole = req.user.user_role;

        if (!userId) {
            return res.status(400).json({ error: '사용자를 선택해주세요.' });
        }

        // Only admin can grant manager permission
        if (permissionLevel === 'manager' && granterRole !== 'admin') {
            return res.status(403).json({ error: '장비담당자 권한은 관리자만 부여할 수 있습니다.' });
        }

        const level = permissionLevel || 'normal';
        await Permission.grant(equipmentId, userId, granterId, level);
        res.json({ message: '권한이 부여되었습니다.' });
    } catch (error) {
        console.error('Grant permission error:', error);
        res.status(500).json({ error: '권한 부여에 실패했습니다.' });
    }
});

// Update permission level (alternative route for user management)
router.put('/equipment/:equipmentId/update', verifyToken, canManageEquipment, async (req, res) => {
    try {
        const { equipmentId } = req.params;
        const { userId, permissionLevel } = req.body;
        const granterRole = req.user.user_role;

        // Only admin can set manager permission
        if (permissionLevel === 'manager' && granterRole !== 'admin') {
            return res.status(403).json({ error: '장비담당자 권한은 관리자만 부여할 수 있습니다.' });
        }

        await Permission.updateLevel(equipmentId, userId, permissionLevel);
        res.json({ message: '권한이 수정되었습니다.' });
    } catch (error) {
        console.error('Update permission error:', error);
        res.status(500).json({ error: '권한 수정에 실패했습니다.' });
    }
});

// Update permission level
router.put('/equipment/:equipmentId/user/:userId', verifyToken, canManageEquipment, async (req, res) => {
    try {
        const { equipmentId, userId } = req.params;
        const { permissionLevel } = req.body;
        const granterRole = req.user.user_role;

        // Only admin can set manager permission
        if (permissionLevel === 'manager' && granterRole !== 'admin') {
            return res.status(403).json({ error: '장비담당자 권한은 관리자만 부여할 수 있습니다.' });
        }

        await Permission.updateLevel(equipmentId, userId, permissionLevel);
        res.json({ message: '권한이 수정되었습니다.' });
    } catch (error) {
        console.error('Update permission error:', error);
        res.status(500).json({ error: '권한 수정에 실패했습니다.' });
    }
});

// Revoke permission
router.delete('/equipment/:equipmentId/revoke/:userId', verifyToken, canManageEquipment, async (req, res) => {
    try {
        const { equipmentId, userId } = req.params;
        await Permission.revoke(equipmentId, userId);
        res.json({ message: '권한이 취소되었습니다.' });
    } catch (error) {
        console.error('Revoke permission error:', error);
        res.status(500).json({ error: '권한 취소에 실패했습니다.' });
    }
});

// Check if current user has permission for equipment (with level info)
router.get('/check/:equipmentId', verifyToken, async (req, res) => {
    try {
        const userRole = req.user.user_role;
        const equipmentId = req.params.equipmentId;
        const userId = req.user.id;

        // Admin always has full permission
        if (userRole === 'admin') {
            return res.json({ hasPermission: true, permissionLevel: 'admin', reason: 'admin' });
        }

        // Check explicit permission
        const permission = await Permission.hasPermission(equipmentId, userId);
        if (permission) {
            return res.json({
                hasPermission: true,
                permissionLevel: permission.permission_level,
                reason: 'granted'
            });
        }

        res.json({ hasPermission: false, permissionLevel: null, reason: 'none' });
    } catch (error) {
        console.error('Check permission error:', error);
        res.status(500).json({ error: '권한 확인에 실패했습니다.' });
    }
});

// Get all permissions for current user
router.get('/my', verifyToken, async (req, res) => {
    try {
        const permissions = await Permission.getByUser(req.user.id);
        res.json(permissions);
    } catch (error) {
        console.error('Get my permissions error:', error);
        res.status(500).json({ error: '권한 조회에 실패했습니다.' });
    }
});

// Get equipment that current user manages
router.get('/my/managed', verifyToken, async (req, res) => {
    try {
        const managedEquipment = await Permission.getManagedEquipment(req.user.id);
        res.json(managedEquipment);
    } catch (error) {
        console.error('Get managed equipment error:', error);
        res.status(500).json({ error: '관리 장비 조회에 실패했습니다.' });
    }
});

// Get permissions for specific user (admin or equipment manager)
router.get('/user/:userId', verifyToken, async (req, res) => {
    try {
        const requesterId = req.user.id;
        const requesterRole = req.user.user_role;

        let permissions = await Permission.getByUser(req.params.userId);

        // 장비담당자면 본인이 관리하는 장비에 대한 권한만 반환
        if (requesterRole !== 'admin') {
            const managedEquipment = await Permission.getManagedEquipment(requesterId);
            const managedIds = managedEquipment.map(e => e.id);

            if (managedIds.length === 0) {
                return res.status(403).json({ error: '권한이 없습니다.' });
            }

            permissions = permissions.filter(p => managedIds.includes(p.equipment_id));
        }

        res.json(permissions);
    } catch (error) {
        console.error('Get user permissions error:', error);
        res.status(500).json({ error: '권한 조회에 실패했습니다.' });
    }
});

// Grant permission to user for specific equipment (from user management view)
router.post('/user/:userId/equipment/:equipmentId', verifyToken, async (req, res) => {
    try {
        const { userId, equipmentId } = req.params;
        const { permissionLevel } = req.body;
        const granterId = req.user.id;
        const granterRole = req.user.user_role;

        // Check if granter can manage this equipment
        if (granterRole !== 'admin') {
            const canManage = await Permission.canManageEquipment(equipmentId, granterId);
            if (!canManage) {
                return res.status(403).json({ error: '이 장비의 권한을 관리할 수 없습니다.' });
            }
            // Non-admin cannot grant manager permission
            if (permissionLevel === 'manager') {
                return res.status(403).json({ error: '장비담당자 권한은 관리자만 부여할 수 있습니다.' });
            }
        }

        await Permission.grant(equipmentId, userId, granterId, permissionLevel || 'normal');
        res.json({ message: '권한이 부여되었습니다.' });
    } catch (error) {
        console.error('Grant permission error:', error);
        res.status(500).json({ error: '권한 부여에 실패했습니다.' });
    }
});

// Revoke permission from user for specific equipment (from user management view)
router.delete('/user/:userId/equipment/:equipmentId', verifyToken, async (req, res) => {
    try {
        const { userId, equipmentId } = req.params;
        const granterId = req.user.id;
        const granterRole = req.user.user_role;

        // Check if granter can manage this equipment
        if (granterRole !== 'admin') {
            const canManage = await Permission.canManageEquipment(equipmentId, granterId);
            if (!canManage) {
                return res.status(403).json({ error: '이 장비의 권한을 관리할 수 없습니다.' });
            }
        }

        await Permission.revoke(equipmentId, userId);
        res.json({ message: '권한이 취소되었습니다.' });
    } catch (error) {
        console.error('Revoke permission error:', error);
        res.status(500).json({ error: '권한 취소에 실패했습니다.' });
    }
});

// Get permission summary for admin dashboard
router.get('/summary', verifyToken, isAdmin, async (req, res) => {
    try {
        const userSummary = await query(`
            SELECT u.id, u.username, u.department, u.user_role, u.phone, u.created_at,
                   (SELECT COUNT(*) FROM equipment_permissions ep 
                    JOIN equipment e ON ep.equipment_id = e.id 
                    WHERE ep.user_id = u.id) as permission_count
            FROM users u
            ORDER BY u.id ASC
        `);

        const equipmentSummary = await query(`
            SELECT e.id, e.name, u.username as manager_name,
                   (SELECT COUNT(*) FROM equipment_permissions WHERE equipment_id = e.id) as permission_count
            FROM equipment e
            LEFT JOIN users u ON e.manager_id = u.id
            ORDER BY e.name
        `);

        res.json({ userSummary, equipmentSummary });
    } catch (error) {
        console.error('Get permission summary error:', error);
        res.status(500).json({ error: '권한 현황 조회에 실패했습니다.' });
    }
});

// Get summary for equipment managers (limited to their managed equipment)
router.get('/summary/manager', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Manager summary request from user:', userId);

        // Get equipment IDs that user manages
        const managedEquipment = await Permission.getManagedEquipment(userId);
        console.log('Managed equipment:', managedEquipment);

        const equipmentIds = managedEquipment.map(e => e.id);

        if (equipmentIds.length === 0) {
            console.log('No managed equipment found for user:', userId);
            return res.json({ userSummary: [], equipmentSummary: [], managedEquipmentIds: [] });
        }

        // Use simpler queries to avoid placeholder issues
        const userSummary = [];
        const usersWithPermission = await query(`
            SELECT DISTINCT u.id, u.username, u.department, u.user_role, u.phone, u.created_at
            FROM users u
            JOIN equipment_permissions ep ON u.id = ep.user_id
            WHERE ep.equipment_id = ANY($1)
            ORDER BY u.id ASC
        `, [equipmentIds]);

        for (const user of usersWithPermission) {
            const countResult = await get(`
                SELECT COUNT(*) as cnt FROM equipment_permissions 
                WHERE user_id = $1 AND equipment_id = ANY($2)
            `, [user.id, equipmentIds]);
            userSummary.push({
                ...user,
                permission_count: parseInt(countResult?.cnt || 0)
            });
        }

        // Get managed equipment summary
        const equipmentSummary = await query(`
            SELECT e.id, e.name, u.username as manager_name,
                   (SELECT COUNT(*) FROM equipment_permissions WHERE equipment_id = e.id) as permission_count
            FROM equipment e
            LEFT JOIN users u ON e.manager_id = u.id
            WHERE e.id = ANY($1)
            ORDER BY e.name
        `, [equipmentIds]);

        console.log('Manager summary success - users:', userSummary.length, 'equipment:', equipmentSummary.length);
        res.json({ userSummary, equipmentSummary, managedEquipmentIds: equipmentIds });
    } catch (error) {
        console.error('Get manager summary error:', error.message, error.stack);
        res.status(500).json({ error: '권한 현황 조회에 실패했습니다.', details: error.message });
    }
});

module.exports = router;
