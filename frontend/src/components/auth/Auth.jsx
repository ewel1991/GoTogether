import React, { useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

function Auth({ onLogin }) {
  const [activeForm, setActiveForm] = useState("signin");

  return (
    <div className="auth-container">
      {activeForm === "signup" ? (
        <RegisterForm
          onRegister={onLogin}
          onSwitch={() => setActiveForm("signin")}
        />
      ) : (
        <LoginForm
          onLogin={onLogin}
          onSwitch={() => setActiveForm("signup")}
        />
      )}
    </div>
  );
}

export default Auth;
