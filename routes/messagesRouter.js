// routes/messagesRouter.js

import express from 'express';
import Message from '../models/message.js';

const messagesRouter = express.Router();

messagesRouter.get('/messages', async (req, res) => {
  try {
    const messages = await Message.find();
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Add other message-related routes as needed

export default messagesRouter;
