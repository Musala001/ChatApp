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

  socket.on('new-message', (msg) => {
    const isSentByCurrentUser = String(msg.sender._id) === String(currentUser);

    const messageEl = document.createElement('div');
    messageEl.classList.add('message', isSentByCurrentUser ? 'sent' : 'received');

    messageEl.innerHTML = `
      <div class="message-content">
        <div class="message-header">
          <span class="sender-name">${isSentByCurrentUser ? 'You' : (msg.sender.username || 'Friend')}</span>
          <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="message-text">${msg.content}</p>
      </div>
    `;

    messageContainer.appendChild(messageEl);
    messageContainer.scrollTop = messageContainer.scrollHeight;
  });
});
