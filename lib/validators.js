import { z } from "zod";

const locationSchema = z.object({
  name: z.string().min(2),
  lat: z.number(),
  lon: z.number()
});

export const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  preferredMode: z.enum(["car", "bike", "ev", "walk", "cycle", "transit"]).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const planRouteSchema = z.object({
  source: locationSchema,
  destination: locationSchema,
  mode: z.enum(["car", "bike", "ev", "walk", "cycle", "transit"]).default("car"),
  weights: z
    .object({
      distance: z.number().min(0).max(1),
      aqi: z.number().min(0).max(1),
      traffic: z.number().min(0).max(1),
      weather: z.number().min(0).max(1),
      co2: z.number().min(0).max(1)
    })
    .optional()
});

export const saveRouteSchema = z.object({
  source: locationSchema,
  destination: locationSchema,
  mode: z.enum(["car", "bike", "ev", "walk", "cycle", "transit"]),
  alternatives: z.array(
    z.object({
      providerRouteId: z.string(),
      label: z.enum(["fastest", "shortest", "greenest"]),
      distanceKm: z.number(),
      durationMin: z.number(),
      avgAqi: z.number(),
      trafficIndex: z.number(),
      weatherRisk: z.number(),
      co2Grams: z.number(),
      ecoScore: z.number(),
      riskScore: z.number(),
      polyline: z.string(),
      category: z.string(),
      explain: z.object({
        distancePct: z.number(),
        aqiPct: z.number(),
        trafficPct: z.number(),
        weatherPct: z.number(),
        co2Pct: z.number()
      })
    })
  ),
  selectedRouteIndex: z.number().int().min(0)
});

export const completeTripSchema = z.object({
  routeId: z.string(),
  baselineCo2Grams: z.number(),
  selectedCo2Grams: z.number(),
  timeSavedMin: z.number().default(0)
});

export const reportSchema = z.object({
  type: z.enum(["traffic", "smoke", "flood", "roadblock"]),
  location: z.object({
    lat: z.number(),
    lon: z.number()
  }),
  severity: z.number().int().min(1).max(5)
});

export const reviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(4).max(600)
});

export const reviewsQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});

export const helpCreateSchema = z.object({
  issueType: z.enum(["Map issue", "Login issue", "Route mismatch", "Payment / account", "Other"]),
  phone: z.string().max(20).optional().default(""),
  message: z.string().min(6).max(1200)
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(220).optional(),
  city: z.string().max(120).optional(),
  phone: z.string().max(20).optional(),
  preferredMode: z.enum(["car", "bike", "ev", "walk", "cycle", "transit"]).optional()
});

export const otpRequestSchema = z.object({
  phone: z.string().min(10).max(20)
});

export const otpVerifySchema = z.object({
  phone: z.string().min(10).max(20),
  otp: z.string().min(4).max(8),
  name: z.string().min(2).max(100).optional().default("Phone User")
});

export const helpChatSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]).default("user"),
        content: z.string().min(1).max(2000)
      })
    )
    .optional()
    .default([])
});
