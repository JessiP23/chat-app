import axios from 'axios';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import FormData from 'form-data';  // Use 'import' instead of 'require'
import User from './models/user.js'; // Change the import statement

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    profilePicture: String,
});


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
            return { success: false, message: 'Incorrect User1name or password' };
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (isPasswordValid) {
            return { success: true, user };
        } else {
            return { success: false, message: 'Incorrect User1name or password' };
        }
    } catch (error) {
        console.error('Authentication error:', error);
        return { success: false, message: 'Authentication error' };
    }
};

export default { User, handleProfilePictureUpload, authenticateUser };
