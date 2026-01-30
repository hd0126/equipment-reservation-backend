const express = require('express');
const Permission = require('../models/Permission');
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { get } = require('../config/database');

const router = express.Router();

// Middleware to check if user can manage equipment permissions
const canManageEquipment = async (req, res, next) => {
    const { equipmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.user_role;

    // Admin can manage all
    if (userRole === 'admin') {
        return next();
    }

    // Equipment manager can manage their own equipment
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

// Grant permission
router.post('/equipment/:equipmentId/grant', verifyToken, canManageEquipment, async (req, res) => {
    try {
        const { userId } = req.body;
        const equipmentId = req.params.equipmentId;

        if (!userId) {
            return res.status(400).json({ error: '사용자를 선택해주세요.' });
        }

        await Permission.grant(equipmentId, userId, req.user.id);
        res.json({ message: '권한이 부여되었습니다.' });
    } catch (error) {
        console.error('Grant permission error:', error);
        res.status(500).json({ error: '권한 부여에 실패했습니다.' });
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

// Check if current user has permission for equipment
router.get('/check/:equipmentId', verifyToken, async (req, res) => {
    try {
        const userRole = req.user.user_role;

        // Managers and admins always have permission
        if (User.isManager(userRole)) {
            return res.json({ hasPermission: true, reason: 'manager' });
        }

        // Check explicit permission
        const hasPermission = await Permission.hasPermission(req.params.equipmentId, req.user.id);
        res.json({ hasPermission, reason: hasPermission ? 'granted' : 'none' });
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

module.exports = router;
