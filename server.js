const express = require('express');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const winston = require('winston');
const cors = require('cors');
const Message = require('./models/message');
const {authenticateUser, handleProfilePictureUpload} = require('./userController');

process.off('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at: ', promise, 'reason: ', reason);
});

const config = {
  sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
};

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

mongoose.connect('mongodb://localhost:27017/chatapp', { 
    connectTimeoutMS: 3000,
    dbName: 'chatapp',
});

mongoose.connection.on('connecting', () => {
    console.log('Connecting to MongoDB...');
});

mongoose.connection.on('connected', () => {
    console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error: ', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Disconnected from MongoDB');
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});



// Setup logging
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Configure session and authentication
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'your-secret-key', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors());
app.use(express.static(__dirname));

const sessionMiddleware = session({
  secret: 'your-secret-key',
  resave: true,
  saveUninitialized: true,
});

app.use(sessionMiddleware);

// Passport local strategy for user authentication
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await User.findOne({ username });

      if (!user) {
        return done(null, false, { message: 'Incorrect username or password' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (isPasswordValid) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Incorrect username or password' });
      }
    } catch (error) {
      return done(error);
    }
  }
));

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

// Express middleware for authentication
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('disconnect', () => {
      console.log('User disconnected');
  });

  socket.on('chat message',async (msg) => {
    console.log('Received message: ', msg);

    try {
      const message = new Message({
        content: msg,
        user: socket.request.session.passport.user,
      });
      await message.save();
    } catch (error){
      console.error('Error storing message in the database: ', error);
    }
    socket.broadcast.emit('chat message', msg);
    console.log('Emitted chat message to all clients');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);

  if(err.name === 'Unauthorized Error'){
    return res.status(401).send('Unauthorized access');
  }

  res.status(500).send('Something went wrong!');
});


app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: true,
}));

app.get('/dashboard', isAuthenticated, (req, res) => {
  // Render the dashboard for authenticated users
  res.render('dashboard', { user: req.user });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
