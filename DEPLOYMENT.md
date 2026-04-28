# FEPC Scheduling System - Deployment Guide

## ⚠️ Important: SQLite vs PostgreSQL

**SQLite will NOT work on Render!** SQLite is a file-based database that gets wiped on each deployment. You MUST use PostgreSQL for production.

---

## 🚀 Deploying to Render

### Step 1: Create a PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **PostgreSQL**
3. Fill in the details:
   - **Name**: `fepc-database`
   - **Region**: Choose closest to your users
   - **PostgreSQL Version**: 15 or higher
   - **Instance Type**: Free (for development) or paid tier
4. Click **Create Database**
5. **Copy the Internal Database URL** (looks like: `postgresql://user:pass@host/render-db-name`)

### Step 2: Update Your Project for PostgreSQL

#### 2.1 Update Prisma Schema

Replace `prisma/schema.prisma` with `prisma/schema.postgres.prisma`:

```bash
# Backup your current schema
cp prisma/schema.prisma prisma/schema.sqlite.prisma

# Use PostgreSQL schema
cp prisma/schema.postgres.prisma prisma/schema.prisma
```

#### 2.2 Update package.json Build Script

Add a post-install script to run Prisma migrations:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build",
    "postinstall": "prisma generate"
  }
}
```

### Step 3: Create a Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Fill in the details:
   - **Name**: `fepc-scheduling`
   - **Region**: Same as your database
   - **Branch**: main
   - **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free or paid tier

5. Add **Environment Variables**:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your PostgreSQL Internal Database URL |
| `NEXTAUTH_SECRET` | Generate with: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Render app URL (e.g., `https://fepc-scheduling.onrender.com`) |
| `NODE_ENV` | `production` |

### Step 4: Create Initial Admin User

After deployment, you'll need to create an admin user. You can:

**Option A: Use Render Shell**
```bash
# In Render Dashboard → Your Web Service → Shell
npx prisma db seed
```

**Option B: Create a seed script**

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create departments
  const csDept = await prisma.department.upsert({
    where: { name: 'Computer Science' },
    update: {},
    create: {
      name: 'Computer Science',
      code: 'CS',
      college: 'College of Engineering',
    },
  });

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { email: 'admin@fepc.edu' },
    update: {},
    create: {
      uid: 'admin-001',
      name: 'System Administrator',
      email: 'admin@fepc.edu',
      password: hashedPassword,
      role: 'admin',
      departmentId: csDept.id,
      maxUnits: 24,
      specialization: JSON.stringify([]),
    },
  });

  console.log('Seed completed!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Add to `package.json`:
```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

---

## 📝 Environment Variables Checklist

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `NEXTAUTH_SECRET` | Secret for NextAuth.js | Random 32+ character string |
| `NEXTAUTH_URL` | Your app's public URL | `https://your-app.onrender.com` |
| `NODE_ENV` | Environment mode | `production` |

---

## 🔄 Migration from SQLite to PostgreSQL

If you have existing data in SQLite that you want to migrate:

### Step 1: Export SQLite Data

```bash
# Install pgloader (macOS)
brew install pgloader

# Or use a script to export data as JSON
node scripts/export-sqlite-data.js > data-export.json
```

### Step 2: Import to PostgreSQL

Create a migration script:

```typescript
// scripts/migrate-to-postgres.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const data = JSON.parse(fs.readFileSync('./data-export.json', 'utf-8'));

async function migrate() {
  // Migrate departments
  for (const dept of data.departments) {
    await prisma.department.create({ data: dept });
  }

  // Migrate users
  for (const user of data.users) {
    await prisma.user.create({ data: user });
  }

  // ... continue for other models
  
  console.log('Migration completed!');
}

migrate();
```

---

## 🐛 Common Issues

### Issue: Prisma Client Not Generated
**Solution**: Add `prisma generate` to your build script

### Issue: Database Connection Failed
**Solution**: 
- Check DATABASE_URL is correct
- Ensure database is running (free tier databases sleep after inactivity)
- Use the Internal Database URL, not External

### Issue: Migration Fails
**Solution**:
- Run `npx prisma migrate reset --force` (WARNING: deletes all data)
- Or run `npx prisma db push` for development

### Issue: App Crashes on Start
**Solution**: Check Render logs for specific errors. Common causes:
- Missing environment variables
- Database not connected
- Port not set correctly (Render uses PORT env variable)

---

## 📊 Database Costs on Render

| Tier | Cost | Storage | Connections |
|------|------|---------|-------------|
| Free | $0 | 1 GB | 97 |
| Starter | $7/month | 10 GB | 97 |
| Standard | $20/month | 100 GB | 1000 |

---

## 🔐 Security Recommendations

1. **Never commit** `.env` files to Git
2. Use **strong passwords** for admin accounts
3. Enable **HTTPS only** in Render settings
4. Set up **CORS** properly for API routes
5. Add **rate limiting** for login attempts
6. Use **environment-specific** secrets

---

## 🚀 Quick Deploy Button

Add this to your README.md for easy deployment:

```markdown
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/fepc-scheduling)
```

---

## Need Help?

- [Render Documentation](https://render.com/docs)
- [Prisma PostgreSQL Guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
