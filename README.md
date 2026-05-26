# PSITS Web System

A comprehensive web-based platform for the Philippine Society of Information Technology Students (PSITS). This system streamlines member management, event coordination, officer elections, and community engagement.

## 🚀 Tech Stack & Deployment Architecture

This project is built with a modern, decoupled architecture and is hosted across several cloud providers:

*   **Version Control:** [GitHub](https://github.com/)
*   **Frontend (React/Vite):** Hosted on [Vercel](https://vercel.com/)
*   **Backend (Node.js/Express):** Hosted on [Render](https://render.com/)
*   **Database (MySQL-compatible):** Hosted on [TiDB Cloud](https://tidbcloud.com/) (AWS)

## 🔄 Recent System Updates & Refinements

The following critical updates have been integrated into the system's architecture:

1.  **SPA Routing on Vercel:** Added a `vercel.json` configuration file to properly handle Single Page Application (SPA) routing without giving a 404 error on page refresh.
2.  **Enhanced Validation:** Improved frontend-to-backend synchronization to explicitly catch strict database requirements (e.g., 10+ character complex passwords for members).
3.  **UI/UX Refinements:** Cleaned up unused post types (like Announcements in the Community Forum) and removed the "Industry View" to keep the user experience tightly focused.
4.  **Database Migration:** Fully migrated to TiDB Cloud with updated connection strings and verified connectivity.

## 📂 Project Structure

*   `/PSITS` - The React frontend application.
*   `/server` - The Node.js API and backend services.
*   `DEPLOYMENT_GUIDE.md` - Step-by-step instructions for deploying the system.

## 🛠️ Local Development

To run this project locally:
1. Ensure your TiDB Cloud database connection strings are properly set in your `.env` files.
2. Run the backend: `cd server && npm install && npm start`
3. Run the frontend: `cd PSITS && npm install && npm run dev`
