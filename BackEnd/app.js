const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const bcrypt = require('bcryptjs');
//for posts
const multer = require('multer');

const Post = require('./Models/Post'); // You'll need to create this model
const fs = require('fs').promises; // Use promises version for async/await

const User = require('./Models/user');
const Message = require('./Models/Message');



const app = express();

//MongoDB connection:


async function connectDB() {
  try {
    await mongoose.connect('mongodb+srv://Musala001:%2APatricia123%23@cluster0.otlfit6.mongodb.net/chatapp?retryWrites=true&w=majority', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });

    console.log('✅ MongoDB Connected to Atlas');

    // Optional: Insert test document
    const testDoc = await mongoose.connection.db
      .collection('test')
      .insertOne({ test: true });
    console.log('📝 Test document inserted:', testDoc.insertedId);
  } catch (err) {
    console.error('❌ MongoDB Connection Failed:', err);
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



// Middleware
app.use(express.json()); // Add this line
app.use(express.static(path.join(__dirname, '../FrontEnd')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../FrontEnd/Views'));

// Multer configuration for file uploads
// Configure multer for file uploads
// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed!'), false);
    }
  }
});

class VoiceRecorder {
  constructor() {
    this.recording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordingTimeout = null;
    this.maxRecordingTime = 120000; // 2 minutes max
    
    this.voiceBtn = document.querySelector('.voice-btn');
    this.sendBtn = document.querySelector('.send-btn');
    this.messageInput = document.getElementById('message-input');
    this.recordingUI = document.querySelector('.recording-ui');
    this.cancelRecordingBtn = document.querySelector('.cancel-recording-btn');
    this.messageForm = document.getElementById('message-form');
    
    this.init();
  }

  init() {
    if (!this.voiceBtn) return;
    
    // Check for microphone support
    this.hasMicrophoneAccess().then(hasAccess => {
      if (hasAccess) {
        this.setupEventListeners();
      } else {
        this.voiceBtn.style.display = 'none';
      }
    });
  }

  async hasMicrophoneAccess() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  setupEventListeners() {
    // Press and hold to record
    this.voiceBtn.addEventListener('mousedown', this.startRecording.bind(this));
    this.voiceBtn.addEventListener('touchstart', this.startRecording.bind(this));
    
    // Release to send
    this.voiceBtn.addEventListener('mouseup', this.stopRecording.bind(this));
    this.voiceBtn.addEventListener('touchend', this.stopRecording.bind(this));
    this.voiceBtn.addEventListener('mouseleave', this.stopRecording.bind(this));
    
    // Cancel recording
    this.cancelRecordingBtn.addEventListener('click', this.cancelRecording.bind(this));
    
    // Keyboard alternative for accessibility
    this.voiceBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.startRecording();
      }
    });
    
    this.voiceBtn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.stopRecording();
      }
    });
  }

  async startRecording(e) {
    if (e) e.preventDefault();
    if (this.recording) return;
    
    try {
      // Show recording UI
      this.messageInput.style.display = 'none';
      this.recordingUI.style.display = 'flex';
      this.sendBtn.disabled = true;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        await this.processRecording(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.recording = true;
      
      // Start recording timeout
      this.recordingTimeout = setTimeout(() => {
        this.stopRecording();
      }, this.maxRecordingTime);
      
    } catch (error) {
      console.error('Recording error:', error);
      this.resetRecordingUI();
      alert('Could not access microphone. Please check permissions.');
    }
  }

  stopRecording(e) {
    if (e) e.preventDefault();
    if (!this.recording || !this.mediaRecorder) return;
    
    clearTimeout(this.recordingTimeout);
    this.mediaRecorder.stop();
    this.recording = false;
  }

  cancelRecording(e) {
    if (e) e.preventDefault();
    if (!this.recording) return;
    
    clearTimeout(this.recordingTimeout);
    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    this.resetRecordingUI();
    this.recording = false;
  }

  async processRecording(audioBlob) {
    try {
      // Show uploading state
      this.recordingUI.querySelector('span').textContent = 'Sending...';
      
      // Convert to MP3 for better compatibility
      const mp3Blob = await this.convertToMP3(audioBlob);
      
      // Create FormData and send to server
      const formData = new FormData();
      formData.append('voice', mp3Blob, `voice-${Date.now()}.mp3`);
      formData.append('sender', document.getElementById('currentUser').value);
      formData.append('receiver', document.getElementById('friendUser').value);
      formData.append('username', document.getElementById('currentUsername').value);
      
      const response = await fetch('/api/voice-message', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to send voice message');
      
      // Reset UI
      this.resetRecordingUI();
      
    } catch (error) {
      console.error('Error processing recording:', error);
      this.resetRecordingUI();
      alert('Failed to send voice message. Please try again.');
    }
  }

  async convertToMP3(blob) {
    // In a real app, you might use a library like lamejs or a WebAssembly module
    // For simplicity, we'll just use the original here
    return blob;
  }

  resetRecordingUI() {
    this.messageInput.style.display = 'block';
    this.recordingUI.style.display = 'none';
    this.recordingUI.querySelector('span').textContent = 'Recording...';
    this.sendBtn.disabled = false;
  }
}



// Make sure uploads directory is accessible
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Session Setup
app.use(session({
  secret: 'chatsecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb+srv://Musala001:%2APatricia123%23@cluster0.otlfit6.mongodb.net/chatapp?retryWrites=true&w=majority' })
}));

