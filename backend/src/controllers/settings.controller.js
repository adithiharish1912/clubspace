const { Setting } = require('../models');
const { asyncHandler } = require('../utils/helpers');
const { uploadImage, deleteImage } = require('../services/upload.service');
const { isEmailConfigured } = require('../services/email.service');
const { isWhatsAppConfigured } = require('../services/whatsapp.service');
const { isCloudinaryConfigured } = require('../config/cloudinary');
const { isRazorpayConfigured, isDemoPaymentMode } = require('../config/razorpay');

const FIELDS = [
  'clubName', 'tagline', 'email', 'phone', 'address', 'website', 'gstNumber', 'currency',
  'membershipIdPrefix', 'receiptPrefix', 'reminderDaysBefore', 'emailNotifications',
  'whatsappNotifications', 'openingTime', 'closingTime',
];

// GET /api/settings/public – branding for login page etc. (no auth)
exports.publicInfo = asyncHandler(async (_req, res) => {
  const s = await Setting.get();
  res.json({ success: true, data: { clubName: s.clubName, tagline: s.tagline, logo: s.logo, currency: s.currency, phone: s.phone, email: s.email, address: s.address } });
});

// GET /api/settings (admin)
exports.get = asyncHandler(async (_req, res) => {
  const s = await Setting.get();
  res.json({
    success: true,
    data: {
      settings: s,
      integrations: {
        email: isEmailConfigured,
        whatsapp: isWhatsAppConfigured,
        cloudinary: isCloudinaryConfigured,
        razorpay: isRazorpayConfigured,
        demoPayments: isDemoPaymentMode,
      },
    },
  });
});

// PATCH /api/settings (superadmin) – multipart allowed for "logo"
exports.update = asyncHandler(async (req, res) => {
  const s = await Setting.get();
  FIELDS.forEach((k) => {
    if (req.body[k] === undefined) return;
    let v = req.body[k];
    if (k === 'reminderDaysBefore') {
      v = (Array.isArray(v) ? v : String(v).split(','))
        .map((x) => parseInt(x, 10))
        .filter((x) => x > 0 && x <= 60);
    }
    if (['emailNotifications', 'whatsappNotifications'].includes(k)) v = v === true || v === 'true';
    s[k] = v;
  });
  if (req.file) {
    const img = await uploadImage(req.file, 'branding');
    await deleteImage(s.logo?.publicId);
    s.logo = img;
  }
  await s.save();
  res.json({ success: true, data: s });
});
