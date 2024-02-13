const express = require('express');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const passport = require('passport');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const winston = require('winston');
const cors = require('cors');
const Message = require('./models/message');
const {User} = require('./userController');
const {client, connect} = require('./db');
const messagesRouter = require('./routes/messages');
const userController = require('./userController');
//const io = require('socket.io')(http);

process.off('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at: ', promise, 'reason: ', reason);
});

const config = {
  sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
};

const app = express();
const port = 3000;
const server = http.createServer(app);
const io = socketIO(server);

connect();

process.on('SIGINT', () => {
  client.close().then(() => {
    console.log('Connection to MongoDB closed');
    process.exit(0);
  });
});


mongoose.connect('mongodb://localhost:27017/chatapp', { 
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 3000,
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
app.use(session({ secret: 'your-secret-key', resave: true, saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/api', messagesRouter);
app.use(cors());

const sessionMiddleware = session({
  secret: 'your-secret-key',
  resave: true,
  saveUninitialized: true,
});

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
  console.log('Serializer User:', user);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const User = mongoose.model('User');

  User.findById(id)
    .exec()
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err, null);
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
  if(!socket.request.session.passport || !socket.request.session.passport.user){
    socket.emit('unauthorized', 'You are not authorized to join the chat.');
    socket.disconnect();
    return;
  }

  console.log('User connected:', socket.request.session.passport.user);

  socket.on('unauthorized', (message) => {
    console.error(message)
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
    io.emit('chat message', msg);
    console.log('Emitted chat messages to all clients');
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

app.post('/register', async (req, res) => {
  try{
    const { username, password } = req.body;
    const existingUser = await User.findOne({ username });

    if (existingUser){
      return res.status(400).send('Username already taken');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username, 
      password: hashedPassword,
    });

    await newUser.save();

    res.redirect('/login');
  } catch(error){
    console.error('Error during registration:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/', (req, res) => {
  console.log('Authenticated: ', req.isAuthenticated());
  if(!req.isAuthenticated()){
    return res.render('dashboard', {user: req.user});
  }
  res.redirect('/login');
});

app.get('/dashboard', (req, res) => {
  res.render('dashboard', {user: req.user});
});

app.get('/login', (req, res) => {
  res.render('login.ejs');
});

app.get('/register', (req, res) => {
  res.render('register.ejs');
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: true,
  session: true,
}));

app.get('/chat', isAuthenticated, (req, res) => {
  res.render('chat.ejs', { user: req.user });
});

app.post('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

app.set('view engine', 'ejs');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
