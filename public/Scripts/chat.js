document.addEventListener('DOMContentLoaded', () => {
  const socket = io({ autoConnect: false });

  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');
  const messageContainer = document.getElementById('messages');

  const currentUser = document.getElementById('currentUser')?.value;
  const currentChatFriend = document.getElementById('friendUser')?.value;

  if (!currentUser || !currentChatFriend) return;

  const room = `chat_${[currentUser, currentChatFriend].sort().join('_')}`;
  console.log(`Joining room: ${room}`);

  // Only connect once
  if (!socket.connected) {
    socket.connect();
  }

  socket.emit('join-chat', {
    userId: currentUser,
    friendId: currentChatFriend
  });

  // Remove previous listeners to prevent duplication
  socket.removeAllListeners('new-message');

  messageForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (content !== '') {
      const timestamp = new Date().toISOString();
      socket.emit('send-message', {
        sender: currentUser,
        receiver: currentChatFriend,
        content,
        timestamp
      });
      messageInput.value = '';
      messageInput.focus();
    }
  });

  // In your existing chat.js
socket.on('new-message', (message) => {
  const messagesContainer = document.getElementById('messages');
  const isCurrentUser = message.sender === document.getElementById('currentUser').value;
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
  
  let contentHTML = '';
  if (message.voiceUrl) {
    contentHTML = `
      <div class="voice-message">
        <audio controls>
          <source src="${message.voiceUrl}" type="audio/mp3">
          Your browser does not support audio elements.
        </audio>
      </div>
    `;
  } else {
    contentHTML = `<p class="message-text">${message.content}</p>`;
  }
  
  messageElement.innerHTML = `
    <div class="message-content">
      <div class="message-header">
        <span class="sender-name">
          ${isCurrentUser ? 'You' : message.sender?.username || 'Unknown'}
        </span>
        <span class="message-time">
          ${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      ${contentHTML}
    </div>
  `;
  
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
});
});
