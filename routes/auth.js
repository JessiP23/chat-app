const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const router = express.Router();
const nodemailer = require('nodemailer');

// Registration route
router.post('/register', async (req, res, next) => {
  try {
    // Replace 'User' with your actual Mongoose model
    const User = mongoose.model('User');
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({
      username: req.body.username,
      password: hashedPassword,
    });
    await user.save();
    res.status(200).json({ message: 'Registration successful' });
  } catch (error) {
    next(error);
  }
});

const generateToken = () => {
    return Math.random().toString(36).substr(2,10);
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password',
    },
});

router.post('/forgot-password', async (req, res, next) => {
    try{
        const User = mongoose.model('User');
        const user = await User.findOne({
            username: req.body.username
        });
        if (!user){
            return res.status(404).json({message: 'User not found'});
        }

        const resetToken = generateToken();
        user.resetPasswordToken = resetToken();
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        const mailOptions = {
            from: 'your-email@gmail.com',
            to: user.email,
            subject: 'Password Reset',
            text: 'You are receiving this email because you (or someone else) has requested the reset of the password for your account. \n\n' +
                'Please click on the following link, or paste this into your browser to complete the process: \n\n' +
                'http://localhost:3000/reset-password/${resetToken}\n\n' +
                'If you did not request this, please ignore this email and your password will remain unchanged.',
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Password reset email sent successfully'});
    } catch (error) {
        next(error);
    }
});

// Login route
router.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: true,
}));

// Logout route
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

module.exports = router;
