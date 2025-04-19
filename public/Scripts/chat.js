const socket = io();

// Only join room if a friend is selected
if (friendId && currentUserId) {
  const roomId = [currentUserId, friendId].sort().join('_');
  socket.emit('joinRoom', roomId);

  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');
  const messageContainer = document.getElementById('chat-messages');

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const message = {
      senderId: currentUserId,
      receiverId: friendId,
      content: content
    };

    socket.emit('sendMessage', message);
    messageInput.value = '';
  });

  socket.on('receiveMessage', (msg) => {
    const div = document.createElement('div');
    div.classList.add('message');
    div.classList.add(msg.sender === currentUserId ? 'sent' : 'received');
    div.innerHTML = `<p>${msg.content}</p><span>${new Date(msg.timestamp).toLocaleTimeString()}</span>`;
    messageContainer.appendChild(div);
    messageContainer.scrollTop = messageContainer.scrollHeight;
  });
}

// --- TYPING INDICATOR ---
let typingTimeout;

messageInput.addEventListener('input', () => {
  socket.emit('typing', {
    roomId: [currentUserId, friendId].sort().join('_'),
    senderId: currentUserId
  });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stopTyping', {
      roomId: [currentUserId, friendId].sort().join('_'),
      senderId: currentUserId
    });
  }, 1000);
});

socket.on('displayTyping', (data) => {
  let typingEl = document.getElementById('typing-indicator');
  if (!typingEl) {
    typingEl = document.createElement('div');
    typingEl.id = 'typing-indicator';
    typingEl.textContent = 'Typing...';
    messageContainer.appendChild(typingEl);
  }
});

socket.on('hideTyping', () => {
  const typingEl = document.getElementById('typing-indicator');
  if (typingEl) typingEl.remove();
});
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const content = messageInput.value.trim();
  const file = document.getElementById('file-input').files[0];

  const formData = new FormData();
  formData.append('senderId', currentUserId);
  formData.append('receiverId', friendId);
  formData.append('content', content);
  if (file) formData.append('file', file);

  const res = await fetch('/api/send', {
    method: 'POST',
    body: formData
  });

  const msg = await res.json();
  socket.emit('sendMessage', msg);
  messageInput.value = '';
});


