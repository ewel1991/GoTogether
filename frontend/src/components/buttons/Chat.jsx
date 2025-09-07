import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_URL = "http://localhost:3000";
const socket = io(API_URL, { withCredentials: true });

const Chat = ({ type, id, user }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!id) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_URL}/chat/${type}/${id}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Błąd pobierania wiadomości");
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();

    socket.emit("joinRoom", { type, id });

    socket.on("newMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("newMessage");
    };
  }, [type, id]);

  const sendMessage = () => {
    if (!input.trim()) return;

    socket.emit("sendMessage", {
      type,
      id,
      senderId: user.id,
      message: input,
    });

    setInput("");
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-message ${
              m.sender_id === user.id ? "right" : "left"
            }`}
          >
            <div
              className={`chat-bubble ${
                m.sender_id === user.id ? "right" : "left"
              }`}
            >
              <strong style={{ fontSize: "0.85em" }}>
                {m.sender_id === user.id ? "Ty" : m.sender_name || m.sender_id}
              </strong>
              <div>{m.message}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="chat-input-container">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Napisz wiadomość..."
          className="chat-input"
        />
        <button onClick={sendMessage} className="chat-button">
          Wyślij
        </button>
      </div>
    </div>
  );
};

export default Chat;
