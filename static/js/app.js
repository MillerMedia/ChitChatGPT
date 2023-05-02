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

async function sendMessage() {
  const message = inputField.value.trim();
  if (!message) return;

  // Add the user's message to the chat history and UI
  addMessageToChat("user", message);
  inputField.value = "";

  const chatHistory = chatSessions[activeChatId] ? chatSessions[activeChatId].messages : [];

  // Fetch the assistant's response
  const response = await fetch("/get_response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, chat_history: chatHistory }),
  });

  const data = await response.json();

  // Add the assistant's message to the chat history and UI
  addMessageToChat("assistant", data.message, data.tokens_used, data.token_cost);

  // Save the current chat session
  saveChat();
}

function saveChat() {
  // Check if there are any messages in the current chat session
  if (chatSessions[activeChatId].messages.length === 0) {
    return;
  }

  let chatSessionsToSave = {};

  for(const chatId in chatSessions) {
    if (chatSessions[chatId].messages.length > 0) {
      chatSessionsToSave[chatId] = chatSessions[chatId];
    }
  }

  fetch("/save_chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_data: chatSessionsToSave }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Chats saved successfully");
    })
    .catch((error) => {
      console.error("Error saving chat:", error);
    });
}

function addMessageToChat(sender, message, tokens_used, token_cost = 0) {
  const data = {
    sender: sender + "-message",
    message: message
  };

  if (sender === "assistant") {
      data.token_info = `Tokens used: ${tokens_used}, Cost: $${token_cost.toFixed(4)}`;
  }

  const chatTemplate = document.getElementById('chat-template');
  const output = Mustache.render(chatTemplate.innerHTML, data);
  chat.insertAdjacentHTML("beforeend", output);

  // Add the message to chatSessions as plain text
  if (!chatSessions[activeChatId].messages) {
    chatSessions[activeChatId].messages = [];
  }

  const chat_info = {role: sender, content: message};

  if (sender === "assistant") {
    chat_info["tokens_used"] = tokens_used;
    chat_info["token_cost"] = token_cost;
  }

  chatSessions[activeChatId].messages.push(chat_info);
}

async function createNewChat() {
  const chatId = Date.now().toString();
  const chatName = `Chat ${Object.keys(chatSessions).length + 1}`;

  // Create a new chat session object for this chat
  chatSessions[chatId] = { name: chatName, messages: [] };

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
  chatList.insertBefore(chatLink, newChatButton.nextSibling);

  // Switch to the new chat
  switchChat(chatId);
}

async function loadSavedChats() {
  const response = await fetch('/get_saved_chats', { method: 'GET' });

  if (response.status === 200) {
    const data = await response.json();

    for (const chatId in data.saved_chats) {
      // Add the saved chat to chatSessions without overwriting it
      let parsedChatId = chatId.replace('chat_', '');

      chatSessions[parsedChatId] = data.saved_chats[chatId];

      const chatName = chatSessions[parsedChatId].name;

      // Create a new link in the sidebar for this chat
      const chatLink = document.createElement('a');
      chatLink.href = '#';
      chatLink.innerText = chatName;
      chatLink.dataset.chatId = parsedChatId;
      chatLink.classList.add('chat-link');
      chatLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchChat(parsedChatId);
      });

      // Add the link to the sidebar
      chatList.appendChild(chatLink);
    }
  }
}

function switchChat(chatId) {
  if (activeChatId === chatId) return;

  if (activeChatId) {
    document.querySelector(`[data-chat-id="${activeChatId}"]`).classList.remove('active');
  }

  activeChatId = chatId;

  // Clear the chatBox and add messages from the chatSessions[chatId].messages array
  chatBox.innerHTML = '';
  chatSessions[chatId].messages.forEach(msg => {
    const data = {
      sender: msg.role + "-message",
      message: msg.content
    };

    if (msg.role === "assistant") {
      data.token_info = `Tokens used: ${msg.tokens_used}, Cost: $${(msg.token_cost).toFixed(4)}`;
    }

    const output = Mustache.render(chatTemplate, data);
    chatBox.insertAdjacentHTML("beforeend", output);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
  document.querySelector(`[data-chat-id="${chatId}"]`).classList.add('active');
}

(async () => {
  await loadSavedChats();
  createNewChat();
})();

