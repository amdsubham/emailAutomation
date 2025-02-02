import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import {
    doc,
    getDoc,
    collection,
    getDocs,
    updateDoc,
    addDoc,
    serverTimestamp,
} from "firebase/firestore";

function CreateCampaign() {
    const { campaignId } = useParams(); // from URL : "/create-campaign/:campaignId"

    // ===== Basic campaign fields =====
    const [campaignName, setCampaignName] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [loading, setLoading] = useState(true);

    // ===== Senders (multi-select) =====
    const [senders, setSenders] = useState([]);        // all possible from Firestore
    const [selectedSenders, setSelectedSenders] = useState([]); // which user picked

    // ===== Scheduling fields =====
    const [scheduleName, setScheduleName] = useState("Default schedule");
    const [timezone, setTimezone] = useState("UTC");
    const [daysOfWeek, setDaysOfWeek] = useState({
        Sunday: true,
        Monday: true,
        Tuesday: true,
        Wednesday: true,
        Thursday: true,
        Friday: true,
        Saturday: true,
    });
    const [startTime, setStartTime] = useState("09:00");  // e.g. "09:00" (9 AM)
    const [endTime, setEndTime] = useState("20:30");      // e.g. "20:30" (8:30 PM)
    const [leadInterval, setLeadInterval] = useState(14); // auto-calculated minutes

    useEffect(() => {
        // If we are editing an existing campaign, fetch it
        const fetchCampaign = async () => {
            if (!campaignId) {
                setLoading(false);
                return;
            }
            try {
                const campaignRef = doc(db, "campaigns", campaignId);
                const campaignSnap = await getDoc(campaignRef);

                if (campaignSnap.exists()) {
                    const data = campaignSnap.data();
                    setCampaignName(data.campaignName || "Unnamed Campaign");
                    setEmailSubject(data.emailSubject || "");
                    setEmailBody(data.emailBody || "");
                    if (data.selectedSenders) setSelectedSenders(data.selectedSenders);

                    // If we stored schedule fields, load them:
                    if (data.schedule) {
                        setScheduleName(data.schedule.scheduleName || "Default schedule");
                        setTimezone(data.schedule.timezone || "UTC");
                        if (data.schedule.daysOfWeek) {
                            setDaysOfWeek(data.schedule.daysOfWeek);
                        }
                        if (data.schedule.startTime) setStartTime(data.schedule.startTime);
                        if (data.schedule.endTime) setEndTime(data.schedule.endTime);
                        if (data.schedule.leadInterval) {
                            setLeadInterval(data.schedule.leadInterval);
                        }
                    }
                } else {
                    setCampaignName("Unknown Campaign");
                }
            } catch (error) {
                console.error("Error fetching campaign:", error);
                setCampaignName("Error Loading");
            }
            setLoading(false);
        };

        // Grab all possible senders from "emails" collection
        const fetchSenders = async () => {
            try {
                const emailsCollection = collection(db, "emails");
                const snapshot = await getDocs(emailsCollection);
                const emailsList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setSenders(emailsList);
            } catch (error) {
                console.error("Error fetching senders:", error);
            }
        };

        fetchCampaign();
        fetchSenders();
    }, [campaignId]);

    // Convert "HH:MM" to total minutes of the day
    const timeStringToMinutes = (timeStr) => {
        // e.g. "09:00" => 9*60 + 0 = 540
        const [hh, mm] = timeStr.split(":");
        return parseInt(hh, 10) * 60 + parseInt(mm, 10);
    };

    // Recalculate leadInterval automatically
    const recalcLeadInterval = () => {
        const start = timeStringToMinutes(startTime);
        const end = timeStringToMinutes(endTime);
        const windowMinutes = end - start;
        if (windowMinutes <= 0) {
            // fallback
            setLeadInterval(0);
            return;
        }

        // each selected sender can send 100/day
        const dailyCapacity = selectedSenders.length * 100;
        if (dailyCapacity === 0) {
            setLeadInterval(0);
            return;
        }
        // interval in minutes = windowMinutes / dailyCapacity
        // We'll round up
        const interval = Math.ceil(windowMinutes / dailyCapacity);
        setLeadInterval(interval);
    };

    // Whenever user picks a new set of senders or times, recalc
    useEffect(() => {
        recalcLeadInterval();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSenders, startTime, endTime]);

    // Multi-select for senders
    const handleSenderChange = (e) => {
        const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
        setSelectedSenders(selectedValues);
    };

    // Days-of-week checkboxes
    const toggleDay = (day) => {
        setDaysOfWeek((prev) => ({ ...prev, [day]: !prev[day] }));
    };

    /**
     * Save the campaign to Firestore.
     * If campaignId is provided, we update the existing doc;
     * otherwise we create a new doc.
     */
    const saveCampaign = async () => {
        try {
            const scheduleData = {
                scheduleName,
                timezone,
                daysOfWeek,
                startTime,
                endTime,
                leadInterval,
            };

            // Just an example accounts array (3 accounts)
            // For the "rotate" logic, the Cloud Function will pick next account in a round-robin
            const accountsExample = [
                {
                    email: "account1@example.com",
                    dailyLimit: 100,
                    usageToday: 0,
                    nextSendTime: 0, // We'll store next time in ms
                },
                {
                    email: "account2@example.com",
                    dailyLimit: 100,
                    usageToday: 0,
                    nextSendTime: 0,
                },
                {
                    email: "account3@example.com",
                    dailyLimit: 100,
                    usageToday: 0,
                    nextSendTime: 0,
                },
            ];

            if (campaignId) {
                // update existing
                const campaignRef = doc(db, "campaigns", campaignId);
                await updateDoc(campaignRef, {
                    campaignName,
                    emailSubject,
                    emailBody,
                    selectedSenders,
                    schedule: scheduleData,
                });
                alert("Campaign updated successfully!");
            } else {
                // create new
                const docRef = await addDoc(collection(db, "campaigns"), {
                    campaignName,
                    emailSubject,
                    emailBody,
                    selectedSenders,
                    schedule: scheduleData,
                    status: true,
                    accounts: accountsExample,
                    createdAt: serverTimestamp(),
                });
                alert("Campaign created! ID = " + docRef.id);
            }
        } catch (error) {
            console.error("Error saving campaign:", error);
            alert("Failed to save campaign");
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <h2>Loading campaign...</h2>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2>{campaignName || "New Campaign"}</h2>
            </div>

            <p style={styles.subtitle}>Sequence start → (Send immediately) → Email</p>

            {/* Editor UI */}
            <div style={styles.editorContainer}>

                {/* Multi-select for senders */}
                <div style={styles.formField}>
                    <label>Sender(s) for email steps</label>
                    <select
                        multiple
                        value={selectedSenders}
                        onChange={handleSenderChange}
                        style={styles.select}
                    >
                        {senders.length === 0 && (
                            <option disabled>No senders found in Firestore</option>
                        )}
                        {senders.map((senderDoc) => (
                            <option key={senderDoc.id} value={senderDoc.email}>
                                {senderDoc.name} ({senderDoc.email})
                            </option>
                        ))}
                    </select>
                    <p style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                        Hold Ctrl (Windows) or Command (Mac) to select multiple
                    </p>
                </div>

                <div style={styles.formField}>
                    <label>Email Subject</label>
                    <input
                        type="text"
                        placeholder="Subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        style={styles.input}
                    />
                </div>

                <div style={styles.formField}>
                    <label>Email Content</label>
                    <textarea
                        placeholder="Write your email content..."
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        style={styles.textarea}
                    />
                </div>

                {/* SCHEDULE FORM */}
                <hr style={{ margin: "20px 0" }} />

                <div style={styles.formField}>
                    <label>Schedule Name</label>
                    <input
                        type="text"
                        placeholder="Default schedule"
                        value={scheduleName}
                        onChange={(e) => setScheduleName(e.target.value)}
                        style={styles.input}
                    />
                </div>

                <div style={styles.formField}>
                    <label>Timezone used</label>
                    <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        style={styles.select}
                    >
                        <option value="UTC">UTC</option>
                        <option value="Asia/Kolkata">India (Asia/Kolkata)</option>
                        <option value="Australia/Sydney">Australia (Sydney)</option>
                        <option value="Australia/Perth">Australia (Perth)</option>
                        {/* add more as needed */}
                    </select>
                </div>

                <div style={styles.formField}>
                    <label>Send on:</label>
                    <div style={styles.daysContainer}>
                        {Object.keys(daysOfWeek).map((day) => (
                            <label key={day} style={styles.dayCheckboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={daysOfWeek[day]}
                                    onChange={() => toggleDay(day)}
                                />
                                {day}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={styles.formField}>
                    <label>Between:</label>
                    <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        style={styles.inputTime}
                    />
                    <label style={{ marginLeft: "10px" }}>And:</label>
                    <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        style={styles.inputTime}
                    />
                </div>

                <div style={styles.formField}>
                    <label>Reach a new lead every (minutes):</label>
                    <input
                        type="number"
                        value={leadInterval}
                        onChange={(e) => setLeadInterval(Number(e.target.value))}
                        style={{ width: "60px", marginLeft: "6px" }}
                    />
                    <p style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                        This is auto-calculated from selected senders & time window,
                        but you can adjust if needed.
                    </p>
                </div>

                <button onClick={saveCampaign} style={styles.saveButton}>
                    Start Campaign
                </button>
            </div>
        </div>
    );
}

// ===== Inline Styles =====
const styles = {
    container: {
        padding: "20px",
        maxWidth: "600px",
        margin: "0 auto",
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    subtitle: {
        margin: "10px 0 20px 0",
        fontStyle: "italic",
        color: "#555",
    },
    editorContainer: {
        background: "#f8f9fb",
        padding: "20px",
        borderRadius: "6px",
    },
    formField: {
        marginBottom: "15px",
    },
    select: {
        width: "100%",
        minHeight: "40px",
        padding: "8px",
        fontSize: "14px",
    },
    daysContainer: {
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        marginTop: "6px",
    },
    dayCheckboxLabel: {
        display: "flex",
        alignItems: "center",
        gap: "5px",
    },
    inputTime: {
        width: "120px",
        marginLeft: "8px",
    },
    input: {
        width: "100%",
        padding: "8px",
        fontSize: "14px",
    },
    textarea: {
        width: "100%",
        height: "120px",
        padding: "8px",
        fontSize: "14px",
    },
    saveButton: {
        backgroundColor: "#007bff",
        color: "white",
        border: "none",
        padding: "10px 15px",
        borderRadius: "5px",
        cursor: "pointer",
    },
};

export default CreateCampaign;
