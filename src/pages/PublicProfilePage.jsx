import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiJson } from "../lib/api.js";

export default function PublicProfilePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("Loading profile...");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!id) return;
        const payload = await apiJson(`/api/public/users/${id}`);
        if (!cancelled) {
          setData(payload);
          setMsg("");
        }
      } catch (error) {
        if (!cancelled) {
          setMsg(error.message || "Unable to load profile");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (msg) {
    return (
      <main className="page-shell public-profile-shell">
        <Link to="/" className="ghost-btn">Back Home</Link>
        <p>{msg}</p>
      </main>
    );
  }

  const { profile, stats, recentRoutes } = data;

  return (
    <main className="page-shell public-profile-shell">
      <Link to="/" className="ghost-btn">Back Home</Link>
      <section className="public-profile-hero">
        <div>
          <h1>{profile.name}</h1>
          <p>{profile.bio || "No bio added"}</p>
          <p>Email: {profile.email}</p>
          <p>Phone: {profile.phone || "Not set"}</p>
          <p>City: {profile.city || "Not set"}</p>
          <p>Preferred Mode: {profile.preferredMode}</p>
          <p>Profile Rating: {profile.profileRating.score}/100 ({profile.profileRating.label})</p>
          <p>Green Points: {profile.greenPoints}</p>
          <p>Total Trips: {stats.trips}</p>
          <p>Total CO2 Saved: {stats.totalCo2SavedGrams} g</p>
          <p>Average CO2 Saved/Trip: {stats.avgSavedPerTripGrams} g</p>
        </div>
        {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} className="avatar public-avatar" /> : null}
      </section>

      <section className="dashboard">
        <h2>Recent Routes</h2>
        <div className="feed-list profile-route-list">
          {recentRoutes.map((route) => (
            <article key={route.id}>
              <strong>{route.source} to {route.destination}</strong>
              <p>Eco Score: {route.ecoScore ?? "--"}</p>
              <p>Distance: {route.distanceKm ?? "--"} km</p>
              <p>Category: {route.category || "--"}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
