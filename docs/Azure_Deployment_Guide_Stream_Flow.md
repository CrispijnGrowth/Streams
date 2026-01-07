# Azure Deployment Guide for Stream-Flow (Azure Portal UI)

## Overview

This guide walks you through deploying your Stream-Flow application to an Azure Resource Group, including an Azure App Service and Azure Database for PostgreSQL - Flexible Server, all configured via the Azure Portal UI. We'll ensure all resources are deployed to a Netherlands region.

## Prerequisites

- An Azure subscription with appropriate permissions.
- Your Postmark API key (for email notifications).
- Your GitHub repository URL for Stream-Flow.
- A secure password for your PostgreSQL database.
- A secure session secret string.

## Chosen Azure Region: West Europe (Netherlands)

All resources will be deployed to **West Europe**, which is a primary Azure region located in the Netherlands.

---

## Step 0: Initial Planning & Naming Conventions

Let's define the names for our resources. You can customize these, but using a consistent naming scheme helps with organization.

| Resource | Name |
|----------|------|
| Resource Group Name | `sovereign-cloud-clarity-rg` (reuse existing) |
| App Service Plan Name | `stream-flow-plan` |
| Web App Name | `stream-flow` |
| PostgreSQL Server Name | `stream-flow-db` |
| PostgreSQL Database Name | `streamflow` |

---

## Step 1: Use Existing Resource Group

Since you already have the `sovereign-cloud-clarity-rg` resource group, we'll reuse it.

1. **Log in to Azure Portal**: Go to https://portal.azure.com.
2. **Navigate to Resource Groups**: In the search bar at the top, type "Resource groups" and select it.
3. **Select your Resource Group**: Click on `sovereign-cloud-clarity-rg`.

All new resources will be created within this existing resource group.

---

## Step 2: Create Azure App Service

This will host your Node.js application. We'll create the App Service Plan and the Web App.

1. **Search for App Services**: In the search bar, type "App Services" and select it.

2. **Create New App Service**: Click on **+ Create**.

3. **Basics Tab**:
   - **Subscription**: Select your subscription.
   - **Resource Group**: Choose `sovereign-cloud-clarity-rg`.
   - **Name**: Enter `stream-flow`.
   - **Publish**: Select **Code**.
   - **Runtime stack**: Select **Node 24 LTS**.
   - **Operating System**: Select **Linux**.
   - **Region**: Select **West Europe**.

4. **App Service Plan**:
   - Click **Create new**.
   - **Linux Plan**: Enter `stream-flow-plan`.
   - **SKU and size**: Click **Change size**.
     - Under "Dev/Test", select **B1 (Basic)**.
     - Click **Apply**.

5. **Monitoring Tab** (Optional but Recommended):
   - **Enable Application Insights**: Select **Yes**.
   - **New resource name**: Enter `stream-flow-insights`.
   - **Region**: Select **West Europe**.

6. **Review + Create**: Click **Review + create**, then **Create**.

Wait for the deployment to complete.

---

## Step 3: Create Azure Database for PostgreSQL - Flexible Server

This will be your PostgreSQL database.

1. **Search for Azure Database for PostgreSQL**: In the search bar, type "Azure Database for PostgreSQL" and select it.

2. **Create PostgreSQL Server**: Click **+ Create**.

3. **Select Deployment Option**: Choose **Flexible server** and click **Create**.

4. **Basics Tab**:
   - **Subscription**: Select your subscription.
   - **Resource group**: Choose `sovereign-cloud-clarity-rg`.
   - **Server name**: Enter `stream-flow-db`.
   - **Region**: Select **West Europe**.
   - **Workload type**: Select **Development**.

5. **Compute + storage**:
   - **Server configuration**: Select **Configure server**.
   - **Tier**: Select **Burstable**.
   - **SKU size**: Select **B1ms** (1 vCore, 2 GiB RAM).
   - **Storage**: Adjust if needed (default 20 GiB is usually fine to start).
   - Click **Save**.

6. **Version**: Select **14**.

7. **Authentication**:
   - **Admin username**: Enter `dbadmin`.
   - **Password**: Enter your chosen secure password.
   - **Confirm password**: Re-enter your password.

8. **Networking Tab**:
   - **Connectivity method**: Select **Public access (allowed IP addresses)**.
   - **Add current client IP address**: Do not add this if you're deploying from GitHub.
   - **Allow public access from any Azure service within Azure**: Select **Yes**. This is crucial for your App Service to connect.

