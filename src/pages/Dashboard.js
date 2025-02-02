import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

function Dashboard() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await auth.signOut();
        navigate("/login"); // Redirect to login page after logout
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Dashboard</h1>
            <div style={styles.menu}>
                <button onClick={() => navigate("/add-leads")} style={styles.menuButton}>
                    📧 Leads
                </button>
                <button onClick={() => navigate("/add-emails")} style={styles.menuButton}>
                    👥 Emails
                </button>
                {/* New button: Campaigns */}
                <button onClick={() => navigate("/manage-campaigns")} style={styles.menuButton}>
                    🎯 Campaigns
                </button>
            </div>
            <button onClick={handleLogout} style={styles.logoutButton}>
                🚪 Logout
            </button>
        </div>
    );
}

// Internal CSS Styles
const styles = {
    container: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "linear-gradient(to right, #ece9e6, #ffffff)",
    },
    title: {
        fontSize: "28px",
        fontWeight: "bold",
        marginBottom: "20px",
        color: "#333",
    },
    menu: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr", // now we have 3 columns
        gap: "20px",
        padding: "20px",
        background: "#ffffff",
        boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
        borderRadius: "10px",
        minWidth: "380px",
    },
    menuButton: {
        padding: "15px",
        fontSize: "16px",
        background: "#007bff",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "0.3s ease",
    },
    logoutButton: {
        marginTop: "20px",
        padding: "12px 20px",
        fontSize: "16px",
        background: "#dc3545",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "0.3s ease",
    },
};

export default Dashboard;
