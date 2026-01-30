const express = require('express');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { uploadToR2 } = require('../services/r2Storage');

const router = express.Router();

// 파일 업로드 (관리자 전용)
// POST /api/upload
// Body: JSON { file: base64 string, filename: string, type: 'brochure' | 'manual' | 'quick_guide', equipmentId: number }
router.post('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { file, filename, type, equipmentId } = req.body;

        if (!file || !filename || !type || !equipmentId) {
            return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
        }

        // 타입 검증
        const validTypes = ['brochure', 'manual', 'quick_guide'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: '유효하지 않은 문서 타입입니다.' });
        }

        // Base64를 Buffer로 변환
        const base64Data = file.replace(/^data:[^;]+;base64,/, '');
        const fileBuffer = Buffer.from(base64Data, 'base64');

        // 파일 크기 검증 (10MB 제한)
        const maxSize = 10 * 1024 * 1024;
        if (fileBuffer.length > maxSize) {
            return res.status(400).json({ error: '파일 크기는 10MB를 초과할 수 없습니다.' });
        }

        // 파일명 생성 (장비ID_타입_원본파일명)
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `equipment/${equipmentId}/${type}_${safeFilename}`;

        // 확장자에 따른 Content-Type 결정
        const ext = filename.split('.').pop().toLowerCase();
        const contentTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
        };
        const contentType = contentTypes[ext] || 'application/octet-stream';

        // R2에 업로드
        const url = await uploadToR2(fileBuffer, storagePath, contentType);

        if (!url) {
            return res.status(500).json({ error: 'R2 업로드 실패. 환경 변수를 확인하세요.' });
        }

        res.json({
            message: '파일 업로드 성공',
            url,
            type,
            equipmentId,
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
