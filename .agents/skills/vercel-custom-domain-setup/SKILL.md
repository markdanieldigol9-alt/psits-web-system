---
name: vercel-custom-domain-setup
description: >-
  Guide for connecting a custom domain to a Vercel deployment.
  Use when the user asks to add, configure, or troubleshoot a custom
  domain on Vercel, including DNS record setup at the domain registrar
  (e.g., Hostinger, GoDaddy, Namecheap, Cloudflare).
---

# Vercel Custom Domain Setup

Step-by-step guide for connecting a custom domain to a Vercel project.

## Prerequisites

- A domain purchased from a registrar (Hostinger, GoDaddy, Namecheap, etc.)
- A Vercel project already deployed
- Access to the domain registrar's DNS management panel

## Step 1: Complete Domain Registrar Verification

Before configuring DNS, ensure:
- **Email verification** is completed at the registrar (check inbox for verification link)
- Domain status is **Active** (not "Pending verification")

## Step 2: Add Domain in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Domains**
2. Click **Add Existing** (or type in the search box)
3. Enter your domain (e.g., `psitsregion12.com`)
4. Vercel will show the required DNS configuration

> [!TIP]
> Add both the apex domain (`example.com`) and www subdomain (`www.example.com`).
> Vercel will automatically configure a redirect between them.

## Step 3: Configure DNS at Domain Registrar

### Option A: Using DNS Records (Recommended)

Go to your registrar's **DNS / Nameservers** panel and switch from parking
nameservers to the registrar's own DNS management, then add:

| Type | Name/Host | Value/Target | TTL |
|------|-----------|-------------|-----|
| **A** | `@` (root) | `76.76.21.21` | Auto / 3600 |
| **CNAME** | `www` | `cname.vercel-dns.com` | Auto / 3600 |

#### Hostinger-Specific Steps:
1. Go to **Hostinger Dashboard** → **Domains** → Select domain
2. Click **DNS / Nameservers** in the left sidebar
3. If nameservers are set to parking (`aster.dns-parking.com`), click **Edit**
   and change to Hostinger's default nameservers:
   - `ns1.dns-parking.com`
   - `ns2.dns-parking.com`
   Or use Hostinger's DNS Zone editor directly.
4. In **DNS Zone**, add the A record and CNAME record listed above
5. Remove any conflicting A or CNAME records for `@` or `www`

### Option B: Using Vercel Nameservers

Alternatively, point your domain's nameservers directly to Vercel:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

> [!WARNING]
> This delegates ALL DNS management to Vercel. Only use this if you don't
> need other DNS records (e.g., email MX records) managed at your registrar.

## Step 4: Verify in Vercel

1. After DNS changes, go back to Vercel → **Domains**
2. Click **Refresh** next to each domain
3. Wait for DNS propagation (can take 5 minutes to 48 hours, typically ~10 minutes)
4. Status should change from **Invalid Configuration** to **Valid Configuration** ✅

## Step 5: SSL Certificate

Vercel automatically provisions a free SSL certificate once DNS is verified.
No manual action needed — HTTPS will be active within minutes.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Invalid Configuration** persists | DNS propagation can take up to 48 hours. Use `nslookup example.com` or [dnschecker.org](https://dnschecker.org) to verify |
| **Parking nameservers** still active | Change nameservers at registrar first, then add DNS records |
| **Email verification pending** | Complete the registrar email verification before DNS changes |
| **Conflicting records** | Remove old A/AAAA/CNAME records for @ and www before adding Vercel records |
| **308 redirect loop** | Ensure both apex and www are added in Vercel, and only ONE has a redirect configured |
