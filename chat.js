class ChatApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.users = new Map();
        this.typingUsers = new Set();
        this.typingTimeout = null;
        
        this.init();
    }

    init() {
        this.bindLoginEvents();
        this.initializeSocket();
    }

    bindLoginEvents() {
        // Avatar selection
        const avatarOptions = document.querySelectorAll('.avatar-option');
        avatarOptions.forEach(option => {
            option.addEventListener('click', () => {
                avatarOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
            });
        });

        // Login form
        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    }

    initializeSocket() {
        this.socket = io();
        
        // Connection events
        this.socket.on('connect', () => {
            this.updateConnectionStatus('connected');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('disconnected');
        });

        this.socket.on('reconnecting', () => {
            this.updateConnectionStatus('connecting');
        });

        // Chat events
        this.socket.on('message:received', (message) => {
            this.displayMessage(message);
        });

        this.socket.on('user:joined', (data) => {
            this.displaySystemMessage(data.message);
        });

        this.socket.on('user:left', (data) => {
            this.displaySystemMessage(data.message);
        });

        this.socket.on('users:list', (users) => {
            this.updateUsersList(users);
        });

        this.socket.on('users:update', (users) => {
            this.updateUsersList(users);
            this.updateOnlineCount(users.length);
        });

        this.socket.on('typing:user', (data) => {
            this.handleTypingIndicator(data);
        });
    }

    handleLogin() {
        const username = document.getElementById('username').value.trim();
        const selectedAvatar = document.querySelector('.avatar-option.active').dataset.avatar;

        if (!username) {
            alert('Please enter a username');
            return;
        }

        this.currentUser = {
            username,
            avatar: selectedAvatar
        };

        // Join the chat
        this.socket.emit('user:join', this.currentUser);
        
        // Switch to chat interface
        this.showChatInterface();
        this.bindChatEvents();
    }

    showChatInterface() {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'flex';
    }

    bindChatEvents() {
        // Message form
        const messageForm = document.getElementById('messageForm');
        const messageInput = document.getElementById('messageInput');

        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Typing indicators
        let typingTimer;
        messageInput.addEventListener('input', () => {
            if (!this.isTyping) {
                this.isTyping = true;
                this.socket.emit('typing:start', { room: 'general' });
            }

            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                this.isTyping = false;
                this.socket.emit('typing:stop', { room: 'general' });
            }, 1000);
        });

        // Header buttons
        document.getElementById('toggleUsers').addEventListener('click', () => {
            this.toggleUsersSidebar();
        });

        document.getElementById('leaveChat').addEventListener('click', () => {
            this.leaveChat();
        });

        // Focus message input
        messageInput.focus();
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();

        if (!content) return;

        this.socket.emit('message:send', {
            content,
            room: 'general'
        });

        messageInput.value = '';
        
        // Stop typing indicator
        if (this.isTyping) {
            this.isTyping = false;
            this.socket.emit('typing:stop', { room: 'general' });
        }
    }

    displayMessage(message) {
        const messagesList = document.getElementById('messagesList');
        const isOwnMessage = message.user.id === this.socket.id;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageElement.innerHTML = `
            <div class="message-avatar">${message.user.avatar}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username">${message.user.username}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-text">${this.escapeHtml(message.content)}</div>
            </div>
        `;

        messagesList.appendChild(messageElement);
        this.scrollToBottom();
    }

    displaySystemMessage(content) {
        const messagesList = document.getElementById('messagesList');
        const messageElement = document.createElement('div');
        messageElement.className = 'system-message';
        messageElement.textContent = content;
        
        messagesList.appendChild(messageElement);
        this.scrollToBottom();
    }

    updateUsersList(users) {
        const usersList = document.getElementById('usersList');
        const usersCount = document.getElementById('usersCount');
        
        usersList.innerHTML = '';
        usersCount.textContent = users.length;

        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.innerHTML = `
                <div class="user-avatar">${user.avatar}</div>
                <div class="user-info">
                    <div class="user-name">${this.escapeHtml(user.username)}</div>
                    <div class="user-status">Online</div>
                </div>
            `;
            usersList.appendChild(userElement);
        });
    }

    updateOnlineCount(count) {
        const onlineCount = document.getElementById('onlineCount');
        onlineCount.textContent = `${count + 1} online`; // +1 for current user
    }

    handleTypingIndicator(data) {
        const typingIndicators = document.getElementById('typingIndicators');
        
        if (data.isTyping) {
            this.typingUsers.add(data.username);
        } else {
            this.typingUsers.delete(data.username);
        }

        // Update typing indicators display
        if (this.typingUsers.size > 0) {
            const typingArray = Array.from(this.typingUsers);
            let typingText = '';
            
            if (typingArray.length === 1) {
                typingText = `${typingArray[0]} is typing`;
            } else if (typingArray.length === 2) {
                typingText = `${typingArray[0]} and ${typingArray[1]} are typing`;
            } else {
                typingText = `${typingArray.length} people are typing`;
            }

            typingIndicators.innerHTML = `
                <div class="typing-indicator">
                    <span>${typingText}</span>
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            `;
        } else {
            typingIndicators.innerHTML = '';
        }
    }

    toggleUsersSidebar() {
        const sidebar = document.getElementById('usersSidebar');
        sidebar.classList.toggle('hidden');
    }

    leaveChat() {
        if (confirm('Are you sure you want to leave the chat?')) {
            this.socket.disconnect();
            location.reload();
        }
    }

    updateConnectionStatus(status) {
        const connectionStatus = document.getElementById('connectionStatus');
        const statusText = connectionStatus.querySelector('span');
        
        connectionStatus.className = `connection-status ${status}`;
        
        switch (status) {
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
        }
    }

    scrollToBottom() {
        const messagesList = document.getElementById('messagesList');
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the chat application
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});