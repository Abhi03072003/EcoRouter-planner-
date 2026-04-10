"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PublicProfilePage() {
  const params = useParams();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("Loading profile...");

  useEffect(() => {
    const run = async () => {
      try {
        if (!params?.id) {
          return;
        }
        const res = await fetch(`/api/public/users/${params.id}`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to load profile");
        }
        setData(payload);
        setMsg("");
      } catch (error) {
        setMsg(error.message || "Unable to load profile");
      }
    };

    run();
  }, [params?.id]);

  if (msg) {
    return (
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1rem" }}>
        <p>{msg}</p>
      </main>
    );
  }

  const { profile, stats, recentRoutes } = data;

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1rem", color: "#12352a" }}>
      <h1>{profile.name}</h1>
      <p>{profile.bio || "No bio added"}</p>
      <p>Email: {profile.email}</p>
      <p>Phone: {profile.phone || "Not set"}</p>
      <p>City: {profile.city || "Not set"}</p>
      <p>Preferred Mode: {profile.preferredMode}</p>
      <p>
        Profile Rating: {profile.profileRating.score}/100 ({profile.profileRating.label})
      </p>
      <p>Green Points: {profile.greenPoints}</p>
      <p>Total Trips: {stats.trips}</p>
      <p>Total CO2 Saved: {stats.totalCo2SavedGrams} g</p>
      <p>Average CO2 Saved/Trip: {stats.avgSavedPerTripGrams} g</p>

      <h2 style={{ marginTop: "1.4rem" }}>Recent Routes</h2>
      <div style={{ display: "grid", gap: "0.8rem" }}>
        {recentRoutes.map((r) => (
          <article
            key={r.id}
            style={{ border: "1px solid #d6e4dd", borderRadius: 12, padding: "0.8rem", background: "#fff" }}
          >
            <p style={{ margin: "0 0 0.35rem" }}>
              {r.source} {"->"} {r.destination}
            </p>
            <p style={{ margin: "0 0 0.35rem" }}>Eco Score: {r.ecoScore ?? "--"}</p>
            <p style={{ margin: "0 0 0.35rem" }}>Distance: {r.distanceKm ?? "--"} km</p>
            <p style={{ margin: 0 }}>Category: {r.category || "--"}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
