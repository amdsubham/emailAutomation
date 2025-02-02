import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AddEmail from "./pages/AddEmail";
import AddLeads from "./pages/AddLeads";
import ManageCampaigns from "./pages/ManageCampaigns";
import CreateCampaign from "./pages/CreateCampaign";


function App() {
  const [user, loading] = useAuthState(auth);
  console.log("👤 Auth State:", user);

  if (loading) return <div>Loading...</div>; // Prevents flashing screen issue

  return (
    <Router>
      <Routes>
        <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/add-emails" element={user ? <AddEmail /> : <Login />} />
        <Route path="/add-leads" element={user ? <AddLeads /> : <Login />} />


        <Route path="/manage-campaigns" element={<ManageCampaigns />} />
        <Route path="/create-campaign/:campaignId" element={<CreateCampaign />} />


      </Routes>
    </Router>
  );
}

export default App;