9. **Review + Create**: Click **Review + create**, then **Create**.

This deployment can take several minutes. Once complete:

1. Navigate to the `stream-flow-db` resource.
2. On the server's Overview page, note the **Server name** (e.g., `stream-flow-db.postgres.database.azure.com`). This will be your `PGHOST`.
3. In the left-hand menu, under "Settings", click **Databases**.
4. Click **+ Create**.
   - **Database name**: Enter `streamflow`.
   - **Charset**: UTF8.
   - **Collation**: English_United States.1252.
5. Click **Save**.

---

## Step 4: Configure Environment Variables in App Service

Now we'll add your application's settings, including your Postmark API key and database connection details.

1. **Navigate to your App Service**: Go to `stream-flow` in the Azure Portal.

2. **Configuration**: In the left-hand menu, under "Settings", click **Configuration**.

3. **Application settings**: Click **+ New application setting**.

Add each of the following variables:

### POSTMARK_API_KEY
- **Name**: `POSTMARK_API_KEY`
- **Value**: `YOUR-POSTMARK-API-KEY` (Replace with your actual key)
- **Deployment slot setting**: Unchecked
- Click **OK**.

### DATABASE_URL
- **Name**: `DATABASE_URL`
- **Value**: `postgresql://dbadmin:YOUR_SECURE_DB_PASSWORD@stream-flow-db.postgres.database.azure.com:5432/streamflow`
  - Replace `YOUR_SECURE_DB_PASSWORD` with your actual password
  - Verify the PostgreSQL server name
- Click **OK**.

### PGHOST
- **Name**: `PGHOST`
- **Value**: `stream-flow-db.postgres.database.azure.com` (Verify your server name)
- Click **OK**.

### PGPORT
- **Name**: `PGPORT`
- **Value**: `5432`
- Click **OK**.

### PGDATABASE
- **Name**: `PGDATABASE`
- **Value**: `streamflow`
- Click **OK**.

### PGUSER
- **Name**: `PGUSER`
- **Value**: `dbadmin`
- Click **OK**.

### PGPASSWORD
- **Name**: `PGPASSWORD`
- **Value**: `YOUR_SECURE_DB_PASSWORD` (Replace with your actual password)
- Click **OK**.

### SESSION_SECRET
- **Name**: `SESSION_SECRET`
- **Value**: A long, random string. Generate one with:
  ```bash
  openssl rand -base64 32
  ```
  Paste the output here.
- Click **OK**.

### NODE_ENV
- **Name**: `NODE_ENV`
- **Value**: `production`
- Click **OK**.

### PORT
- **Name**: `PORT`
- **Value**: `5000`
- Click **OK**.

4. **Save all settings**: After adding all settings, click **Save** at the top of the "Configuration" pane. Your App Service will restart.

---

## Step 5: Deploy Application from GitHub

Azure App Service can automatically pull your code from GitHub and set up continuous deployment.

1. **Navigate to your App Service**: Go to `stream-flow` in the Azure Portal.

2. **Deployment Center**: In the left-hand menu, under "Deployment", click **Deployment Center**.

3. **Source Control**:
   - **Source**: Select **GitHub**.
   - **Build Provider**: Select **GitHub Actions** (recommended for Node.js apps).
   - Click **Authorize** if prompted, and follow the steps to connect your GitHub account.

4. **Organization, Repository, Branch**:
   - **Organization**: Select your GitHub organization/user.
   - **Repository**: Select `stream-flow` (or your repository name).
   - **Branch**: Select `main` (or your primary branch).

5. **Review + Create**: Click **Save**.

Azure will now initiate the first deployment. This involves:
- Creating a GitHub Actions workflow file in your repository.
- Building your Node.js application (running `npm install`, `npm run build`).
- Deploying the built application to your App Service.

This process can take several minutes. You can monitor its progress in the "Logs" tab within the Deployment Center or directly on GitHub under your repository's "Actions" tab.

---

## Step 6: Initialize Database (Run Migrations)

After your application has deployed, you need to run the database migrations.

1. **Navigate to your App Service**: Go to `stream-flow` in the Azure Portal.

2. **Console**: In the left-hand menu, under "Development Tools", click **Console**.
   - This opens a command-line interface directly into your running App Service container.

3. **Run Migrations**: In the console, type the command and press Enter:
   ```bash
   npm run db:push
   ```

You should see output indicating that your Drizzle Kit migrations are running and completing successfully, creating tables in your PostgreSQL database.

