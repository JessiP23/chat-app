import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import session from 'express-session';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import Message from './models/message.js';  
import winston from 'winston';
import cors from 'cors';
import messagesRouter from './routes/messagesRouter.js';
import { client, connect } from './db.js';
import userController from './userController.js';
import passportSocketIO from 'passport.socketio';
import { SocketAddress } from 'net';
const {User} = userController;

const config = {
  sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
};

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app); // Create an HTTP server for Socket.io
const io = new Server(server);

process.off('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

connect();

process.on('SIGINT', () => {
  client.close().then(() => {
    console.log('Connection to MongoDB closed');
    process.exit(0);
  });
});

mongoose.connect('mongodb://localhost:27017/chatapp', {
  connectTimeoutMS: 3000,
});

mongoose.connection.on('connecting', () => {
  console.log('Connecting to MongoDB...');
});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Disconnected from MongoDB');
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

const mongoStore = MongoStore.create({
  mongoUrl: 'mongodb://localhost:27017/chatapp',
  mongooseConnection: mongoose.connection,
  collection: 'sessions',
})

const sessionMiddleware = session({
  secret: 'your-secret-key',
  resave: true,
  saveUninitialized: true,
  store: mongoStore,
})

app.use(sessionMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors());
app.use(cookieParser());

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

passport.serializeUser((user, done) => {
  console.log('Serializer User:', user);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .exec()
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err, null);
    });
});

const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

app.use(session({
  secret: 'your-secret-key',
  resave: true,
  saveUninitialized: true,
  store: mongoStore,
}));

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

app.use((req, res, next) => {
  console.log('Session:', req.session);
  console.log('Authenticated:', req.isAuthenticated());
  next();
});

const fetchMessagesFromDatabase = async (username) => {
  try{
    const messages = await Message.find({
      $or: [
        { sender: username },
        { receiver: username },
      ],
    });
    return messages;
  } catch (error){
    console.error('Error fetching messages from database:', error);
    return [];
  }
};

const saveMessageToDatabase = async (sender, receiver, content) => {
  try{
    const message = new Message({
      sender,
      receiver,
      content,
      timestamp: new Date(),
    });
    await message.save();
    console.log('Message saved to database:', message);
  } catch(error){
    console.error('Error saving message to database:', error);
  }
};

const findSocketByUsername = (targetUser) => {
  const targetSocket = io.sockets.sockets.find((socket) => {
    return socket.user && socket.user.username === targetUser;
  });
  return targetSocket;
};

const onAuthorizeSuccess = (data, accept) => {
  console.log('Successful connection to socket.io');
  accept(null, true);
};

const onAuthorizeFail = (data, message, error, accept) => {
  console.error('Failed connection to socket.io:', message);
  if (error) throw new Error(message);
  accept(null, false);
};

io.use(passportSocketIO.authorize({
  cookieParser: cookieParser,
  key: 'express.sid',
  secret: 'your-secret-key',
  store: mongoStore,
  success: (data, accept) => {
    data.user = {
      _id: data.user._id,
      username: data.user.username,
    };
    accept(null, true);
  },
}));

io.on('connection', (socket) => {
  console.log('A user connected');
  console.log('Socket Session ID:', socket.request.session);

  const sessionId = socket.request.sessionID;
  const username = socket.user.username;

  const fetchAndEmitMessages = async (username) => {
    try{
      const messages = await fetchMessagesFromDatabase(username);
      messages.forEach((message) => {
        io.to(socket.id).emit('private chat message', message);
      });
    } catch (error){
      console.error('Error fetching messages', error);
    }
  };

  if (!sessionId) {
    console.error('No session ID found');
    return socket.disconnect(true);
  }

  mongoStore.get(sessionId, (err, session) => {
    if (err || !session) {
      console.error('Error or no session found:', err);
      return socket.disconnect(true);
    }

    const userId = session.passport.user;
    console.log('User ID from session:', userId);

    User.findById(userId, (userErr, user) => {
      if (userErr || !user) {
        console.error('User not found:', userErr);
        return socket.disconnect(true);
      }

      socket.user = user;
      console.log('Authenticated:', socket.user.username);
      fetchAndEmitMessages(socket.user.username);
    });
  });

  socket.on('private chat message', (msg, targetUser) => {
    const sender = socket.user.username;
    const receiver = targetUser;

    const message = {
      sender,
      receiver,
      content: msg,
      timestamp: new Date(),
    };

    saveMessageToDatabase(message);

    io.to(socket.id).emit('private chat message', message);

    const targetSocket = findSocketByUsername(targetUser);
    if(targetSocket){
      io.to(targetSocket.id).emit('private chat message', message);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});


app.use('/api', messagesRouter);


app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof TypeError && err.message.includes('Cannot read properties of undefined.')){
    console.error('Received TypeError, possibly related to middleware chain');
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  if (err.name === 'Unauthorized Error') {
    return res.status(401).send('Unauthorized access');
  }

  res.status(500).json({ error: err.message, stack: err.stack});
});

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(400).send('Username already taken');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword,
    });

    await newUser.save();

    console.log('User registered:', newUser);
    res.redirect('/login');
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: true,
  session: true,
}));

app.get('/dashboard', (req, res) => {
  console.log('User authenticated:', req.user);
  res.render('dashboard', { user: req.user });
});

app.use(express.static(new URL('public', import.meta.url).pathname));

app.get('/', (req, res) => {
  console.log('Authenticated:', req.isAuthenticated());
  if (!req.isAuthenticated()) {
    return res.render('dashboard', { user: req.user });
  }
  res.redirect('/login');
});


app.get('/login', (req, res) => {
  res.render('login.ejs');
});

app.get('/register', (req, res) => {
  res.render('register.ejs');
});


app.get('/chat', isAuthenticated, (req, res) => {
  res.render('chat.ejs', { user: req.user });
});

app.get('/search/users', isAuthenticated, async (req, res) => {
  try {
    const { query } = req.query;
    const users = await User.find({ username: { $regex: new RegExp(query, 'i') } }, 'username');
    res.json(users);
  } catch (error) {
    console.error('Error searching users', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/chat/:username', isAuthenticated, (req, res) => {
  const { username } = req.params;
  res.render('chat.ejs', { user: req.user, targetUser: username });
});

app.post('/logout', (req, res) => {
  req.logout((err) => {
    if(err) {
      return next(err);
    }
    res.redirect('/login');
  });
});

app.set('view engine', 'ejs');



const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
