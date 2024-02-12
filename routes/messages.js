const express = require('express');
const router = express.Router();
const Message = require('../models/message');

router.get('/messages', async (req, res, next) =>{
    try{
        const messages = await Message.find().populate('user', 'username');
        res.json(messages);
    } catch (error){
        next(error);
    }
});

module.exports = router;