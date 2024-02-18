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

messagesRouter.post('/messages', async (req, res) => {
  try {
    console.log('Received POST request: ', req.body);
    const { content, user, targetUser } = req.body || {};

    if(!content || !user || !targetUser){
      console.error('Invalid message format');
      return res.status(400).json({ error: 'Invalid message format '});
    }

    const message = new Message({
      content,
      user,
      targetUser,
    });

    await message.save();
    console.log('Message saved to the database');

    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message: ', error);
    res.status(500).send('Internal Server Error');
  }
});

export default messagesRouter;
