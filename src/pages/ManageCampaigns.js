import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

function ManageCampaigns() {
    const navigate = useNavigate();

    // Local state for campaigns loaded from Firestore
    const [campaigns, setCampaigns] = useState([]);

    // Basic filters & search
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [senderFilter, setSenderFilter] = useState("All");
    const [tagFilter, setTagFilter] = useState("All");
    const [creatorFilter, setCreatorFilter] = useState("All");

    // For the "Create campaign" flow
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCampaignName, setNewCampaignName] = useState("");

    // Loader & success message
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Automatically clear success messages after 3 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(""), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // ====== FETCH CAMPAIGNS FROM FIRESTORE ======
    useEffect(() => {
        const fetchCampaigns = async () => {
            try {
                setIsLoading(true);
                const snapshot = await getDocs(collection(db, "campaigns"));
                const data = snapshot.docs.map((docSnap) => {
                    const campaignData = docSnap.data();

                    return {
                        id: docSnap.id,
                        campaignName: campaignData.campaignName || "Untitled",
                        status: campaignData.status ?? true,
                        leadsCompleted: campaignData.leadsCompleted || "0/0",
                        sender: campaignData.sender || { name: "", avatarUrl: "" },
                        tag: campaignData.tag || "",
                        createdAt: campaignData.createdAt
                            ? new Date(campaignData.createdAt.toDate()).toLocaleString()
                            : "No date",
                    };
                });
                setCampaigns(data);
                setIsLoading(false);
            } catch (error) {
                console.error("Error fetching campaigns:", error);
                setIsLoading(false);
            }
        };

        fetchCampaigns();
    }, []);

    // ====== FILTER / SEARCH LOGIC ======
    const filteredCampaigns = campaigns.filter((c) => {
        // 1) Matches search by campaignName
        const matchesSearch = c.campaignName
            .toLowerCase()
            .includes(searchTerm.toLowerCase());

        // 2) Check status filter
        let matchesStatus = true;
        if (statusFilter === "Active" && !c.status) {
            matchesStatus = false;
        } else if (statusFilter === "Inactive" && c.status) {
            matchesStatus = false;
        }
        // Additional filters (sender, tag, creator) can be added similarly if needed

        return matchesSearch && matchesStatus;
    });

    // ====== START/STOP CAMPAIGN IN FIRESTORE ======
    const toggleStatus = async (id, oldStatus) => {
        try {
            setIsLoading(true);
            const campaignRef = doc(db, "campaigns", id);
            await updateDoc(campaignRef, { status: !oldStatus });
            setCampaigns((prev) =>
                prev.map((camp) =>
                    camp.id === id ? { ...camp, status: !oldStatus } : camp
                )
            );
            setIsLoading(false);
        } catch (error) {
            console.error("Error updating status:", error);
            setIsLoading(false);
        }
    };

    // Example "actions" button
    const handleActions = (id) => {
        alert(`Actions clicked for campaign ID: ${id}`);
    };

    // ====== CREATE A NEW CAMPAIGN ======
    const handleOpenCreateModal = () => {
        setNewCampaignName("");
        setShowCreateModal(true);
    };

    const handleCloseCreateModal = () => {
        setShowCreateModal(false);
    };

    const handleCreateCampaign = async () => {
        if (!newCampaignName.trim()) {
            alert("Please enter a campaign name.");
            return;
        }
        try {
            setIsLoading(true);
            const docRef = await addDoc(collection(db, "campaigns"), {
                campaignName: newCampaignName,
                status: true,
                leadsCompleted: "0/0",
                sender: { name: "", avatarUrl: "" },
                tag: "",
                createdAt: serverTimestamp(),
            });

            setShowCreateModal(false);
            setNewCampaignName("");
            setIsLoading(false);
            //hereweare
            navigate(`/create-campaign/${docRef.id}`)

            setMessage("Campaign created successfully!");

            // Navigate to the create-campaign screen, if desired
            // Example: navigate(`/create-campaign/${docRef.id}`);
        } catch (error) {
            console.error("Error creating campaign:", error);
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            {/* Loader Overlay */}
            {isLoading && (
                <div style={styles.loaderOverlay}>
                    <div style={styles.loader}>Loading...</div>
                </div>
            )}

            {/* Optional success message */}
            {message && <div style={styles.message}>{message}</div>}

            <h2 style={styles.pageTitle}>Campaigns</h2>

            {/* Search + Filters */}
            <div style={styles.filters}>
                <input
                    type="text"
                    placeholder="Search a campaign..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={styles.searchInput}
                />

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={styles.filterDropdown}
                >
                    <option value="All">Status: All</option>
                    <option value="Active">Status: Active</option>
                    <option value="Inactive">Status: Inactive</option>
                </select>

                <select
                    value={senderFilter}
                    onChange={(e) => setSenderFilter(e.target.value)}
                    style={styles.filterDropdown}
                >
                    <option value="All">Senders: All</option>
                    <option value="John Doe">John Doe</option>
                    {/* Add more senders if needed */}
                </select>

                <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    style={styles.filterDropdown}
                >
                    <option value="All">Tags: All</option>
                    <option value="tag1">Tag1</option>
                    <option value="tag2">Tag2</option>
                </select>

                <select
                    value={creatorFilter}
                    onChange={(e) => setCreatorFilter(e.target.value)}
                    style={styles.filterDropdown}
                >
                    <option value="All">Creators: All</option>
                    <option value="Me">Me</option>
                    {/* etc. */}
                </select>
            </div>

            {/* Table header */}
            <div style={styles.tableHeader}>
                <button style={styles.createCampaignButton} onClick={handleOpenCreateModal}>
                    Create a new campaign
                </button>
            </div>

            {/* Campaigns Table */}
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th>Action</th>
                        <th>Campaign Name</th>
                        <th>Leads completed</th>
                        <th>Sender</th>
                        <th>Tag</th>
                        <th>Created at</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredCampaigns.map((camp) => (
                        <tr key={camp.id}>
                            {/* Start / Stop button */}
                            <td>
                                <button
                                    style={styles.statusButton}
                                    onClick={() => toggleStatus(camp.id, camp.status)}
                                >
                                    {camp.status ? "Stop" : "Start"}
                                </button>
                            </td>
                            <td> <span
                                style={styles.campaignLink}
                                onClick={() => navigate(`/create-campaign/${camp.id}`)}
                            >
                                {camp.campaignName}
                            </span></td>
                            <td>{camp.leadsCompleted}</td>
                            <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                    {camp.sender.avatarUrl && camp.sender.avatarUrl.length > 0 && (
                                        <img
                                            src={camp.sender.avatarUrl}
                                            alt="Avatar"
                                            style={{ width: "25px", height: "25px", borderRadius: "50%" }}
                                        />
                                    )}
                                    <span>{camp.sender.name}</span>
                                </div>
                            </td>
                            <td>{camp.tag}</td>
                            <td>{camp.createdAt}</td>
                            <td>
                                <button style={styles.dotsButton} onClick={() => handleActions(camp.id)}>
                                    ⋯
                                </button>
                            </td>
                        </tr>
                    ))}
                    {filteredCampaigns.length === 0 && (
                        <tr>
                            <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
                                No campaigns found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* CREATE CAMPAIGN MODAL */}
            {showCreateModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h3 style={{ marginBottom: "15px" }}>Create New Campaign</h3>
                        <input
                            type="text"
                            placeholder="Enter campaign name"
                            value={newCampaignName}
                            onChange={(e) => setNewCampaignName(e.target.value)}
                            style={styles.modalInput}
                        />
                        <div style={styles.modalActions}>
                            <button style={styles.modalButton} onClick={handleCreateCampaign}>
                                Proceed
                            </button>
                            <button
                                style={{ ...styles.modalButton, backgroundColor: "#ccc", color: "#333" }}
                                onClick={handleCloseCreateModal}
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

// ======= Inline Styles =======
const styles = {
    container: {
        position: "relative",
        padding: "20px",
    },
    loaderOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.6)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    loader: {
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "8px",
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
    pageTitle: {
        fontSize: "24px",
        marginBottom: "20px",
    },
    filters: {
        display: "flex",
        gap: "10px",
        marginBottom: "20px",
    },
    searchInput: {
        flex: "1",
        padding: "8px",
        borderRadius: "4px",
        border: "1px solid #ccc",
    },
    filterDropdown: {
        padding: "8px",
        borderRadius: "4px",
        border: "1px solid #ccc",
        backgroundColor: "#fff",
    },
    tableHeader: {
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: "10px",
    },
    createCampaignButton: {
        backgroundColor: "#007bff",
        color: "white",
        border: "none",
        padding: "10px 15px",
        borderRadius: "5px",
        cursor: "pointer",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        background: "#fff",
    },
    statusButton: {
        backgroundColor: "#6c757d",
        color: "#fff",
        border: "none",
        padding: "6px 10px",
        borderRadius: "4px",
        cursor: "pointer",
    },
    dotsButton: {
        background: "none",
        border: "none",
        fontSize: "20px",
        cursor: "pointer",
    },
    // ===== Modal Styles =====
    modalOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
    },
    modal: {
        backgroundColor: "white",
        padding: "20px",
        borderRadius: "8px",
        minWidth: "300px",
    },
    modalInput: {
        width: "100%",
        padding: "8px",
        marginBottom: "15px",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "4px",
    },
    modalActions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
    },
    modalButton: {
        backgroundColor: "#28a745",
        color: "white",
        border: "none",
        padding: "8px 12px",
        borderRadius: "4px",
        cursor: "pointer",
    },
    campaignLink: {
        color: "#007bff",
        textDecoration: "underline",
        cursor: "pointer",
    },
};

export default ManageCampaigns;