// Add this middleware before your routes
app.use((req, res, next) => {
  // Determine if we're on auth pages
  const authPaths = ['/login', '/register'];
  res.locals.hideProfileLinks = authPaths.includes(req.path);
  
  // Determine active page for auth links
  res.locals.isLoginPage = req.path === '/login';
  res.locals.isRegisterPage = req.path === '/register';
  
  next();
});

// Replace your current session middleware with this
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user;
  res.locals.messages = res.locals.messages || [];
  next();
});


// Routes

// ========== Authentication Routes ==========


app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/register');
  res.render('Welcome', { 
    title: 'Welcome',
    stylesheets: ['/Styles/welcome.css'] 
  });
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/friends');
  res.render('login', { 
    title: 'Login',
    stylesheets: ['/Styles/login.css'] 
  });
});

app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/friends');
  res.render('register', { 
    title: 'Register',
    stylesheets: ['/Styles/register.css'] 
  });
});

app.post('/register', async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      return res.status(400).send("Passwords don't match");
    }

    // Verify User model is available
    if (!mongoose.models.User) {
      throw new Error('User model not initialized');
    }

    const existingUser = await mongoose.models.User.findOne({ username });
    if (existingUser) {
      return res.status(400).send("Username taken");
    }
    
    const user = new mongoose.models.User({
      username,
      password: await bcrypt.hash(password, 12)
    });
    
    await user.save();
    req.session.user = user;
    res.redirect('/friends');
    
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send("Registration failed");
  }
});
//route for debugging
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

// ========== Posts Routes ==========

