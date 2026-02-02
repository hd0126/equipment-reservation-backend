const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

// R2 클라이언트 설정 (Cloudflare R2는 S3 호환)
const getR2Client = () => {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
        console.warn('⚠️ R2 credentials not configured');
        return null;
    }

    return new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });
};

/**
 * 파일을 R2에 업로드
 * @param {Buffer} fileBuffer - 파일 버퍼
 * @param {string} filename - 저장할 파일명
 * @param {string} contentType - MIME 타입
 * @returns {string|null} - 공개 URL 또는 null
 */
const uploadToR2 = async (fileBuffer, filename, contentType = 'application/pdf') => {
    const client = getR2Client();
    if (!client) {
        console.error('R2 client not available');
        return null;
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL; // e.g., https://pub-xxx.r2.dev

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: filename,
            Body: fileBuffer,
            ContentType: contentType,
        }));

        // 공개 URL 반환
        const url = publicUrl ? `${publicUrl}/${filename}` : null;
        console.log(`✅ Uploaded to R2: ${filename}`);
        return url;
    } catch (error) {
        console.error('R2 upload error:', error);
        throw error;
    }
};

/**
 * R2에서 파일 삭제
 * @param {string} filename - 삭제할 파일명
 */
const deleteFromR2 = async (filename) => {
    const client = getR2Client();
    if (!client) return;

    const bucketName = process.env.R2_BUCKET_NAME;

    try {
        await client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: filename,
        }));
        console.log(`🗑️ Deleted from R2: ${filename}`);
    } catch (error) {
        console.error('R2 delete error:', error);
    }
};

/**
 * R2에서 파일 가져오기 (프록시 이미지 제공용)
 * @param {string} filename - 가져올 파일명 (경로 포함)
 * @returns {Object|null} - S3 GetObject 응답 (Body, ContentType 등) 또는 null
 */
const getFromR2 = async (filename) => {
    const client = getR2Client();
    if (!client) {
        console.error('R2 client not available');
        return null;
    }

    const bucketName = process.env.R2_BUCKET_NAME;

    try {
        const response = await client.send(new GetObjectCommand({
            Bucket: bucketName,
            Key: filename,
        }));
        console.log(`📥 Retrieved from R2: ${filename}`);
        return response;
    } catch (error) {
        console.error('R2 get error:', error);
        return null;
    }
};

module.exports = {
    uploadToR2,
    deleteFromR2,
    getFromR2,
};
