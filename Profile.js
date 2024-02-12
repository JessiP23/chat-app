import React, { useState } from 'react';
import axios from 'axios';

const Profile = ({ user }) => {
  const [profilePicture, setProfilePicture] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setProfilePicture(file);
  };

  const handleUpload = async () => {
    try {
      const formData = new FormData();
      formData.append('profilePicture', profilePicture);

      await axios.post('/api/upload-profile-picture', formData);

      // Refresh the page or update state to reflect changes
      window.location.reload();
    } catch (error) {
      console.error('Profile picture upload failed: ', error);
    }
  };

  return (
    <div>
      <h1>Profile</h1>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload Profile Picture</button>
      {/* Display current profile picture if available */}
      {user && user.profilePicture && (
        <img src={user.profilePicture} alt="Profile" style={{ width: '100px', height: '100px' }} />
      )}
    </div>
  );
};

export default Profile;
