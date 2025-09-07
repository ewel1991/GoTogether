import React, { useState } from "react";

function RegisterForm({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordCheck, setPasswordCheck] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationErrors([]);

    if (password !== passwordCheck) {
      setValidationErrors(["Hasła muszą być takie same!"]);
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailReg: email,
          passwordReg: password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Rejestracja udana! Zaloguj się.");
        onSwitch(); 
      } else {
        if (data.errors && Array.isArray(data.errors)) {
          setValidationErrors(data.errors);
        } else {
          setValidationErrors([data.message || "Nieznany błąd rejestracji"]);
        }
      }
    } catch (err) {
      console.error("Rejestracja – błąd:", err);
      setValidationErrors(["Coś poszło nie tak. Spróbuj ponownie później."]);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h3>Create Your Account</h3>
      <p>Just enter your email address and your password to join.</p>
         
      {validationErrors.length > 0 && (
      <ul className="error-list" style={{ color: "red", paddingLeft: "1rem" }}>
        {validationErrors.map((err, idx) => (
          <li key={idx}>{err}</li>
        ))}
      </ul>
        )}
      <input
        type="email"
        name="emailReg"
        placeholder="Insert eMail"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        name="passwordReg"
        placeholder="Insert Password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        name="passwordRegCheck"
        placeholder="Verify Password"
        required
        value={passwordCheck}
        onChange={(e) => setPasswordCheck(e.target.value)}
      />
      <button type="submit">Sign Up</button>
      <div className="form-toggle">
        <button type="button" onClick={onSwitch}>
          Already have an account? Log In
        </button>
      </div>
    </form>
  );
}

export default RegisterForm;
