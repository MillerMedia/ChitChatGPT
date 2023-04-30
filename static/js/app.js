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

  const chatHistory = chatSessions[activeChatId].messages;

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
  fetch("/save_chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_data: chatSessions }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Chat saved successfully");
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
  chatList.appendChild(chatLink);

  // Switch to the new chat
  switchChat(chatId);
}

function switchChat(chatId) {
  if (activeChatId === chatId) return;

  if (activeChatId) {
    // Remove this line:
    // chatSessions[activeChatId].content = chatBox.innerHTML;
    document.querySelector(`[data-chat-id="${activeChatId}"]`).classList.remove('active');
  }

  activeChatId = chatId;

  // Clear the chatBox and add messages from the chatSessions[chatId].messages array
  chatBox.innerHTML = '';
  chatSessions[chatId].messages.forEach(msg => {
    addMessageToChat(msg.role, msg.content);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
  document.querySelector(`[data-chat-id="${chatId}"]`).classList.add('active');
}

createNewChat();
