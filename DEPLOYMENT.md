# Deployment Guide

This repository contains the full source code for the CFRP SHM Platform. Since the backend requires a persistent environment to run Python child processes, **serverless platforms like Vercel cannot host the backend.**

Here is the correct, production-ready architecture:

1.  **Frontend** (React/Vite): Deployed to **Vercel** (Free).
2.  **Backend** (Node.js + Python): Deployed to **Render** (Free Web Service).
3.  **Database**: Deployed to **MongoDB Atlas** (Free M0 Cluster).

---

## 1. Database (MongoDB Atlas)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and create a free M0 cluster.
2. In Network Access, whitelist `0.0.0.0/0` (allow all IPs).
3. In Database Access, create a user and password.
4. Get your connection string (e.g., `mongodb+srv://<user>:<password>@cluster0.mongodb.net/cfrp_shm`).

---

## 2. Backend (Render.com)
The backend must run on a server that supports both Node.js and Python. Render's Native Node environment includes Python 3, making it perfect for this.

1. Push your code to a GitHub repository.
2. Go to [Render](https://render.com/) and click **New > Web Service**.
3. Connect your GitHub repository.
4. Render will automatically detect the `render.yaml` file in the `backend/` directory, but if setting up manually:
    *   **Root Directory:** `backend`
    *   **Environment:** `Node`
    *   **Build Command:** `bash ./build.sh`
    *   **Start Command:** `npm start`
5. **Environment Variables:**
    *   `NODE_ENV`: `production`
    *   `PORT`: `5001`
    *   `MONGODB_URI`: *(Your MongoDB Atlas connection string)*
    *   `CORS_ORIGIN`: *(Leave blank for now, we will add the Vercel URL later)*
6. Click **Create Web Service**. Wait for the build to finish. Copy the assigned Render URL (e.g., `https://cfrp-shm-api.onrender.com`).

---

## 3. Frontend (Vercel)
Vercel is ideal for building and serving the static React Single Page Application.

1. Go to [Vercel](https://vercel.com/) and click **Add New > Project**.
2. Import the same GitHub repository.
3. Configure the Project:
    *   **Framework Preset:** Vite
    *   **Root Directory:** `frontend`
    *   **Build Command:** `npm run build`
    *   **Output Directory:** `dist`
4. **Environment Variables:**
    *   `VITE_API_URL`: *(Your Render backend URL, e.g., `https://cfrp-shm-api.onrender.com`)*
5. Click **Deploy**. Vercel will use the `vercel.json` file for routing.
6. Once deployed, copy your Vercel URL (e.g., `https://cfrp-shm.vercel.app`).

---

## 4. Finalizing CORS Configuration
For security, the backend must be configured to only accept requests from your Vercel frontend.

1. Go back to your Render Dashboard > Web Service > Environment.
2. Add/Update the `CORS_ORIGIN` variable to be your Vercel URL (no trailing slash).
    *   *Example:* `CORS_ORIGIN=https://cfrp-shm.vercel.app`
3. Render will automatically trigger a redeploy.

**The platform is now live!**
