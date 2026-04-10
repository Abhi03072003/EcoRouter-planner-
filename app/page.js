import { useEffect, useMemo, useState } from "react";
import LiveRouteMap from "../components/LiveRouteMap.jsx";
import DynamicGraph from "../components/DynamicGraph.jsx";

const navItems = [
  { label: "Map", href: "#live-map" },
  { label: "Profile", href: "#profile" },
  { label: "Dashboard", href: "#dashboard" },
  { label: "Reviews", href: "#reviews" },
  { label: "Help", href: "#help" }
];

const authTabs = ["Google", "Login", "Signup", "OTP"];

async function geocodePlace(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Place lookup failed");
  const items = await response.json();
  if (!items?.length) throw new Error(`No location found for: ${query}`);
  return { name: items[0].display_name, lat: Number(items[0].lat), lon: Number(items[0].lon) };
}

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState("Google");
  const [sourceInput, setSourceInput] = useState("");
  const [destinationInput, setDestinationInput] = useState("");
  const [travelMode, setTravelMode] = useState("bike");
  const [sourceCoord, setSourceCoord] = useState(null);
  const [destinationCoord, setDestinationCoord] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [dashboardMsg, setDashboardMsg] = useState("Loading dashboard...");
  const [systemHealth, setSystemHealth] = useState(null);

  const [user, setUser] = useState(null);
  const [authMsg, setAuthMsg] = useState("");

  const [userLocation, setUserLocation] = useState(null);
  const [userTrail, setUserTrail] = useState([]);

  const [reviews, setReviews] = useState([]);
  const [reviewMetrics, setReviewMetrics] = useState({ totalReviews: 0, averageRating: 0, totalReviewers: 0 });
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [reviewMsg, setReviewMsg] = useState("");

  const [helpTickets, setHelpTickets] = useState([]);
  const [supportInfo, setSupportInfo] = useState({ customerCarePhone: "+919999999999", supportEmail: "support@ecoroute.ai" });
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [helpForm, setHelpForm] = useState({ issueType: "Map issue", phone: "", message: "" });
  const [helpMsg, setHelpMsg] = useState("");

  const [profileForm, setProfileForm] = useState({ name: "", bio: "", city: "", phone: "", preferredMode: "bike" });
  const [profileMsg, setProfileMsg] = useState("");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "" });
  const [otpForm, setOtpForm] = useState({ name: "", phone: "", otp: "" });

  const [devOtp, setDevOtp] = useState("");

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const authTitle = useMemo(() => "Sign In", []);

  useEffect(() => {
    const saved = localStorage.getItem("eco_theme");
    if (saved === "dark") setDarkMode(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("eco_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const loadSession = async () => {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) {
      setUser(null);
      return;
    }
    const payload = await res.json();
    setUser(payload.user);
    setProfileForm({
      name: payload.user.name || "",
      bio: payload.user.bio || "",
      city: payload.user.city || "",
      phone: payload.user.phone || "",
      preferredMode: payload.user.preferredMode || "bike"
    });
  };

  const loadDashboard = async (lat, lon) => {
    try {
      setDashboardMsg("Loading dashboard...");
      const query = lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : "";
      const res = await fetch(`/api/dashboard/overview${query}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Dashboard unavailable");
      setDashboard(payload);
      setDashboardMsg("Live city metrics updated every second in graph.");
    } catch (error) {
      setDashboardMsg(error.message || "Dashboard unavailable");
    }
  };

  const loadSystemHealth = async () => {
    try {
      const res = await fetch("/api/system/health", { cache: "no-store" });
      const payload = await res.json();
      if (res.ok) setSystemHealth(payload);
    } catch {
      setSystemHealth(null);
    }
  };

  const loadReviews = async () => {
    const res = await fetch("/api/reviews", { cache: "no-store" });
    const payload = await res.json();
    if (res.ok) {
      setReviews(payload.reviews || []);
      setReviewMetrics(payload.metrics || { totalReviews: 0, averageRating: 0, totalReviewers: 0 });
    }
  };

  const loadHelpTickets = async () => {
    if (!user) return;
    const res = await fetch("/api/help", { cache: "no-store" });
    const payload = await res.json();
    if (res.ok) {
      setHelpTickets(payload.tickets || []);
      if (payload.support) setSupportInfo(payload.support);
    }
  };

  const initializeGoogleButton = () => {
    if (!googleClientId || !window.google || !document.getElementById("googleSignInBtn")) return;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        try {
          setAuthMsg("Signing in with Google...");
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential })
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload?.error || "Google login failed");
          await loadSession();
          setAuthOpen(false);
          setAuthMsg("Google login successful.");
        } catch (error) {
          setAuthMsg(error.message || "Google login failed");
        }
      }
    });

    window.google.accounts.id.renderButton(document.getElementById("googleSignInBtn"), {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      width: 320
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    loadSession().catch(() => setUser(null));
    loadReviews().catch(() => setReviews([]));
    loadSystemHealth().catch(() => setSystemHealth(null));

    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported. This app requires location ON.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setLocationGranted(true);
        setUserLocation(current);
        setUserTrail([current]);
        loadDashboard(current.lat, current.lon);
      },
      () => {
        setLocationError("Location permission is mandatory. Please enable location and reload.");
      },
      { enableHighAccuracy: true }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(current);
        setUserTrail((prev) => [...prev.slice(-50), current]);
      },
      () => {},
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (user) loadHelpTickets().catch(() => setHelpTickets([]));
  }, [user]);

  useEffect(() => {
    if (!authOpen) return;
    if (authTab !== "Google") return;
    if (!googleClientId) {
      setAuthMsg("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in environment.");
      return;
    }
    if (window.google) {
      initializeGoogleButton();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => initializeGoogleButton();
    document.body.appendChild(script);
  }, [authOpen, authTab, googleClientId]);

  const handleFindRoute = async () => {
    if (!sourceInput.trim() || !destinationInput.trim()) {
      setStatusMsg("Please enter both source and destination.");
      return;
    }
    try {
      setIsLoading(true);
      setStatusMsg("Finding exact route and live signals...");
      const [source, destination] = await Promise.all([
        geocodePlace(sourceInput.trim()),
        geocodePlace(destinationInput.trim())
      ]);
      setSourceCoord(source);
      setDestinationCoord(destination);

      const planRes = await fetch("/api/routes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, destination, mode: travelMode })
      });
      const payload = await planRes.json();
      if (!planRes.ok) throw new Error(payload?.error || "Unable to compute route");
      setRouteResult(payload);
      setStatusMsg("Route loaded. Live marker tracks your movement like delivery apps.");
      loadDashboard(destination.lat, destination.lon);
    } catch (error) {
      setStatusMsg(error.message || "Failed to find route");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm)
    });
    const payload = await res.json();
    if (!res.ok) {
      setAuthMsg(payload.error || "Login failed");
      return;
    }
    await loadSession();
    setAuthOpen(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupForm)
    });
    const payload = await res.json();
    if (!res.ok) {
      setAuthMsg(payload.error || "Signup failed");
      return;
    }
    await loadSession();
    setAuthOpen(false);
  };

  const requestOtp = async () => {
    const res = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: otpForm.phone })
    });
    const payload = await res.json();
    if (!res.ok) {
      setAuthMsg(payload.error || "OTP request failed");
      return;
    }
    setDevOtp(payload.devOtp || "");
    setAuthMsg("OTP sent. Enter OTP to login.");
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(otpForm)
    });
    const payload = await res.json();
    if (!res.ok) {
      setAuthMsg(payload.error || "OTP verify failed");
      return;
    }
    await loadSession();
    setAuthOpen(false);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm)
    });
    const payload = await res.json();
    if (!res.ok) {
      setProfileMsg(payload.error || "Profile save failed");
      return;
    }
    setProfileMsg("Profile saved.");
    await loadSession();
  };

  const deleteProfile = async () => {
    if (!confirm("Delete your account and all data?")) return;
    const res = await fetch("/api/profile", { method: "DELETE" });
    const payload = await res.json();
    if (!res.ok) {
      setProfileMsg(payload.error || "Delete failed");
      return;
    }
    setUser(null);
    setProfileMsg("Account deleted.");
  };

  const handlePostReview = async (e) => {
    e.preventDefault();
    if (!user) return setReviewMsg("Login first");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reviewForm)
    });
    const payload = await res.json();
    if (!res.ok) return setReviewMsg(payload.error || "Review failed");
    setReviewMsg("Review posted.");
    setReviewForm({ rating: 5, comment: "" });
    loadReviews();
  };

  const handleHelpSubmit = async (e) => {
    e.preventDefault();
    if (!user) return setHelpMsg("Login first");
    const res = await fetch("/api/help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(helpForm)
    });
    const payload = await res.json();
    if (!res.ok) return setHelpMsg(payload.error || "Submit failed");
    setHelpMsg("Help request submitted.");
    setHelpForm({ issueType: "Map issue", phone: "", message: "" });
    if (payload.support) setSupportInfo(payload.support);
    loadHelpTickets();
  };

  const askChatBot = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const currentMessage = chatInput.trim();
    setChatHistory((prev) => [...prev, { role: "user", content: currentMessage }]);
    const res = await fetch("/api/help/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: currentMessage, history: chatHistory })
    });
    const payload = await res.json();
    const replyText = payload.reply || payload.error || "No response";
    setChatReply(replyText);
    setChatHistory((prev) => [...prev, { role: "assistant", content: replyText }]);
    if (payload.issueType || payload.suggestedMessage) {
      setHelpForm((prev) => ({
        ...prev,
        issueType: payload.issueType || prev.issueType,
        message: payload.suggestedMessage || prev.message
      }));
    }
    setChatInput("");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  if (showSplash) {
    return (
      <main className="page-shell splash-screen">
        <img src="/ecorouter-logo.png" alt="EcoRouter intro logo" className="splash-logo" />
        <h1>EcoRoute</h1>
      </main>
    );
  }

  if (!locationGranted) {
    return (
      <main className="page-shell gate-screen">
        <h1>Location Access Required</h1>
        <p>{locationError || "Please allow location access to continue."}</p>
        <button className="primary-btn" onClick={() => window.location.reload()} type="button">Retry</button>
      </main>
    );
  }

  return (
    <main className={`page-shell ${darkMode ? "theme-dark" : ""}`}>
      <img src="/hero-tree-bg.png" className="site-watermark" alt="background" />

      <header className="navbar-wrap">
        <nav className="navbar">
          <a href="#" className="brand">
            <img src="/ecorouter-logo.png" alt="EcoRouter logo" width="52" height="52" />
            <span>
              EcoRoute
              <small>Track route, pollution, carbon and movement in one place.</small>
            </span>
          </a>
          <div className="nav-links">{navItems.map((item) => <a key={item.label} href={item.href}>{item.label}</a>)}</div>
          {!user ? (
            <button className="primary-btn" onClick={() => setAuthOpen(true)} type="button">Sign In</button>
          ) : (
            <div className="user-chip">
              <strong>{user.name}</strong>
              <a href={user.publicProfileUrl || "#"}>Profile</a>
              <button type="button" onClick={handleLogout}>Logout</button>
            </div>
          )}
          <button className="ghost-btn theme-toggle" type="button" onClick={() => setDarkMode((v) => !v)}>
            {darkMode ? "Light" : "Dark"}
          </button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="chip">Environment Safety Lines</p>
          <h1>Control Pollution, Reduce Carbon, Build Cleaner Mobility.</h1>
          <p>
            Sustainable route selection helps lower emissions, reduce traffic load and improve air quality. Better mobility choices create safer roads, healthier lungs and future-ready cities.
          </p>
        </div>
        <div className="hero-card">
          <h2>Blog Highlight</h2>
          <p>Urban climate note: 1 smart route change per commuter can significantly reduce city-level roadside emissions over time.</p>
          <p>Roadside PM levels are linked with stop-go congestion, so stable traffic flow and route balancing are key for cleaner air.</p>
          <p>For carbon control, short efficient trips, EV usage and shared mobility together create a measurable city-level impact.</p>
          <p>Population-sensitive planning helps avoid overloaded lanes and improves emergency access and travel reliability.</p>
        </div>
      </section>

      <section className="hero-card" id="live-map">
        <h2>Live Map Tracking (Bike/Car/Person)</h2>
        <div className="input-grid">
          <label>Source<input type="text" value={sourceInput} onChange={(e) => setSourceInput(e.target.value)} placeholder="Enter area / mohalla" /></label>
          <label>Destination<input type="text" value={destinationInput} onChange={(e) => setDestinationInput(e.target.value)} placeholder="Enter destination" /></label>
          <label>Mode
            <select value={travelMode} onChange={(e) => setTravelMode(e.target.value)}>
              <option value="bike">Bike</option><option value="car">Car</option><option value="ev">EV</option><option value="walk">Walk</option>
            </select>
          </label>
        </div>
        <button className="wide-btn" onClick={handleFindRoute} disabled={isLoading} type="button">{isLoading ? "Finding..." : "Find Exact Route"}</button>
        <LiveRouteMap source={sourceCoord} destination={destinationCoord} userLocation={userLocation} userTrail={userTrail} />
        <div className="route-metrics">
          <span>Distance: {routeResult?.recommendation?.distanceKm ?? "--"} km</span>
          <span>Eco Score: {routeResult?.recommendation?.ecoScore ?? "--"}/100</span>
          <span className="eco-tag">{routeResult?.recommendation?.category || "Waiting"}</span>
        </div>
        {statusMsg && <p className="status-msg dark">{statusMsg}</p>}
      </section>

      <section className="hero" id="profile">
        <div className="hero-copy">
          <h2>Profile Section</h2>
          <form className="panel-form" onSubmit={saveProfile}>
            <label>Name<input value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} /></label>
            <label>Bio<input value={profileForm.bio} onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))} /></label>
            <label>City<input value={profileForm.city} onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))} /></label>
            <label>Phone<input value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} /></label>
            <label>Preferred Mode<select value={profileForm.preferredMode} onChange={(e) => setProfileForm((p) => ({ ...p, preferredMode: e.target.value }))}><option value="bike">Bike</option><option value="car">Car</option><option value="ev">EV</option><option value="walk">Walk</option></select></label>
            <button className="wide-btn" type="submit">Save Profile</button>
            <button className="ghost-btn" type="button" onClick={deleteProfile}>Delete Account</button>
          </form>
          {profileMsg && <p className="status-msg dark">{profileMsg}</p>}
        </div>

        <div className="profile-card">
          <h3>User Details</h3>
          <p>Name: {user?.name || "Guest"}</p>
          <p>Email: {user?.email || "--"}</p>
          <p>Phone: {user?.phone || "--"}</p>
          <p>Profile Rating: {user?.profileRating?.score ?? "--"}/100</p>
          <p>Green Points: {user?.greenPoints ?? 0}</p>
          {user?.avatarUrl && <img src={user.avatarUrl} alt="user avatar" className="avatar" />}
        </div>
      </section>

      <section className="dashboard" id="dashboard">
        <h2>Population + Carbon Dashboard</h2>
        <div className="dashboard-grid">
          <article>
            <h3>Current Location Metrics</h3>
            <p>AQI: {dashboard?.current?.aqi ?? "--"}</p>
            <p>Carbon Rate: {dashboard?.current?.carbonRateGPerKm ?? "--"} g/km</p>
            <p>Carbon %: {dashboard?.population?.carbonPercent ?? "--"}%</p>
            <p>Registered Users: {dashboard?.platform?.activeUsers ?? "--"}</p>
          </article>
          <article>
            <h3>Population Around You</h3>
            <p>Nearby Area Population: {dashboard?.population?.aroundAreaPopulation ?? "--"}</p>
            <p>Road Population (approx): {dashboard?.population?.roadPopulation ?? "--"}</p>
            <p>30 min increase: +{dashboard?.population?.projection30Min?.increasePct ?? "--"}%</p>
            <p>30 min reduce potential: -{dashboard?.population?.projection30Min?.decreasePct ?? "--"}%</p>
          </article>
          <article>
            <h3>Dynamic Graph (hover for values)</h3>
            <DynamicGraph baseAqi={dashboard?.current?.aqi || 85} baseCarbon={dashboard?.current?.carbonRateGPerKm || 160} />
            <p>Avg Review: {reviewMetrics.averageRating || "--"} / 5</p>
          </article>
        </div>
        {systemHealth && (
          <p className="status-msg dark">
            Backend Readiness: {systemHealth.readinessScore}% ({systemHealth.status}) | DB: {systemHealth.checks.mongo ? "OK" : "Missing"}
          </p>
        )}
        <p className="status-msg dark">{dashboardMsg}</p>
      </section>

      <section className="split-sections">
        <section className="reviews" id="reviews">
          <h2>Reviews & Comments</h2>
          <p className="status-msg dark">
            Total Reviews: {reviewMetrics.totalReviews} | Avg Rating: {reviewMetrics.averageRating}/5 | Reviewers: {reviewMetrics.totalReviewers}
          </p>
          <form className="panel-form" onSubmit={handlePostReview}>
            <label>Rating<select value={reviewForm.rating} onChange={(e) => setReviewForm((p) => ({ ...p, rating: Number(e.target.value) }))}>{[5,4,3,2,1].map((r)=><option key={r} value={r}>{r} Star</option>)}</select></label>
            <label>Comment<textarea value={reviewForm.comment} onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))} placeholder="Write your public review" /></label>
            <button className="wide-btn" type="submit">Post Review</button>
            {reviewMsg && <p className="status-msg dark">{reviewMsg}</p>}
          </form>
          <div className="feed-list">{reviews.map((r) => <article key={r._id}><div className="feed-head">{r.userAvatar ? <img src={r.userAvatar} alt="avatar"/> : <span>{r.userName.slice(0,1)}</span>}<strong>{r.userName}</strong><em>{"★".repeat(r.rating)}</em></div><p>{r.comment}</p></article>)}</div>
        </section>

        <section className="help" id="help">
          <h2>Help & Support</h2>
          <div className="help-actions">
            <a className="ghost-btn" href={`tel:${supportInfo.customerCarePhone}`}>Call Customer Care</a>
            <a className="ghost-btn" href={`mailto:${supportInfo.supportEmail}`}>Send Email</a>
          </div>
          <form className="panel-form" onSubmit={handleHelpSubmit}>
            <label>Issue type<select value={helpForm.issueType} onChange={(e) => setHelpForm((p) => ({ ...p, issueType: e.target.value }))}><option>Map issue</option><option>Login issue</option><option>Route mismatch</option><option>Other</option></select></label>
            <label>Phone number<input value={helpForm.phone} onChange={(e) => setHelpForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Your number"/></label>
            <label>Message<textarea value={helpForm.message} onChange={(e) => setHelpForm((p) => ({ ...p, message: e.target.value }))} placeholder="Describe your problem"/></label>
            <button className="wide-btn" type="submit">Submit Help Request</button>
            {helpMsg && <p className="status-msg dark">{helpMsg}</p>}
          </form>
          <form className="panel-form" onSubmit={askChatBot}>
            <label>AI Chatbot
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Describe your issue for instant solution" />
            </label>
            <button className="ghost-btn" type="submit">Ask AI Bot</button>
            {chatReply && <p className="status-msg dark">{chatReply}</p>}
          </form>
          <div className="ticket-list">{helpTickets.map((t) => <article key={t._id}><strong>{t.issueType}</strong><p>{t.message}</p><small>Status: {t.status}</small></article>)}</div>
        </section>
      </section>

      <footer>
        <p>EcoRoute Planner | population-aware eco mobility intelligence.</p>
        <p>Contact: Abhishek Pandey | Phone: 6394323401 | Email: pandeyharsh73099@gmail.com</p>
        <p>Co-builder: Anshuman Mishra</p>
      </footer>

      <div className={`auth-overlay ${authOpen ? "open" : "closed"}`} onClick={() => setAuthOpen(false)}>
          <section className="auth-panel" onClick={(e) => e.stopPropagation()}>
            <h3>{authTitle}</h3>
            <div className="auth-tabs">{authTabs.map((t) => <button key={t} type="button" className={authTab === t ? "active" : ""} onClick={() => setAuthTab(t)}>{t}</button>)}</div>

            {authTab === "Google" && <div id="googleSignInBtn" style={{ display: "grid", justifyContent: "center", marginTop: "0.8rem" }} />}

            {authTab === "Login" && (
              <form className="panel-form" onSubmit={handleEmailLogin}>
                <label>Email<input type="email" value={loginForm.email} onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} required /></label>
                <label>Password<input type="password" value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} required /></label>
                <button className="wide-btn" type="submit">Login</button>
              </form>
            )}

            {authTab === "Signup" && (
              <form className="panel-form" onSubmit={handleSignup}>
                <label>Name<input value={signupForm.name} onChange={(e) => setSignupForm((p) => ({ ...p, name: e.target.value }))} required /></label>
                <label>Email<input type="email" value={signupForm.email} onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))} required /></label>
                <label>Password<input type="password" value={signupForm.password} onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))} required /></label>
                <button className="wide-btn" type="submit">Create Account</button>
              </form>
            )}

            {authTab === "OTP" && (
              <form className="panel-form" onSubmit={verifyOtp}>
                <label>Name<input value={otpForm.name} onChange={(e) => setOtpForm((p) => ({ ...p, name: e.target.value }))} placeholder="Optional" /></label>
                <label>Phone<input value={otpForm.phone} onChange={(e) => setOtpForm((p) => ({ ...p, phone: e.target.value }))} required /></label>
                <button className="ghost-btn" type="button" onClick={requestOtp}>Send OTP</button>
                <label>OTP<input value={otpForm.otp} onChange={(e) => setOtpForm((p) => ({ ...p, otp: e.target.value }))} required /></label>
                <button className="wide-btn" type="submit">Login with OTP</button>
                {devOtp && <p className="auth-msg">Dev OTP: {devOtp}</p>}
              </form>
            )}

            {authMsg && <p className="auth-msg">{authMsg}</p>}
          </section>
        </div>
    </main>
  );
}
