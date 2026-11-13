const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

const LOCAL_DIR = path.join(__dirname, '..', '..', 'uploads');

/**
 * Stores an uploaded image buffer. Uses Cloudinary when configured,
 * otherwise falls back to local disk (development only).
 * Returns { url, publicId }.
 */
async function uploadImage(file, folder = 'clubspace') {
  if (!file) return null;
  if (isCloudinaryConfigured) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }] },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  fs.mkdirSync(path.join(LOCAL_DIR, folder), { recursive: true });
  const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(LOCAL_DIR, folder, name), file.buffer);
  return { url: `/uploads/${folder}/${name}`, publicId: `local:${folder}/${name}` };
}

async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    if (publicId.startsWith('local:')) {
      const p = path.join(LOCAL_DIR, publicId.slice(6));
      if (p.startsWith(LOCAL_DIR) && fs.existsSync(p)) fs.unlinkSync(p);
    } else if (isCloudinaryConfigured) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (err) {
    console.warn('[upload] could not delete image', publicId, err.message);
  }
}

module.exports = { uploadImage, deleteImage, LOCAL_DIR };
