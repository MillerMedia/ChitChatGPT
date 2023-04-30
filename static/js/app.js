const chatList = document.querySelector('.sidebar');
const chatBox = document.querySelector('.chat');
const inputField = document.querySelector('input[type="text"]');
const sendButton = document.querySelector('button');
const chatTemplate = document.querySelector('#chat-template').innerHTML;

let chatSessions = {};
let activeChatId = null;

sendButton.addEventListener('click', sendMessage);

inputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

const newChatButton = document.querySelector('.new-chat-btn');
newChatButton.addEventListener('click', createNewChat);

function sendMessage() {
  const message = inputField.value.trim();
  if (!message) return;
  addMessageToChat('user', message);
  inputField.value = '';

  const chatHistory = chatBox.innerText.split('\n').filter(line => line);

  fetch('/get_response', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message,
      chat_history: chatHistory,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      addMessageToChat('assistant', data.message, data.tokens_used, data.token_cost);
      updateTokenInfo(data.tokens_used, data.token_cost);

      chatSessions[activeChatId].content = chatBox.innerHTML;
      fetch('/save_chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_data: chatSessions,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          console.log('Chat saved successfully');
        })
        .catch((error) => {
          console.error('Error saving chat:', error);
        });
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

function addMessageToChat(sender, message, tokens_used, token_cost = 0) {
    var data = {
        sender: sender + "-message",
        message: message
    };

    if (sender === "assistant") {
        data.token_info = `Tokens used: ${tokens_used}, Cost: $${token_cost.toFixed(4)}`;
    }

    var chatTemplate = document.getElementById('chat-template');
    var output = Mustache.render(chatTemplate.innerHTML, data);
    chat.insertAdjacentHTML("beforeend", output);
}

function updateTokenInfo(tokens_used, token_cost) {
  const tokenInfo = `Tokens used: ${tokens_used} | Cost: $${token_cost.toFixed(
    5
  )}`;
  document.querySelector('.token-info').innerText = tokenInfo;
}

async function createNewChat() {
  const chatId = Date.now().toString();
  const chatName = `Chat ${Object.keys(chatSessions).length + 1}`;

  // Create a new chat session object for this chat
  chatSessions[chatId] = { name: chatName, content: '' };

  // Create a new link in the sidebar for this chat
  const chatLink = document.createElement('a');
  chatLink.href = '#';
  chatLink.innerText = chatName;
  chatLink.dataset.chatId = chatId;
  chatLink.classList.add('chat-link');
  chatLink.addEventListener('click', (e) => {
    e.preventDefault();
    switchChat(chatId);
  });

  // Add the link to the sidebar
  chatList.appendChild(chatLink);

  // Fetch the list of saved chats from the server
  const response = await fetch('/get_saved_chats');
  const data = await response.json();

  // For each saved chat, load the chat data from the server and update the chat session object
    for (const chatId in data.saved_chats) {
      const chatData = data.saved_chats[chatId];
      chatSessions[chatId] = { name: chatData.name, content: chatData.content };

      // Create a new link in the sidebar for this chat
      const chatLink = document.createElement('a');
      chatLink.href = '#';
      chatLink.innerText = chatData.name;
      chatLink.dataset.chatId = chatId;
      chatLink.classList.add('chat-link');
      chatLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchChat(chatId);
      });

      // Add the link to the sidebar
      chatList.appendChild(chatLink);
    }



  // Switch to the new chat
  switchChat(chatId);
}

function switchChat(chatId) {
  if (activeChatId === chatId) return;

  if (activeChatId) {
    chatSessions[activeChatId].content = chatBox.innerHTML;
    document.querySelector(`[data-chat-id="${activeChatId}"]`).classList.remove('active');
  }

  activeChatId = chatId;
  chatBox.innerHTML = chatSessions[chatId].content || '';
  chatBox.scrollTop = chatBox.scrollHeight;
  document.querySelector(`[data-chat-id="${chatId}"]`).classList.add('active');
}

createNewChat();
