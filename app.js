// Import necessary modules
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const Message = require('./models/message');
const messagesRouter = ('./routes/messages');
const userController = require('./userController');
const { isAxiosError } = require('axios');
const io = require('socket.io')(http);

// Create an Express app
const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 3000,
});

// Setup middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'your-secret-key', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use('/api', messagesRouter);

// Configure passport to use local strategy
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      // Replace 'User' with your actual Mongoose model
      const User = mongoose.model('User');
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

const handleProfilePictureUpload = userController.handleProfilePictureUpload;

io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('chat message', async (msg) => {
        console.log('Received message: ', msg);

        try{
            const message = new Message({
                content: msg,
                user: socket.request.user._id,
            });
            await message.save();
        } catch (error){
            console.error('Error storing message in the databse: ', error);
        }

        io.emit('chat message', msg);
    });
});

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  // Replace 'User' with your actual Mongoose model
  const User = mongoose.model('User');
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

app.get('/search/users', isAuthenticated, async (req, res) => {
  try{
    const { query } = req.query;
    const users = await User.find({ username: { $regex: new RegExp(query, 'i')}}, 'username');
    res.render('search-users', { user: req.user, users});
  } catch (error) {
    console.error('Error searching users', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/chat/:username', isAuthenticated, (req, res) => {
  const { username } = req.params;
  res.render('chat', { user: req.user, targetUser: username});
});

app.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Internal Server Error');
    }
    res.redirect('/login');
  });
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
