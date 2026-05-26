# Full Deployment Guide for PSITS Web System

Since your project consists of two parts (a React Frontend and a Node.js Backend), you will need to deploy them to two different services. 
* **Backend (server):** We will deploy this to **Render** (Free).
* **Frontend (PSITS):** We will deploy this to **Vercel** (Free).

---

## Phase 1: Uploading to GitHub

First, we need to get your code onto your GitHub account (`markdanieldigol9-alt`).

### Step 1: Create the Empty Repository
1. Go to your GitHub profile and click the **Repositories** tab.
2. Click the green **New** button.
3. Repository name: `psits-web-system`
4. **IMPORTANT:** Do not check "Add a README file" or "Add .gitignore". Leave it completely empty.
5. Click **Create repository**.

### Step 2: Push Your Code
Open a new Terminal in VS Code, and copy/paste these commands one by one:

```powershell
# 1. Navigate to your project folder
cd "d:\VS code\PSITS Web System"

# 2. Initialize a new Git repository
git init

# 3. Add all your files
git add .

# 4. Save (commit) the files
git commit -m "Initial commit for Deployment"

# 5. Rename the main branch
git branch -M main

# 6. Link to your specific GitHub repository
git remote add origin https://github.com/markdanieldigol9-alt/psits-web-system.git

# 7. Upload the code!
git push -u origin main
```
*(If it asks you to log in to GitHub in a popup window, go ahead and authorize it).*

---

## Phase 2: Deploying the Backend (Render)

Your frontend needs a live backend URL to talk to, so we must deploy the backend first!

1. Go to [Render.com](https://render.com/) and create a free account using your GitHub.
2. Click **New +** and select **Web Service**.
3. Select **Build and deploy from a Git repository**.
4. Connect your GitHub account and select your `psits-web-system` repository.
5. Fill in the deployment details:
   - **Name:** `psits-backend`
   - **Root Directory:** `server` *(Type this exactly!)*
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start` (or `node index.js`, depending on your server file)
   - **Instance Type:** Free
6. Click **Create Web Service**.
7. Wait 2-3 minutes for it to build. Once it says "Live", **copy the URL** provided at the top left (it will look something like `https://psits-backend-xyz.onrender.com`).

---

## Phase 3: Deploying the Frontend (Vercel)

Now we deploy the frontend and tell it where the backend lives.

1. Go to [Vercel.com](https://vercel.com/) and log in with your GitHub.
2. Click **Add New...** -> **Project**.
3. Find your `psits-web-system` repository and click **Import**.
4. Under **Configure Project**:
   - **Root Directory:** Click Edit and select `PSITS`.
   - **Framework Preset:** Vite (it should auto-detect this).
5. Open the **Environment Variables** section. We need to add the URL from Render so the frontend knows how to talk to the backend.
   - **Name:** `VITE_API_URL`
   - **Value:** Paste your Render URL here (e.g. `https://psits-backend-xyz.onrender.com/api`)
   - Click **Add**.
6. Click **Deploy**!

Once the build finishes, Vercel will give you a live link to your fully functioning website! 🎉

---

## Phase 4: Database Hosting (TiDB Cloud)

Your system uses a MySQL-compatible database hosted on AWS via TiDB Cloud.
- **Connection Details:** Make sure your backend environment variables on Render are correctly configured with your TiDB connection string (e.g., `mysql://<username>:<password>@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/sys`).
- Ensure the Render IP is allowed in your TiDB Cloud network settings if they enforce IP whitelisting.

---

## Recent System Architecture Updates
For your documentation or paper, the following critical updates have been integrated into the system's architecture and deployment configuration:
1. **SPA Routing on Vercel:** A `vercel.json` configuration file was added to the frontend root to handle Single Page Application (SPA) routing. This fixes the 404 errors that occur when a user refreshes the page or navigates directly to a URL route.
2. **Enhanced Validation:** The frontend-backend synchronization has been improved. Member creation now strictly enforces strong passwords (10+ characters, upper/lowercase, numbers, special characters) with direct UI error feedback via an Axios interceptor in `api.ts`.
3. **UI/UX Refinements:** The "Industry View" in the reports module and unused post types in the community forum have been cleaned up for a more cohesive user experience.
4. **Comprehensive System Audit:** The system has been fully audited. A complete set of Data Flow Diagrams (DFD) and Entity Relationship Diagrams (ERD) is available in your project's documentation.
