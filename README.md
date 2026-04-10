# EcoRoute Planner

Single-page animated Next.js frontend + upgraded backend APIs for eco-friendly route planning.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create `.env.local`:

```bash
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net
MONGODB_DB=ecoroute
JWT_SECRET=replace_with_long_random_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
ADMIN_EMAIL=pandeyharsh73099@gmail.com
CUSTOMER_CARE_PHONE=+916394323401
SUPPORT_EMAIL=pandeyharsh73099@gmail.com
RESEND_API_KEY=optional_resend_key_for_email_notifications
FROM_EMAIL=onboarding@resend.dev
OPENAI_API_KEY=optional_openai_key_for_ai_chatbot
OPENAI_MODEL=gpt-4.1-mini

# Optional providers
OPENWEATHER_API_KEY=your_openweather_key
OSRM_BASE_URL=https://router.project-osrm.org
```

## Implemented API Skeleton

### Auth
- `POST /api/auth/google` (Google login)
- `POST /api/auth/signup` (email/password)
- `POST /api/auth/login` (email/password)
- `POST /api/auth/otp/request` (phone OTP)
- `POST /api/auth/otp/verify` (phone OTP login)
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `PATCH/DELETE /api/profile`
- `GET /api/public/users/:id`

### Route Planning
- `POST /api/routes/plan`
- `POST /api/routes/save`
- `GET /api/routes/history`
- `GET /api/routes/:id`

### Smart Data APIs
- `GET /api/dashboard/overview?lat=...&lon=...`
- `GET /api/system/health` (backend readiness + integration status)
- `GET/POST /api/reviews`
- `GET/POST /api/help`
- `POST /api/help/chat` (AI chatbot)

### Support Notes
- Review/help submission can trigger admin email notifications via Resend.
- AI chatbot uses OpenAI when configured; otherwise smart fallback responses are used.
- Chatbot supports contextual memory (recent turns), Hindi/Hinglish replies, and issue auto-suggestion for help form.
- Reviews API supports pagination: `GET /api/reviews?page=1&limit=20`.
