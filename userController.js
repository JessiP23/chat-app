const axios = require('axios');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const FormData = require('form-data');
const {client} = require('./db');

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
});

const User = mongoose.model('User', userSchema);

const handleProfilePictureUpload = async (file) => {
  try {
    const formData = new FormData();
    formData.append('profilePicture', file);

    await axios.post('/api/upload-profile-picture', formData);
  } catch (error) {
    console.error('Profile picture upload failed:', error);
  }
};

const authenticateUser = async (username, password) => {
  try {
    const user = await User.findOne({ username });

    if (!user) {
      return { success: false, message: 'Incorrect username or password' };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      return { success: true, user };
    } else {
      return { success: false, message: 'Incorrect username or password' };
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, message: 'Authentication error' };
  }
};

module.exports = { User, handleProfilePictureUpload, authenticateUser };
