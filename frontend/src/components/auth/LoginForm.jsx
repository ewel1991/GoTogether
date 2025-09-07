import React, { useState } from "react";

function LoginForm({ onSwitch, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", 
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await response.json();
      console.log("✅ Login response:", data); 

      if (response.ok) {
      onLogin(); 
    } else {
      alert(data.message || "Login failed");
    }
    } catch (err) {
      console.error("Login error:", err);
      alert("Something went wrong. Try again later.");
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h3>Welcome Back!</h3>
      <button type="button" 
      className="google"
      onClick={() => {
      window.location.href = "http://localhost:3000/auth/google";
    }}
      >Log In with Google</button>
      <p>- or -</p>

      <input
        type="email"
        name="email"
        placeholder="Insert eMail"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        name="password"
        placeholder="Insert Password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button type="submit">Log In</button>

      <div className="form-toggle">
        <button type="button" onClick={onSwitch}>
          Don't have an account? Sign Up
        </button>
      </div>
    </form>
  );
}

export default LoginForm;