app.get('/posts', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    const posts = await Post.find()
      .populate('author', 'username')
      .populate({
        path: 'comments.author',
        select: 'username'
      })
      .sort({ createdAt: -1 });

    res.render('posts', { 
      posts,
      title: 'Posts',
      stylesheets: ['/Styles/posts.css']
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/posts', upload.single('media'), async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  try {
    const { content } = req.body;
    const newPost = new Post({
      content,
      author: req.session.user._id,
    });

    if (req.file) {
      newPost.mediaUrl = '/uploads/' + req.file.filename;
      newPost.mediaType = req.file.mimetype;
    }

    await newPost.save();
    res.redirect('/posts');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/posts/:id/like', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  try {
    const post = await Post.findById(req.params.id);
    const userId = req.session.user._id;
    
    const likeIndex = post.likes.indexOf(userId);
    if (likeIndex === -1) {
      post.likes.push(userId);
    } else {
      post.likes.splice(likeIndex, 1);
    }
    
    await post.save();
    res.json({ likes: post.likes.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// Add these routes after your existing post routes

// POST comment route
app.post('/posts/:id/comment', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const newComment = {
      text: req.body.text,
      author: req.session.user._id  // Store the author's ID
    };

    post.comments.push(newComment);
    await post.save(); // Save the post with the new comment

    // Populate the author field for both the post and comments
    const populatedPost = await Post.findById(req.params.id) // Use req.params.id here
      .populate('author', 'username')  // Populate the author of the post with the username
      .populate({
        path: 'comments',
        populate: {
          path: 'author',  // Populate the author field of each comment
          select: 'username'  // Only retrieve the username of the author
        }
      })
      .exec();

    // Get the newly added comment (last in array)
    const addedComment = populatedPost.comments[populatedPost.comments.length - 1];

    // Send the response with the populated data
    res.json({
      success: true,
      post: populatedPost, // Ensure we send the entire post object with populated author and comments
      comment: {
        _id: addedComment._id,
        text: addedComment.text,
        author: {
          _id: addedComment.author._id,
          username: addedComment.author.username  // Ensure username is included
        },
        createdAt: addedComment.createdAt
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



// DELETE post route


app.delete('/posts/:id', async (req, res) => {
  try {
    console.log('Delete post attempt by user:', req.session.user);
    
    if (!req.session.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authorized' 
      });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        error: 'Post not found' 
      });
    }

    // Check if user is the author
    if (!post.author.equals(req.session.user._id)) {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only delete your own posts' 
      });
    }

    // Delete associated media file if exists
    if (post.mediaUrl) {
      try {
        const filePath = path.join(__dirname, '../public', post.mediaUrl);
        await fs.unlink(filePath);
        console.log('Deleted media file:', post.mediaUrl);
      } catch (fileErr) {
        console.error('Error deleting media file:', fileErr);
        // Continue with post deletion even if file deletion fails
      }
    }

    await Post.deleteOne({ _id: post._id });
    
    res.json({ 
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete post',
      details: err.message 
    });
  }
});

app.delete('/posts/:postId/comment/:commentId', async (req, res) => {
  try {
    // Check authentication
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Find the comment index
    const commentIndex = post.comments.findIndex(
      c => c._id.toString() === req.params.commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    const comment = post.comments[commentIndex];

    // Check if user is comment author or post author
    if (!comment.author.equals(req.session.user._id) && 
        !post.author.equals(req.session.user._id)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Remove the comment using pull (correct way to remove subdocuments)
    post.comments.pull({ _id: req.params.commentId });
    await post.save();

    res.json({ 
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete comment',
      details: err.message 
    });
  }
});

// Profile View Route
// Update your profile routes to ensure proper header rendering
// Profile View Route
app.get('/profile/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('friends', 'username');
    
    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('author', 'username');
      
    res.render('profile', {
      profileUser: user,
      posts,
      currentUser: req.session.user,
      title: `${user.username}'s Profile`
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Route for editing the profile
app.get('/profile/edit/:userId', async (req, res) => {
  try {
    if (!req.session.user) {
      console.log('User not logged in');
      return res.redirect('/login');
    }

    console.log('Session user:', req.session.user);

    const user = await User.findById(req.session.user._id);
    if (!user) {
      console.log('User not found in database');
      return res.status(404).send('User not found');
    }

    console.log('User loaded:', user);

    res.render('edit-profile', { currentUser: user });
  } catch (err) {
    console.error('Error in GET /profile/edit:', err);
    res.status(500).send('Server Error');
  }
});


// Handle profile picture upload and other profile edits
app.post('/profile/edit/:userId', upload.single('profilePic'), async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  try {
    const userId = req.params.userId;

    // Create update object
    const updates = {
      name: req.body.name,
      bio: req.body.bio
    };

    // If a profile picture was uploaded, include it
    if (req.file) {
      updates.profilePic = `/uploads/${req.file.filename}`;
    }

    // Update the user in the database
    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });

    // Update session so that changes reflect immediately
    req.session.user = updatedUser;

    res.redirect(`/profile/${userId}`);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).send('Server Error');
  }
});

// Voice message endpoint
const voiceUpload = multer({ dest: 'public/voice-notes/' });


// Add this near your other route handlers

app.post('/api/voice-message', voiceUpload.single('voice'), async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { sender, receiver } = req.body;
    const voiceUrl = '/voice-notes/' + req.file.filename;

    const message = new Message({
      sender,
      receiver,
      content: '[Voice message]',
      voiceUrl,
      timestamp: new Date()
    });

    await message.save();
    
    // Emit via Socket.IO
    io.to(`chat_${[sender, receiver].sort().join('_')}`).emit('new-message', message);
    
    res.json({ success: true, message });
  } catch (err) {
    console.error('Error saving voice message:', err);
    res.status(500).json({ success: false, error: 'Failed to send voice message' });
  }
});

app.get('/api/messages/:userId1/:userId2', async (req, res) => {
  const { userId1, userId2 } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { sender: userId1, receiver: userId2 },
        { sender: userId2, receiver: userId1 }
      ]
    }).sort({ timestamp: 1 });

    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
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
      currentUser: req.session.user,
      friends: user.friends,
      groups: groups,
      messages: [],
      currentChatFriend: null,
      title: 'Chat',
      stylesheets: ['/Styles/chat.css']
    });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});



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

app.post('/api/send', upload.single('file'), async (req, res) => {
  try {
    const { senderId, receiverId, content } = req.body;
    const file = req.file;

    const newMsg = await Message.create({
      sender: senderId,
      receiver: receiverId,
      content,
      filePath: file ? file.path : null,
      fileType: file ? file.mimetype : null
    });

    res.json(newMsg);
  } catch (err) {
    console.error('Attachment send error:', err);
    res.status(500).send('Error sending message');
  }
});
// ========== Socket.IO Setup ==========

const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "http://localhost:3000", // Adjust to your client URL
    methods: ["GET", "POST"]
  }
});

// Store connected users
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinRoom', (roomId) => {
    console.log(`Socket ${socket.id} joining room ${roomId}`);
    socket.join(roomId);
  });

  socket.on('sendMessage', async (msg) => {
    try {
      // Save the message to the database
      const savedMessage = await Message.create({
        sender: msg.senderId,
        receiver: msg.receiverId,
        content: msg.content
      });

      const roomId = [msg.senderId, msg.receiverId].sort().join('_');
      console.log(`Message saved and sent to room ${roomId}:`, savedMessage);

      // Emit the saved message to the room
      io.to(roomId).emit('receiveMessage', savedMessage);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('typing', ({ roomId, senderId }) => {
    socket.to(roomId).emit('displayTyping', { senderId });
  });

  socket.on('stopTyping', ({ roomId, senderId }) => {
    socket.to(roomId).emit('hideTyping', { senderId });
  });


  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

module.exports = server;

const PORT = process.env.PORT || 3000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO endpoint available at ws://localhost:${PORT}`);
});
