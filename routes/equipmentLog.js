const express = require('express');
const EquipmentLog = require('../models/EquipmentLog');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get logs for equipment (public for all authenticated users)
router.get('/equipment/:equipmentId', verifyToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const logs = await EquipmentLog.getByEquipment(req.params.equipmentId, limit);
        res.json(logs);
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: '이력 조회에 실패했습니다.' });
    }
});

// Add usage remark after using equipment
router.post('/equipment/:equipmentId', verifyToken, async (req, res) => {
    try {
        const { content, reservationId, logType } = req.body;
        const equipmentId = req.params.equipmentId;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: '내용을 입력해주세요.' });
        }

        const type = logType || 'usage_remark';
        const logId = await EquipmentLog.create(equipmentId, req.user.id, type, content, reservationId || null);

        res.status(201).json({
            message: '이력이 등록되었습니다.',
            logId
        });
    } catch (error) {
        console.error('Add log error:', error);
        res.status(500).json({ error: '이력 등록에 실패했습니다.' });
    }
});

// Get recent logs across all equipment (for admin dashboard)
router.get('/recent', verifyToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const logs = await EquipmentLog.getRecent(limit);
        res.json(logs);
    } catch (error) {
        console.error('Get recent logs error:', error);
        res.status(500).json({ error: '이력 조회에 실패했습니다.' });
    }
});

// Update log (author or admin only)
router.put('/:logId', verifyToken, async (req, res) => {
    try {
        const { content } = req.body;
        const logId = req.params.logId;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: '내용을 입력해주세요.' });
        }

        // Check permission
        const log = await EquipmentLog.findById(logId);
        if (!log) {
            return res.status(404).json({ error: '이력을 찾을 수 없습니다.' });
        }

        const isAuthor = log.user_id === req.user.id;
        const isAdmin = req.user.user_role === 'admin';

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ error: '이 이력을 수정할 권한이 없습니다.' });
        }

        await EquipmentLog.update(logId, content);
        res.json({ message: '이력이 수정되었습니다.' });
    } catch (error) {
        console.error('Update log error:', error);
        res.status(500).json({ error: '이력 수정에 실패했습니다.' });
    }
});

// Delete log (author or admin only)
router.delete('/:logId', verifyToken, async (req, res) => {
    try {
        const logId = req.params.logId;

        // Check permission
        const log = await EquipmentLog.findById(logId);
        if (!log) {
            return res.status(404).json({ error: '이력을 찾을 수 없습니다.' });
        }

        const isAuthor = log.user_id === req.user.id;
        const isAdmin = req.user.user_role === 'admin';

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ error: '이 이력을 삭제할 권한이 없습니다.' });
        }

        await EquipmentLog.delete(logId);
        res.json({ message: '이력이 삭제되었습니다.' });
    } catch (error) {
        console.error('Delete log error:', error);
        res.status(500).json({ error: '이력 삭제에 실패했습니다.' });
    }
});

module.exports = router;