---

## Step 7: Configure PostgreSQL Firewall (Crucial!)

Your App Service needs permission to connect to your PostgreSQL server.

### Get App Service Outbound IP Addresses:

1. In the Azure Portal, go to your App Service (`stream-flow`).
2. In the left-hand menu, under "Networking", click **Networking**.
3. Under "Outbound Traffic", look for **"Outbound IP addresses"**. Copy all the IP addresses listed (there might be multiple, separated by commas).

### Add Firewall Rule to PostgreSQL:

1. Navigate to your PostgreSQL Flexible Server (`stream-flow-db`).
2. In the left-hand menu, under "Settings", click **Networking**.
3. Under "Firewall rules", click **+ Add a firewall rule**.
   - **Rule name**: `AllowStreamFlowApp` (or a similar descriptive name).
   - **Start IP address**: Paste one of the outbound IP addresses you copied.
   - **End IP address**: Paste the same outbound IP address.
   - Click **Add**.
4. Repeat this for each outbound IP address if there are multiple.
5. Click **Save** at the top of the networking pane.

> **Note**: If you enabled "Allow public access from any Azure service within Azure" in Step 3, you might not strictly need these explicit IP rules. However, adding the specific IPs enhances security.

---

## Step 8: Verification

Give your application a few minutes to fully restart and settle after the database initialization.

### Check Application Health:

1. Open your web browser and go to your application's URL:
   ```
   https://stream-flow.azurewebsites.net
   ```

2. You should see the Stream-Flow login page.

3. Register as the first user (this will be the admin account).

4. Test the login functionality and verify the application loads correctly.

### Verify Email Integration:

1. Test the password reset functionality to ensure Postmark email integration is working.
2. Check that new user registration notifications are sent to the admin.

### Check Logs:

1. In the Azure Portal, go to your App Service (`stream-flow`).
2. In the left-hand menu, under "Monitoring", click **Log stream**.
3. This will show live logs from your application to help diagnose any issues.

---

## Troubleshooting Tips

### App Service Not Starting:

- In the App Service (`stream-flow`), go to **Diagnose and solve problems** (under "Development Tools").
- Check **Log stream** for specific errors.
- Verify **Configuration > Application settings** for correctness of `NODE_ENV`, `PORT`, and your database variables.

### Database Connection Errors:

- Review **Networking** settings for your PostgreSQL server.
- Double-check firewall rules.
- Ensure the `DATABASE_URL` and individual `PG*` variables in your App Service Configuration are exact.
- Check the password you entered for `dbadmin` against what's configured in Azure PostgreSQL.

### Email/Postmark Errors:

- Confirm `POSTMARK_API_KEY` in App Service Configuration is correct and active.
- Check your Postmark account for sending limits or domain verification issues.

---

## Next Steps (Highly Recommended)

1. **Security (Azure Key Vault)**: For production, store sensitive values like `POSTMARK_API_KEY` and `SESSION_SECRET` in Azure Key Vault and reference them in your App Service.

2. **Custom Domain & SSL**: Configure a custom domain (e.g., `streamflow.yourcompany.com`) and ensure SSL is enabled.

3. **Backup Strategy**: Set up automated backups for your PostgreSQL Flexible Server.

4. **Monitoring Alerts**: Configure alerts in Application Insights for critical application metrics (e.g., high CPU, memory, errors).

---

## Summary of Resources Created

| Resource Type | Name | Purpose |
|--------------|------|---------|
| Resource Group | `sovereign-cloud-clarity-rg` | Container for all resources (reused) |
| App Service Plan | `stream-flow-plan` | Compute resources for the web app |
| App Service | `stream-flow` | Hosts the Node.js application |
| PostgreSQL Server | `stream-flow-db` | Database server |
| PostgreSQL Database | `streamflow` | Application database |
| Application Insights | `stream-flow-insights` | Monitoring (optional) |

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `POSTMARK_API_KEY` | API key for Postmark email service |
| `DATABASE_URL` | Full PostgreSQL connection string |
| `PGHOST` | PostgreSQL server hostname |
| `PGPORT` | PostgreSQL port (5432) |
| `PGDATABASE` | Database name (streamflow) |
| `PGUSER` | Database admin username |
| `PGPASSWORD` | Database admin password |
| `SESSION_SECRET` | Secret for session encryption |
| `NODE_ENV` | Environment (production) |
| `PORT` | Application port (5000) |
