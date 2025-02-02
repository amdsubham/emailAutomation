import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import "../styles/Login.css"; // Import external CSS file

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignup, setIsSignup] = useState(false);
    const navigate = useNavigate(); // Initialize navigation

    const handleAuth = async () => {
        console.log("🔹 isSignup:", isSignup);
        try {
            let userCredential;
            if (isSignup) {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log("✅ User Signed Up:", userCredential.user);
            } else {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log("✅ User Logged In:", userCredential.user);
            }

            navigate("/"); // Redirect to dashboard after login
        } catch (error) {
            console.error("❌ Auth Error:", error.message);
            alert(error.message); // Show error message to the user
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>{isSignup ? "Create an Account" : "Login"}</h2>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                />
                <button onClick={handleAuth} className="auth-button">
                    {isSignup ? "Sign Up" : "Login"}
                </button>
                <p onClick={() => setIsSignup(!isSignup)} className="toggle-text">
                    {isSignup ? "Already have an account? Login" : "Create an account"}
                </p>
            </div>
        </div>
    );
}

export default Login;
