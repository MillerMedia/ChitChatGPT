import os
import json
import time
import openai
from flask import Flask, render_template, request, jsonify
from markupsafe import Markup
from transformers import GPT2Tokenizer

tokenizer = GPT2Tokenizer.from_pretrained("gpt2")

api_key = os.environ["OPENAI_API_KEY"]

openai.api_key = api_key

app = Flask(__name__)
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
app.config['JSONIFY_ESCAPE'] = False

total_tokens_used = 0
model_to_use = 'gpt-4'

PRICE_PER_TOKEN = 0.00006


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/get_response", methods=["POST"])
def get_response():
    global total_tokens_used

    data = request.get_json()
    user_input = data["message"]
    chat_history = data["chat_history"]

    # Limit chat history to the last few messages if too many tokens
    MAX_HISTORY_TOKENS = 4096 - 150  # reserve some tokens for the user input and the generated response
    history_tokens = 0
    truncated_chat_history = []

    for message in reversed(chat_history):
        message_tokens = len(tokenizer.encode(message))
        if history_tokens + message_tokens <= MAX_HISTORY_TOKENS:
            history_tokens += message_tokens
            truncated_chat_history.insert(0, message)
        else:
            break

    # Prepare the arguments for the ChatCompletion.create call
    chat_completion_args = {
        "model": "{}".format(model_to_use),
        "messages": [
            {"role": "system",
             "content": "When providing code in your response, please make sure to separate it from the text using the delimiter '---code---' before and after the code segment."},
            *truncated_chat_history,
            {"role": "user", "content": user_input}
        ],
        "max_tokens": 150,
        "n": 1,
        "stop": None,
        "temperature": 0.5,
    }

    response = openai.ChatCompletion.create(**chat_completion_args)

    message = response['choices'][0]['message']['content'].replace("User:", "").strip()
    segments = message.split('---code---')
    formatted_segments = []

    for i, segment in enumerate(segments):
        if i % 2 == 1:  # Code segment
            formatted_segments.append(f'<pre><code>{segment}</code></pre>')
        else:  # Non-code segment
            formatted_segments.append(segment)

    # If the delimiter is not used, wrap the entire response in a single <p> element
    if len(formatted_segments) == 1:
        formatted_message = Markup(f'<p>{formatted_segments[0]}</p>')
    else:
        formatted_message = Markup(formatted_segments)

    tokens_used = response['usage']['total_tokens']
    total_tokens_used += tokens_used
    token_cost = tokens_used * PRICE_PER_TOKEN

    return jsonify({"message": formatted_message, "tokens_used": tokens_used, "token_cost": token_cost})


@app.route("/get_total_tokens_used", methods=["GET"])
def get_total_tokens_used():
    global total_tokens_used
    return jsonify({"total_tokens_used": total_tokens_used})


@app.route('/save_chat', methods=['POST'])
def save_chat():
    chat_data = request.json["chat_data"]
    timestamp = int(time.time())
    file_name = f'chat_{timestamp}'

    # Save the session_id with the chat data
    chat_data_to_save = {
        'content': chat_data
    }

    with open(f'chats/{file_name}.json', 'w') as f:
        json.dump(chat_data_to_save, f)

    print(f'Saved chat data: {chat_data}')

    return jsonify({"status": "success", "file_name": file_name})


@app.route('/get_saved_chats', methods=['GET'])
def get_saved_chats():
    if not os.path.exists('chats'):
        os.makedirs('chats')

    saved_chats = {}
    for file in os.listdir('chats'):
        if file.endswith('.json'):
            with open(f'chats/{file}', 'r') as f:
                chat_data = json.load(f)
                if 'content' in chat_data:
                    chat_id = os.path.splitext(file)[0]
                    timestamp = list(chat_data['content'].keys())[0]
                    saved_chats[chat_id] = chat_data['content'][timestamp]
    return jsonify({'saved_chats': saved_chats})


@app.route('/load_chat', methods=['POST'])
def load_chat():
    file_name = request.json["file_name"]

    if os.path.exists(f'chats/{file_name}.json'):
        with open(f'chats/{file_name}.json', 'r') as f:
            chat_data = json.load(f)
        print(f'Loaded chat data: {chat_data}')
        return jsonify({"chat_data": chat_data})
    else:
        return jsonify({"status": "not_found"})


if __name__ == '__main__':
    if not os.path.exists('chats'):
        os.makedirs('chats')
    app.run(debug=True)
