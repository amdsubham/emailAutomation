import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    arrayUnion,
    arrayRemove,
    deleteDoc,
} from "firebase/firestore";
import Papa from "papaparse";

// === Pagination Table Component ===
function LeadsTable({
    leads,
    selectedLeads,
    toggleLeadSelection,
    currentPage,
    leadsPerPage,
    onPageChange,
    onDeleteLead,
}) {
    // 1) Determine current leads for the page, based on pagination
    const indexOfLastLead = currentPage * leadsPerPage;
    const indexOfFirstLead = indexOfLastLead - leadsPerPage;
    const currentLeads = leads.slice(indexOfFirstLead, indexOfLastLead);

    // 2) Figure out how many pages in total
    const totalPages = Math.ceil(leads.length / leadsPerPage);

    return (
        <>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th>Select</th>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Company Name</th>
                        <th>Job Title</th>
                        <th>Campaign(s)</th>
                        <th>Actions</th> {/* for single‐row delete */}
                    </tr>
                </thead>
                <tbody>
                    {currentLeads.map((lead) => (
                        <tr key={lead.id}>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={selectedLeads.includes(lead.id)}
                                    onChange={() => toggleLeadSelection(lead.id)}
                                />
                            </td>
                            <td>{lead.fullName}</td>
                            <td>{lead.email}</td>
                            <td>{lead.companyName}</td>
                            <td>{lead.jobTitle}</td>
                            {/* Join multiple campaigns with commas if present */}
                            <td>
                                {Array.isArray(lead.campaign)
                                    ? lead.campaign.join(", ")
                                    : ""}
                            </td>
                            <td>
                                <button
                                    onClick={() => onDeleteLead(lead.id)}
                                    style={styles.deleteButton}
                                >
                                    🗑️ Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Simple Pagination Controls */}
            <div style={styles.paginationContainer}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                        key={page}
                        style={
                            page === currentPage
                                ? { ...styles.pageButton, ...styles.activePageButton }
                                : styles.pageButton
                        }
                        onClick={() => onPageChange(page)}
                    >
                        {page}
                    </button>
                ))}
            </div>
        </>
    );
}

