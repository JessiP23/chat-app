const mongoose = require('mongoose');

// Define user schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  profilePicture: String,
});

// Create user model
const User = mongoose.model('User', userSchema);

module.exports = User;
