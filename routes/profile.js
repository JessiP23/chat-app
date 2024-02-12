const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: './public/uploads/profiles/',
    filename: (req, file, callback) => {
        callback(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1000000
    },
}).single('profilePicture');

router.post('/upload-profile-picture', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to upload profile picture'});
        } else{
            req.user.profilePicture = '/uploads/profiles' + req.file.filename;
            req.user.save();
            res.json({ message: 'Profile picture uploaded successfully'});
        }
    });
});

module.exports = router;