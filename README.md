# Smart Mess Management System

React/Vite frontend with a Node/Express API and MongoDB persistence through Mongoose.

## Run locally

1. Install and start MongoDB Community Server locally. The default local URI used here is `mongodb://127.0.0.1:27017/smart_mess`; MongoDB creates the database and collections as the app writes its first records.
2. In `backend/`, copy `.env.example` to `.env`. Set a private `JWT_SECRET` with at least 32 characters, and set `ADMIN_EMAIL` plus a strong `ADMIN_PASSWORD` of at least 12 characters.
3. Install and start the API in one terminal:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

   The API creates the MongoDB collections and provisions the initial admin from the environment variables. Health check: `http://localhost:4000/api/health`.

4. In a second terminal, configure and start the frontend:

   ```powershell
   cd frontend
   Copy-Item .env.example .env.local
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`. Students register from the login screen. Admin accounts are provisioned by the backend; public registration cannot create admins.

## Deploy the API to Render

Render cannot connect to MongoDB that runs only on your computer. For deployment, use MongoDB Atlas (or another network-reachable MongoDB host). Render documents the Atlas connection and IP access setup [here](https://render.com/docs/connect-to-mongodb-atlas); Atlas only accepts connections from IPs on its access list.[Atlas access list](https://www.mongodb.com/docs/atlas/troubleshoot-connection/)

1. Push this repository to GitHub and create an Atlas cluster and database user.
2. Add the Render service's outbound IP addresses to Atlas Network Access.
3. In Render, choose **New → Blueprint** and select this repository. The root [render.yaml](render.yaml) configures the API root directory, `npm ci` build, `npm start`, and `/api/health` health check.
4. When prompted, provide `MONGODB_URI` (include the database name `smart_mess`), `FRONTEND_ORIGIN` (your final Vercel origin, e.g. `https://your-app.vercel.app`), `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` of at least 12 characters. Render generates `JWT_SECRET` for the service.

Alternatively, create a Render **Web Service** manually with root directory `backend`, build command `npm ci`, and start command `npm start`, then set the same environment variables in its Environment page. On startup, the API creates its collections and creates the admin account if that email is not already present. It listens on Render's `PORT` and `0.0.0.0`.

## Deploy the frontend to Vercel

1. Import the same repository into Vercel and set the project root directory to `frontend`.
2. Use the Vite build command `npm run build` and output directory `dist`.
3. Add `VITE_API_BASE_URL` with the deployed Render API origin, for example `https://smart-mess-api.onrender.com` (no `/api` suffix).
4. Deploy. The included `frontend/vercel.json` rewrites app routes to the Vite entry page so routes such as `/student` and `/admin` work when opened directly.
5. Copy the final Vercel origin into Render's `FRONTEND_ORIGIN` and redeploy the API.

## Data and security notes

- API records are stored in MongoDB. User accounts are separate Mongoose documents; management modules are stored in an app-state document, with a separate portal-state document per student.
- Passwords are bcrypt-hashed on the backend. The browser holds a short-lived bearer token in `sessionStorage`; the database URI and JWT signing secret remain backend-only.
- Admin-only data routes enforce the role on the server. CORS only allows the configured frontend origin; it is not a replacement for authentication or role checks.
- This app does not process real payments. Its student “Pay now” action is a demo confirmation and should be replaced by a payment provider integration before taking money.
- Existing browser-only demo users and records are not migrated. New student registrations and the Render-provisioned admin account are stored in MongoDB.
