const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const bcrypt = require('bcryptjs');

const User = require('./Models/user');
const Message = require('./Models/Message');

const app = express();

// Replace your current MongoDB connection with this:


async function connectDB() {
  try {
    await mongoose.connect('mongodb+srv://Musala001:%2APatricia123%23@cluster0.otlfit6.mongodb.net/chatapp?retryWrites=true&w=majority
', {
      serverSelectionTimeoutMS: 5000,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Connected');

    // Test connection by inserting a document
    const testDoc = await mongoose.connection.db.collection('test').insertOne({ test: true });
    console.log('Test document inserted:', testDoc.insertedId);

  } catch (err) {
    console.error('MongoDB Connection Failed:', err);
    process.exit(1);
  }
}


connectDB();
// 2. Add the connection event handlers RIGHT AFTER the connection
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to DB');
  
  // Test message insertion
  const testMsg = new Message({
    sender: new mongoose.Types.ObjectId(), // Random ID
    receiver: new mongoose.Types.ObjectId(), // Random ID
    content: 'TEST MESSAGE - DB CONNECTION WORKS'
  });
  
  testMsg.save()
    .then(() => console.log('✓ Test message saved successfully'))
    .catch(err => console.error('✗ Test message failed:', err));
});

// Other Mongoose event handlers (optional but recommended)
mongoose.connection.on('error', err => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// Middleware
app.use(express.static(path.join(__dirname, '../FrontEnd')));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../FrontEnd/Views'));

// Session Setup
app.use(session({
  secret: 'chatsecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/chatapp' })
}));

// Middleware to make user available in all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user;
  res.locals.messages = res.locals.messages || [];
  next();
});


// Routes

// ========== Authentication Routes (unchanged) ==========
app.get('/', (req, res) => res.render('Register'));
app.post('/register', async (req, res) => {
  const { username, password, confirmPassword } = req.body;
  if (password !== confirmPassword) return res.send("Passwords don't match");
  if (await User.findOne({ username })) return res.send("Username taken");
  
  const user = new User({
    username,
    password: await bcrypt.hash(password, 12)
  });
  await user.save();
  req.session.user = user;
  res.redirect('/friends');
});

// Add this route for debugging
app.get('/debug/messages', async (req, res) => {
  try {
    const messages = await Message.find().populate('sender receiver');
    console.log('All messages in DB:', messages);
    res.json(messages);
  } catch (err) {
    console.error('Debug error:', err);
    res.status(500).send('Debug failed');
  }
});

app.get('/login', (req, res) => res.render('login'));


app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.send("User not found");
  if (!await bcrypt.compare(password, user.password)) return res.send("Wrong password");
  
  req.session.user = user;
  res.redirect('/friends');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ========== Friends Routes ==========
app.get('/friends', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  const user = await User.findById(req.session.user._id).populate('friends');
  res.render('friends', { 
    friends: user.friends,
    title: 'Friends List'
  });
});

app.get('/remove-friend/:friendId', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  const { friendId } = req.params;
  await User.findByIdAndUpdate(req.session.user._id, {
    $pull: { friends: friendId }
  });
  await User.findByIdAndUpdate(friendId, {
    $pull: { friends: req.session.user._id }
  });
  res.redirect('/friends');
});

// ========== Directory Routes ==========
app.get('/directory', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  const users = await User.find({ 
    _id: { $ne: req.session.user._id },
    friends: { $ne: req.session.user._id }
  });
  
  res.render('directory', { 
    users,
    title: 'User Directory'
  });
});

app.get('/add-friend/:userId', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  const { userId } = req.params;
  await User.findByIdAndUpdate(req.session.user._id, {
    $addToSet: { friends: userId }
  });
  await User.findByIdAndUpdate(userId, {
    $addToSet: { friends: req.session.user._id }
  });
  res.redirect('/friends');
});

// ========== Chat Routes ==========
// In your route handler for /chat
// General chat page (no specific friend selected)
// General chat page (no specific friend selected)
app.get('/chat', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  try {
    const user = await User.findById(req.session.user._id).populate('friends');
    
    res.render('chat', {
      currentUser: req.session.user,  // Pass the logged-in user
      friends: user.friends,         // Array of friend objects
      messages: [],                  // Empty array when no friend selected
      currentChatFriend: null,       // No friend selected initially
      title: 'Chat',
      stylesheets: ['/Styles/chat.css']
    });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

// Specific chat conversation
// Update your /chat/:friendId route
// Specific chat conversation
app.get('/chat/:friendId', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  try {
    const user = await User.findById(req.session.user._id).populate('friends');
    const messages = await Message.find({
      $or: [
        { sender: req.session.user._id, receiver: req.params.friendId },
        { sender: req.params.friendId, receiver: req.session.user._id }
      ]
    })
    .populate('sender', 'username')  // Only get the username
    .sort('timestamp');

    res.render('chat', {
      currentUser: req.session.user,
      friends: user.friends,
      messages: messages,
      currentChatFriend: req.params.friendId,
      title: `Chat with ${user.friends.find(f => f._id.equals(req.params.friendId))?.username || 'Friend'}`,
      stylesheets: ['/Styles/chat.css']
    });
  } catch (err) {
    console.error(err);
    res.redirect('/chat');
  }
});


app.post('/send-message', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  const { message, receiver } = req.body;
  const newMessage = new Message({
    sender: req.session.user._id,
    receiver,
    content: message,
    timestamp: new Date()
  });
  await newMessage.save();
  res.redirect(`/chat/${receiver}`);
});

// ========== Socket.IO Setup ==========
const server = require('http').createServer(app);
const io = require('socket.io')(server);

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('join-chat', ({ userId, friendId }) => {
    const room = `chat_${[userId, friendId].sort().join('_')}`;
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('send-message', async (data) => {
    console.log('Received message data:', {
      from: data.sender,
      to: data.receiver,
      content: data.content.substring(0, 50)
    });

    try {
      const message = new Message({
        sender: data.sender,
        receiver: data.receiver,
        content: data.content
      });

      const savedMessage = await message.save();
      console.log('Message saved with ID:', savedMessage._id);

      const populated = await Message.populate(savedMessage, [
        { path: 'sender', select: 'username' },
        { path: 'receiver', select: 'username' }
      ]);

      const room = `chat_${[data.sender, data.receiver].sort().join('_')}`;
      console.log('Emitting to room:', room);

      io.to(room).emit('new-message', populated);

    } catch (err) {
      console.error('Full error:', err);
      socket.emit('message-error', {
        error: 'Failed to send message',
        details: err.message
      });
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
