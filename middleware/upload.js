const multer = require('multer');
const path = require('path');

const fs = require('fs');

// Storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let dest = 'uploads/';
        if (file.fieldname === 'profile') dest += 'profiles/';
        else if (file.fieldname === 'pancard' || file.fieldname === 'aadhar_card') dest += 'kyc/';
        else if (file.fieldname === 'educational' || file.fieldname === 'experience_letter') dest += 'documents/';
        else if (file.fieldname === 'gig_image' || file.fieldname === 'thumbnail') dest += 'gigs/';
        else if (file.fieldname === 'image' || file.fieldname === 'category_image') dest += 'categories/';
        else if (file.fieldname === 'image1' || file.fieldname === 'image2' || file.fieldname === 'banner') dest += 'pages/';
        else if (file.fieldname === 'work_images' || file.fieldname === 'portfolio_image') dest += 'portfolio/';
        else if (file.fieldname === 'attachments') dest += 'projects/';
        
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Check file type
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname || mimetype) {
        return cb(null, true);
    } else {
        cb('Error: Only Images (JPEG, JPG, PNG, WEBP), PDFs, and Word Documents (DOC, DOCX) are allowed!');
    }
}

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit (documents can be larger)
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
});

module.exports = upload;
