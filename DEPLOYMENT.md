# Deployment Guide

This guide explains how to deploy the server to **Render** and connect it with your frontend on **Vercel**.

## 1. Deploy Server to Render

Since you have already created the Web Service and added environment variables:

1.  **Push your latest code** to GitHub.
2.  Render should automatically detect the push and start a new deployment (if you connected the repo).
3.  Monitor the "Logs" tab in the Render dashboard to ensure the build and start commands execute successfully.
    *   **Build Command**: `npm install`
    *   **Start Command**: `npm start`
4.  Once deployed, copy your **Service URL** (e.g., `https://your-app.onrender.com`).

## 2. Connect Frontend (Vercel)

You need to tell your frontend where the backend is located.

1.  Go to your **Vercel Dashboard**.
2.  Select your frontend project.
3.  Go to **Settings** > **Environment Variables**.
4.  Find the variable that defines your API URL. It is usually named `VITE_API_URL` (if using Vite) or `REACT_APP_API_URL` (if using Create React App).
5.  **Edit** or **Add** this variable:
    *   **Key**: `VITE_API_URL` (or your specific variable name)
    *   **Value**: `https://your-app.onrender.com/api` (Make sure to include `/api` if your frontend expects it, or just the base URL depending on your axios/fetch setup).
6.  **Save** the variable.
7.  **Redeploy** your frontend for the changes to take effect:
    *   Go to the **Deployments** tab.
    *   Click the three dots on the latest deployment and select **Redeploy**.

## 3. Verify Connection

1.  Open your live frontend URL.
2.  Try to perform an action that uses the backend (e.g., Log in, play an audio, view teachings).
3.  If something fails, check the **Browser Console** (F12) for CORS errors or 404s.
    *   **CORS Error?** Ensure your backend `cors` configuration allows the Vercel domain. Currently, `app.use(cors())` in `src/index.js` allows *all* origins, which is fine for testing but consider restricting it to your Vercel domain for production.
