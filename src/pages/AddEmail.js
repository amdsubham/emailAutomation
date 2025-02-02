import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
} from "firebase/firestore";

function AddEmail() {
    // ===== States =====
    const [emails, setEmails] = useState([]);
    const [nameInput, setNameInput] = useState("");
    const [emailInput, setEmailInput] = useState("");

    // For edit modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");

    // Loader & messages
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    // ===== Fetch Emails on Mount =====
    useEffect(() => {
        fetchEmails();
    }, []);

    // Helper to clear messages after 3 seconds
    useEffect(() => {
        if (message || errorMsg) {
            const timer = setTimeout(() => {
                setMessage("");
                setErrorMsg("");
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [message, errorMsg]);

    // ===== Fetch Emails from Firestore =====
    const fetchEmails = async () => {
        try {
            setIsLoading(true);
            const snapshot = await getDocs(collection(db, "emails"));
            const data = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            }));
            setEmails(data);
            setIsLoading(false);
        } catch (error) {
            console.error("Error fetching emails:", error);
            setErrorMsg("Failed to fetch emails");
            setIsLoading(false);
        }
    };

    // ===== Add a New Email to Firestore =====
    const handleAddEmail = async (e) => {
        e.preventDefault();
        if (!nameInput.trim() || !emailInput.trim()) {
            setErrorMsg("Please fill in both name and email.");
            return;
        }
        try {
            setIsLoading(true);
            await addDoc(collection(db, "emails"), {
                name: nameInput,
                email: emailInput,
            });
            setNameInput("");
            setEmailInput("");
            setMessage("Email created successfully!");
            fetchEmails(); // Refresh list
        } catch (error) {
            console.error("Error adding email:", error);
            setErrorMsg("Failed to add email");
        } finally {
            setIsLoading(false);
        }
    };

    // ===== Open Edit Modal =====
    const openEditModal = (emailObj) => {
        setEditId(emailObj.id);
        setEditName(emailObj.name);
        setEditEmail(emailObj.email);
        setIsEditModalOpen(true);
    };

    // ===== Save Edits to Firestore =====
    const handleEditSave = async () => {
        if (!editName.trim() || !editEmail.trim()) {
            setErrorMsg("Please fill in both name and email.");
            return;
        }
        try {
            setIsLoading(true);
            const docRef = doc(db, "emails", editId);
            await updateDoc(docRef, {
                name: editName,
                email: editEmail,
            });
            setMessage("Email updated successfully!");
            setIsEditModalOpen(false);
            fetchEmails();
        } catch (error) {
            console.error("Error updating email:", error);
            setErrorMsg("Failed to update email");
        } finally {
            setIsLoading(false);
        }
    };

    // ===== Delete an Email =====
    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this email?")) return;

        try {
            setIsLoading(true);
            await deleteDoc(doc(db, "emails", id));
            setMessage("Email deleted successfully!");
            fetchEmails();
        } catch (error) {
            console.error("Error deleting email:", error);
            setErrorMsg("Failed to delete email");
        } finally {
            setIsLoading(false);
        }
    };

    // ===== Render =====
    return (
        <div style={styles.container}>
            {/* Loader Overlay */}
            {isLoading && (
                <div style={styles.loaderOverlay}>
                    <div style={styles.loader}>Loading...</div>
                </div>
            )}

            {/* Success or Error Messages */}
            {message && <div style={styles.message}>{message}</div>}
            {errorMsg && <div style={styles.error}>{errorMsg}</div>}

            <h2 style={styles.title}>Add Emails</h2>

            {/* Form to add new email */}
            <form style={styles.form} onSubmit={handleAddEmail}>
                <input
                    style={styles.input}
                    type="text"
                    placeholder="Name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                />
                <input
                    style={styles.input}
                    type="email"
                    placeholder="Email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                />
                <button style={styles.addButton} type="submit">
                    Add Email
                </button>
            </form>

            {/* Emails Table */}
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={{ width: "30%" }}>Name</th>
                        <th style={{ width: "40%" }}>Email</th>
                        <th style={{ width: "30%" }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {emails.map((emailObj) => (
                        <tr key={emailObj.id}>
                            <td>{emailObj.name}</td>
                            <td>{emailObj.email}</td>
                            <td>
                                <button
                                    style={styles.editButton}
                                    onClick={() => openEditModal(emailObj)}
                                >
                                    Edit
                                </button>
                                <button
                                    style={styles.deleteButton}
                                    onClick={() => handleDelete(emailObj.id)}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                    {emails.length === 0 && (
                        <tr>
                            <td colSpan="3" style={{ textAlign: "center", padding: "10px" }}>
                                No emails found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h3>Edit Email</h3>
                        <input
                            style={styles.modalInput}
                            type="text"
                            placeholder="Name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                        />
                        <input
                            style={styles.modalInput}
                            type="email"
                            placeholder="Email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                        />

                        <div style={styles.modalActions}>
                            <button style={styles.saveButton} onClick={handleEditSave}>
                                Save
                            </button>
                            <button
                                style={styles.cancelButton}
                                onClick={() => setIsEditModalOpen(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ===== Styles =====
const styles = {
    container: {
        position: "relative",
        padding: "20px",
        maxWidth: "800px",
        margin: "0 auto",
    },
    title: {
        fontSize: "24px",
        marginBottom: "20px",
    },
    form: {
        display: "flex",
        gap: "10px",
        marginBottom: "20px",
    },
    input: {
        flex: "1",
        padding: "8px",
        border: "1px solid #ccc",
        borderRadius: "4px",
    },
    addButton: {
        backgroundColor: "#28a745",
        color: "#fff",
        border: "none",
        padding: "8px 15px",
        borderRadius: "4px",
        cursor: "pointer",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        marginBottom: "20px",
    },
    editButton: {
        backgroundColor: "#007bff",
        color: "#fff",
        border: "none",
        marginRight: "5px",
        padding: "6px 10px",
        borderRadius: "4px",
        cursor: "pointer",
    },
    deleteButton: {
        backgroundColor: "#dc3545",
        color: "#fff",
        border: "none",
        padding: "6px 10px",
        borderRadius: "4px",
        cursor: "pointer",
    },
    // Loader & messages
    loaderOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    loader: {
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "6px",
        boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        fontWeight: "bold",
        fontSize: "16px",
    },
    message: {
        backgroundColor: "#28a745",
        color: "#fff",
        padding: "10px",
        borderRadius: "5px",
        marginBottom: "10px",
    },
    error: {
        backgroundColor: "#dc3545",
        color: "#fff",
        padding: "10px",
        borderRadius: "5px",
        marginBottom: "10px",
    },
    // Modal
    modalOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    modal: {
        backgroundColor: "white",
        padding: "20px",
        borderRadius: "6px",
        minWidth: "300px",
        maxWidth: "90%",
    },
    modalInput: {
        width: "100%",
        marginBottom: "10px",
        padding: "8px",
        border: "1px solid #ccc",
        borderRadius: "4px",
    },
    modalActions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
    },
    saveButton: {
        backgroundColor: "#28a745",
        color: "#fff",
        border: "none",
        padding: "8px 15px",
        borderRadius: "4px",
        cursor: "pointer",
    },
    cancelButton: {
        backgroundColor: "#ccc",
        color: "#333",
        border: "none",
        padding: "8px 15px",
        borderRadius: "4px",
        cursor: "pointer",
    },
};

export default AddEmail;