// === Main Component ===
function AddLeads() {
    // ======== States ========
    const [leads, setLeads] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteProgress, setDeleteProgress] = useState(0);

    // CSV file
    const [csvFile, setCsvFile] = useState(null);

    // Selected leads
    const [selectedLeads, setSelectedLeads] = useState([]);

    // For multiple campaigns, we track which campaigns are "checked"
    const [campaignSelections, setCampaignSelections] = useState({});

    // Loaders
    const [isFetchingLeads, setIsFetchingLeads] = useState(false);
    const [isImportingCSV, setIsImportingCSV] = useState(false);
    const [isAssigningCampaign, setIsAssigningCampaign] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 20;

    // Filter by campaign
    const [campaignFilter, setCampaignFilter] = useState("All");

    // Text search
    const [searchTerm, setSearchTerm] = useState("");

    // List of all possible campaigns
    const campaigns = ["EZ Beginner", "Marketing Blast", "Tech Outreach", "Sales Pipeline"];

    // --- For the CSV import campaigns ---
    // Each new lead from CSV can get multiple campaigns as well.
    // We'll store which campaigns should be assigned to *all newly-imported* leads.
    // By default, all are false.
    const defaultImportCampaignSelections = campaigns.reduce((acc, camp) => {
        acc[camp] = false;
        return acc;
    }, {});

    const [importCampaignSelections, setImportCampaignSelections] = useState(
        defaultImportCampaignSelections
    );

    // ======== useEffect: Fetch leads from Firebase ========
    useEffect(() => {
        const fetchLeads = async () => {
            try {
                setIsFetchingLeads(true);
                const leadsCollection = collection(db, "leads");
                const snapshot = await getDocs(leadsCollection);
                const leadsData = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setLeads(leadsData);
            } catch (error) {
                console.error("Error fetching leads: ", error);
            } finally {
                setIsFetchingLeads(false);
            }
        };
        fetchLeads();
    }, []);

    // ======== Derived: Filter and Search leads before pagination ========
    const getFilteredLeads = () => {
        let filtered = leads;

        // 1) Filter by campaign if not "All"
        if (campaignFilter !== "All") {
            filtered = filtered.filter(
                (lead) =>
                    Array.isArray(lead.campaign) &&
                    lead.campaign.includes(campaignFilter)
            );
        }

        // 2) Filter by searchTerm (case‐insensitive match in any of these fields)
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (lead) =>
                    lead.fullName.toLowerCase().includes(lowerSearch) ||
                    lead.email.toLowerCase().includes(lowerSearch) ||
                    (lead.companyName &&
                        lead.companyName.toLowerCase().includes(lowerSearch)) ||
                    (lead.jobTitle &&
                        lead.jobTitle.toLowerCase().includes(lowerSearch))
            );
        }

        return filtered;
    };

    // ======== Handle CSV file selection ========
    const handleFileChange = (event) => {
        setCsvFile(event.target.files[0]);
    };

    // We'll toggle the import-campaign checkboxes when the user clicks them
    const handleImportCampaignCheckbox = (camp) => {
        setImportCampaignSelections((prev) => ({
            ...prev,
            [camp]: !prev[camp],
        }));
    };

    // ======== Delete a single lead (row action) ========
    const deleteLead = async (leadId) => {
        // Show a simple confirm. If you want a modal approach, you can also reuse the logic below.
        if (!window.confirm("Are you sure you want to delete this lead?")) {
            return;
        }
        try {
            await deleteDoc(doc(db, "leads", leadId));
            alert("Lead deleted successfully!");
            // Reload to fetch updated leads
            window.location.reload();
        } catch (error) {
            console.error("Error deleting lead:", error);
        }
    };

    // ======== Import CSV and save to Firebase (unique by email) ========
    const handleImport = async () => {
        if (!csvFile) return;

        try {
            setIsImportingCSV(true);

            // Build a set of existing emails (lowercased for matching)
            const existingEmails = new Set(leads.map((lead) => lead.email.toLowerCase()));

            // Figure out which campaigns were checked for import
            const campaignsForNewLeads = Object.keys(importCampaignSelections).filter(
                (camp) => importCampaignSelections[camp]
            );

            Papa.parse(csvFile, {
                header: true,
                complete: async (results) => {
                    const newLeads = results.data.filter((row) => row.email);
                    const leadsCollectionRef = collection(db, "leads");

                    const totalRows = newLeads.length;
                    let uploadedCount = 0;
                    const duplicates = [];

                    for (const lead of newLeads) {
                        const emailLower = lead.email.toLowerCase();

                        // Skip if already exists
                        if (existingEmails.has(emailLower)) {
                            duplicates.push(lead.email);
                            continue;
                        }

                        // Otherwise, add to Firestore
                        await addDoc(leadsCollectionRef, {
                            fullName: lead.fullName || "Unnamed",
                            email: lead.email,
                            companyName: lead.companyName || "N/A",
                            jobTitle: lead.jobTitle || "N/A",
                            campaign: campaignsForNewLeads, // add the checked campaigns
                        });

                        // Track success
                        existingEmails.add(emailLower);
                        uploadedCount++;
                    }

                    setIsModalOpen(false);
                    setIsImportingCSV(false);

                    // Show summary alert
                    let message = `CSV Import Complete!\n\n`;
                    message += `Total rows: ${totalRows}\n`;
                    message += `Successfully imported: ${uploadedCount}\n`;
                    if (duplicates.length > 0) {
                        message += `Skipped (already existing): ${duplicates.length}\n`;
                        message += `- ${duplicates.join("\n- ")}\n`;
                    }
                    alert(message);

                    // Reload to refetch leads from Firestore
                    window.location.reload();
                },
            });
        } catch (error) {
            console.error("Error importing CSV:", error);
            setIsImportingCSV(false);
        }
    };

    // ======== Handle lead selection in table (checkbox) ========
    const toggleLeadSelection = (id) => {
        setSelectedLeads((prevSelected) =>
            prevSelected.includes(id)
                ? prevSelected.filter((leadId) => leadId !== id)
                : [...prevSelected, id]
        );
    };

    // ======== Confirm deletion (bulk delete) ========
    const handleDeleteSelectedLeads = () => {
        if (selectedLeads.length === 0) {
            alert("Please select at least one lead to delete.");
            return;
        }
        // Open the modal to ask "Are you sure...?"
        setIsDeleteModalOpen(true);
    };

    // ======== Actually delete selected leads (with progress) ========
    const confirmDeleteSelectedLeads = async () => {
        setIsDeleting(true);
        setDeleteProgress(0);

        try {
            const totalLeads = selectedLeads.length;
            for (let i = 0; i < totalLeads; i++) {
                const leadId = selectedLeads[i];
                await deleteDoc(doc(db, "leads", leadId));
                setDeleteProgress(((i + 1) / totalLeads) * 100);
            }

            // close modal and reset state
            setIsDeleteModalOpen(false);
            setIsDeleting(false);
            setSelectedLeads([]); // clear selection

            // reload to fetch updated leads
            window.location.reload();
        } catch (error) {
            console.error("Error deleting leads:", error);
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    // ======== Open campaign modal (bulk assign/remove) ========
    const openCampaignModal = () => {
        if (selectedLeads.length === 0) {
            alert("Please select at least one lead.");
            return;
        }
        const newSelections = {};
        campaigns.forEach((camp) => {
            const allHaveIt = selectedLeads.every((leadId) => {
                const lead = leads.find((l) => l.id === leadId);
                return lead?.campaign?.includes(camp);
            });
            newSelections[camp] = allHaveIt;
        });
        setCampaignSelections(newSelections);

        setIsCampaignModalOpen(true);
    };

    // ======== Assign or remove campaigns for selected leads ========
    const assignLeadsToMultipleCampaigns = async () => {
        try {
            setIsAssigningCampaign(true);

            // For each campaign, if campaignSelections[camp] === true => arrayUnion
            // else => arrayRemove
            for (const camp of campaigns) {
                for (const leadId of selectedLeads) {
                    const leadRef = doc(db, "leads", leadId);
                    if (campaignSelections[camp]) {
                        // "Checked" => ensure the lead is in this campaign
                        await updateDoc(leadRef, {
                            campaign: arrayUnion(camp),
                        });
                    } else {
                        // "Unchecked" => remove the lead from this campaign
                        await updateDoc(leadRef, {
                            campaign: arrayRemove(camp),
                        });
                    }
                }
            }

            alert("Leads updated successfully!");
            setIsCampaignModalOpen(false);
            setSelectedLeads([]);
            setIsAssigningCampaign(false);

            // reload to fetch updated leads
            window.location.reload();
        } catch (error) {
            console.error("Error assigning campaigns:", error);
            setIsAssigningCampaign(false);
        }
    };

    // ======== Toggle the boolean in campaignSelections for a given campaign ========
    const handleCampaignCheckboxChange = (camp) => {
        setCampaignSelections((prev) => ({
            ...prev,
            [camp]: !prev[camp],
        }));
    };

    // ========== Rendering ==========
    // Filter + search leads before handing them to the table
    const filteredLeads = getFilteredLeads();

    return (
        <div style={styles.container}>
            {/* Loader Overlay (if any of the major operations are in progress) */}
            {(isFetchingLeads || isImportingCSV || isAssigningCampaign) && (
                <div style={styles.loaderOverlay}>
                    <div style={styles.loader}>Loading...</div>
                </div>
            )}

            <h2 style={styles.title}>All Contacts ({filteredLeads.length})</h2>

            {/* Campaign Filter + Search */}
            <div style={styles.filterContainer}>
                {/* Campaign Filter */}
                <label style={styles.filterLabel}>
                    Filter by Campaign:
                    <select
                        style={styles.filterSelect}
                        value={campaignFilter}
                        onChange={(e) => setCampaignFilter(e.target.value)}
                    >
                        <option value="All">All</option>
                        {campaigns.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </label>

                {/* Search */}
                <label style={styles.filterLabel}>
                    Search:
                    <input
                        style={styles.filterInput}
                        type="text"
                        placeholder="Search by name, email, etc."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </label>
            </div>

            <div style={styles.actions}>
                <button onClick={() => setIsModalOpen(true)} style={styles.importButton}>
                    📤 Import New Contacts
                </button>
                <button onClick={openCampaignModal} style={styles.assignCampaignButton}>
                    🎯 Manage Campaigns
                </button>
                <button onClick={handleDeleteSelectedLeads} style={styles.deleteButton}>
                    🗑️ Delete Selected Leads
                </button>
            </div>

            {/* Table with Pagination */}
            <LeadsTable
                leads={filteredLeads}
                selectedLeads={selectedLeads}
                toggleLeadSelection={toggleLeadSelection}
                currentPage={currentPage}
                leadsPerPage={leadsPerPage}
                onPageChange={(page) => setCurrentPage(page)}
                onDeleteLead={deleteLead}
            />

            {/* Delete Confirmation Modal (bulk) */}
            {isDeleteModalOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        {isDeleting ? (
                            <>
                                <h3>Deleting Leads...</h3>
                                <p>Deleting {selectedLeads.length} leads...</p>
                                <div style={styles.progressBarContainer}>
                                    <div
                                        style={{
                                            ...styles.progressBar,
                                            width: `${deleteProgress}%`,
                                        }}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <h3>Confirm Delete</h3>
                                <p>Are you sure you want to delete {selectedLeads.length} leads?</p>
                                <div style={styles.modalActions}>
                                    <button
                                        onClick={confirmDeleteSelectedLeads}
                                        style={styles.uploadButton}
                                    >
                                        Yes
                                    </button>
                                    <button
                                        onClick={() => setIsDeleteModalOpen(false)}
                                        style={styles.cancelButton}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Import CSV Modal */}
            {isModalOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h3>Import Contacts</h3>
                        <input type="file" accept=".csv" onChange={handleFileChange} />

                        {/* Multiple campaigns for newly imported leads */}
                        <div style={{ margin: "20px 0", textAlign: "left" }}>
                            <p style={{ fontWeight: "bold" }}>Select Campaign(s) for new leads:</p>
                            {campaigns.map((camp) => (
                                <div
                                    key={camp}
                                    style={{ marginBottom: "8px", display: "flex", alignItems: "center" }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={importCampaignSelections[camp] || false}
                                        onChange={() => handleImportCampaignCheckbox(camp)}
                                        style={{ marginRight: "6px" }}
                                    />
                                    <span>{camp}</span>
                                </div>
                            ))}
                        </div>

                        <button onClick={handleImport} style={styles.uploadButton}>
                            Upload
                        </button>
                        <button onClick={() => setIsModalOpen(false)} style={styles.cancelButton}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Assign/Remove Campaigns Modal (bulk for existing leads) */}
            {isCampaignModalOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h3>Manage Campaigns</h3>
                        <p style={{ marginBottom: "10px" }}>
                            Check = Add to all selected leads, Uncheck = Remove from all
                            selected leads
                        </p>
                        {campaigns.map((camp) => (
                            <div key={camp} style={{ marginBottom: "8px", textAlign: "left" }}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={campaignSelections[camp] || false}
                                        onChange={() => handleCampaignCheckboxChange(camp)}
                                    />
                                    <span style={{ marginLeft: "6px" }}>{camp}</span>
                                </label>
                            </div>
                        ))}

                        <button
                            onClick={assignLeadsToMultipleCampaigns}
                            style={styles.uploadButton}
                        >
                            Save Changes
                        </button>
                        <button
                            onClick={() => setIsCampaignModalOpen(false)}
                            style={styles.cancelButton}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// === Internal Styles ===
const styles = {
    container: {
        position: "relative",
        padding: "20px",
        backgroundColor: "#f8f9fb",
        minHeight: "100vh",
    },
    title: {
        fontSize: "24px",
        fontWeight: "bold",
        marginBottom: "20px",
    },
    filterContainer: {
        display: "flex",
        gap: "20px",
        marginBottom: "10px",
        alignItems: "center",
    },
    filterLabel: {
        fontWeight: "500",
    },
    filterSelect: {
        marginLeft: "10px",
        padding: "5px",
    },
    filterInput: {
        marginLeft: "10px",
        padding: "5px",
        width: "200px",
    },
    actions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
        marginBottom: "20px",
    },
    importButton: {
        backgroundColor: "#007bff",
        color: "white",
        padding: "10px 15px",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
    },
    assignCampaignButton: {
        backgroundColor: "#ff9800",
        color: "white",
        padding: "10px 15px",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
    },
    deleteButton: {
        backgroundColor: "#dc3545",
        color: "white",
        padding: "6px 10px",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        backgroundColor: "white",
    },
    paginationContainer: {
        marginTop: "10px",
        textAlign: "center",
    },
    pageButton: {
        margin: "0 5px",
        padding: "6px 10px",
        cursor: "pointer",
        border: "1px solid #ccc",
        backgroundColor: "#fff",
    },
    activePageButton: {
        backgroundColor: "#007bff",
        color: "#fff",
        borderColor: "#007bff",
    },
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
        borderRadius: "10px",
        textAlign: "center",
        width: "320px",
        maxHeight: "80vh",
        overflowY: "auto",
    },
    select: {
        width: "100%",
        padding: "10px",
        marginBottom: "10px",
    },
    uploadButton: {
        backgroundColor: "#28a745",
        color: "white",
        padding: "10px 15px",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
    },
    cancelButton: {
        backgroundColor: "#dc3545",
        color: "white",
        padding: "10px 15px",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
        marginLeft: "10px",
    },
    loaderOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.7)",
        zIndex: 10000,
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
        fontSize: "18px",
    },
    progressBarContainer: {
        width: "100%",
        height: "10px",
        backgroundColor: "#e0e0e0",
        borderRadius: "5px",
        margin: "10px 0",
    },
    progressBar: {
        height: "100%",
        backgroundColor: "#007bff",
        borderRadius: "5px",
        transition: "width 0.3s ease",
    },
    modalActions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
        marginTop: "20px",
    },
};

export default AddLeads;
