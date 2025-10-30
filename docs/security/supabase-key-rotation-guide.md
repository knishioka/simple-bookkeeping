# Supabase Key Rotation Guide

## ⚠️ CRITICAL: Immediate Action Required

This guide is for handling leaked Supabase SERVICE_ROLE_KEY incidents.

**Security Incident Details:**

- **Date**: 2025-10-30
- **Leaked File**: `scripts/apply-rls-via-api.sh`
- **Commit**: fda83aa (cookie options preservation fix)
- **Remediation Commit**: 45cdb32
- **Project Ref**: eksgzskroipxdwtbmkxm
- **Credential Type**: Supabase SERVICE_ROLE_KEY (JWT)

---

## 📋 Immediate Actions Checklist

### 1. Rotate SERVICE_ROLE_KEY (URGENT - Do This First!)

**Time Estimate**: 5-10 minutes
**Priority**: 🔴 CRITICAL

#### Step 1: Access Supabase Dashboard

```bash
# Open Supabase Dashboard
open https://supabase.com/dashboard/project/eksgzskroipxdwtbmkxm/settings/api
```

#### Step 2: Generate New SERVICE_ROLE_KEY

1. Navigate to **Project Settings** → **API**
2. Scroll to **Project API keys** section
3. Find **service_role** key section
4. Click **Reset service_role key** button
5. **IMPORTANT**: Copy the new key immediately (it won't be shown again)

**Screenshot Location**: The service_role key is under "Project API keys" section

#### Step 3: Save New Key Securely

```bash
# IMPORTANT: Store in password manager FIRST before using
# Examples: 1Password, LastPass, Bitwarden

# ❌ NEVER save in plain text files
# ❌ NEVER commit to Git
# ❌ NEVER share via Slack/Email
```

### 2. Update Environment Variables

**Time Estimate**: 10-15 minutes
**Priority**: 🔴 CRITICAL

#### Local Development Environment

```bash
# Update .env.local (DO NOT COMMIT THIS FILE)
# File location: /Users/ken/Developer/private/simple-bookkeeping/.env.local

# Replace this line with new key:
SUPABASE_SERVICE_ROLE_KEY=<NEW_SERVICE_ROLE_KEY>

# Verify .env.local is in .gitignore
grep ".env.local" .gitignore
```

#### Vercel Production Environment

**Option A: Using Vercel CLI (Recommended)**

```bash
# Navigate to project root
cd /Users/ken/Developer/private/simple-bookkeeping

# Remove old key
vercel env rm SUPABASE_SERVICE_ROLE_KEY production

# Add new key
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# When prompted, paste the new SERVICE_ROLE_KEY

# Verify
vercel env ls production | grep SUPABASE_SERVICE_ROLE_KEY
```

**Option B: Using Vercel Dashboard**

1. Go to https://vercel.com/kens-projects-924cd1a9/simple-bookkeeping-jp/settings/environment-variables
2. Find `SUPABASE_SERVICE_ROLE_KEY`
3. Click **Edit**
4. Replace with new key
5. Select **Production** environment
6. Click **Save**

#### Trigger New Deployment

```bash
# Force new deployment to pick up new environment variable
git commit --allow-empty -m "chore: trigger deployment after key rotation"
git push origin main
```

### 3. Invalidate Old Key

**Note**: The old key is automatically invalidated when you reset it in Supabase Dashboard (Step 1.2).

**Verification**:

```bash
# Test that old key no longer works (should return 401)
curl -X GET \
  'https://eksgzskroipxdwtbmkxm.supabase.co/rest/v1/organizations' \
  -H "apikey: <OLD_KEY>" \
  -H "Authorization: Bearer <OLD_KEY>"

# Expected: {"code":"401","message":"Invalid API key"}
```

### 4. Verify New Key Works

```bash
# Test local environment
cd /Users/ken/Developer/private/simple-bookkeeping

# Create test script (temporary)
cat > /tmp/test-new-key.mjs <<'EOF'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test admin access
const { data, error } = await supabase.auth.admin.listUsers();

if (error) {
  console.error('❌ New key failed:', error);
  process.exit(1);
}

console.log('✅ New SERVICE_ROLE_KEY works!');
console.log(`   Found ${data.users.length} users`);
EOF

# Run test
node /tmp/test-new-key.mjs

# Clean up
rm /tmp/test-new-key.mjs
```

---

## 🧹 Git History Cleanup (Optional but Recommended)

**Time Estimate**: 30-60 minutes
**Priority**: 🟡 HIGH (if repository is public or shared)

### Why Clean Git History?

Even though the key is rotated, the leaked key remains in Git history:

- Commit `fda83aa` contains the old SERVICE_ROLE_KEY
- Anyone with access to repository can see historical commits
- Gitleaks and security scanners will continue to flag it

### Method 1: Using git-filter-repo (Recommended)

```bash
# Install git-filter-repo
brew install git-filter-repo

# IMPORTANT: Backup your repository first
cd /Users/ken/Developer/private/simple-bookkeeping
git bundle create ~/simple-bookkeeping-backup.bundle --all

# Remove the file from all history
git filter-repo --path scripts/apply-rls-via-api.sh --invert-paths

# Force push (⚠️ COORDINATE WITH TEAM FIRST)
git push origin --force --all

# Update .gitleaksignore to remove the fingerprint
# Edit .gitleaksignore and remove line:
# fda83aaaf97a14193b9ce987ddc37b045a91de03:scripts/apply-rls-via-api.sh:jwt:8
```

### Method 2: Using BFG Repo-Cleaner (Alternative)

```bash
# Install BFG
brew install bfg

# Backup first
cd /Users/ken/Developer/private/simple-bookkeeping
git bundle create ~/simple-bookkeeping-backup.bundle --all

# Clean history
bfg --delete-files apply-rls-via-api.sh

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (⚠️ COORDINATE WITH TEAM FIRST)
git push origin --force --all
```

### Post-Cleanup Steps

```bash
# All collaborators must re-clone
git clone <repository-url> simple-bookkeeping-clean

# Or force reset their local repository
cd simple-bookkeeping
git fetch origin
git reset --hard origin/main
```

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] New SERVICE_ROLE_KEY generated in Supabase Dashboard
- [ ] Old SERVICE_ROLE_KEY invalidated (returns 401)
- [ ] `.env.local` updated with new key
- [ ] Vercel environment variable updated
- [ ] New deployment successful on Vercel
- [ ] Application works in production
- [ ] Admin operations work (user management, etc.)
- [ ] Git history cleaned (optional)
- [ ] `.gitleaksignore` updated (if history cleaned)
- [ ] Team members notified (if applicable)

---

## 🛡️ Prevention Measures

### Implemented Fixes (Commit c5ffcdc)

1. **Pre-commit Hook Fixed**:
   - Changed from `gitleaks detect --source .` to `gitleaks protect --staged`
   - Now correctly scans only staged changes
   - More reliable exit codes

2. **File Deleted**:
   - Removed `scripts/apply-rls-via-api.sh`
   - Added to `.gitleaksignore` with incident documentation

### Additional Recommendations

#### 1. Use Environment Variables Management Tools

```bash
# Use direnv for automatic environment variable loading
# See: docs/direnv-setup.md

# Install direnv
brew install direnv

# Setup .envrc (DO NOT COMMIT)
echo 'export SUPABASE_SERVICE_ROLE_KEY="your-key-here"' > .envrc
direnv allow

# Verify .envrc is in .gitignore
echo ".envrc" >> .gitignore
```

#### 2. Regular Secret Scans

```bash
# Add to CI/CD pipeline (.github/workflows/security.yml)
- name: Gitleaks Scan
  uses: gitleaks/gitleaks-action@v2
  with:
    config-path: .gitleaks.toml

# Run manually before important commits
gitleaks detect --source . --verbose
```

#### 3. Pre-commit Hook Best Practices

```bash
# Test pre-commit hook manually
.husky/pre-commit

# Verify Gitleaks is using correct command
grep "gitleaks protect --staged" .husky/pre-commit

# Expected output:
# gitleaks protect --staged --verbose --redact
```

#### 4. Code Review Checklist

When reviewing PRs, check for:

- [ ] No hardcoded API keys or secrets
- [ ] No `.env` files committed
- [ ] No JWT tokens in code
- [ ] No database credentials
- [ ] All sensitive data uses `process.env.*`

#### 5. Developer Onboarding

Add to onboarding checklist:

- [ ] Install Gitleaks locally
- [ ] Setup direnv
- [ ] Configure 1Password CLI (optional)
- [ ] Review `docs/ai-guide/security-deployment.md`
- [ ] Never use `--no-verify` on commits

---

## 📚 Related Documentation

- [Security and Deployment Guide](../ai-guide/security-deployment.md)
- [Environment Variables Guide](../environment-variables.md)
- [Security README](./README.md)
- [RLS Policies](./rls-policies.md)

---

## 🔗 External Resources

- [Supabase API Keys Documentation](https://supabase.com/docs/guides/api#api-keys)
- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)
- [Git Filter-Repo Guide](https://github.com/newren/git-filter-repo)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

---

## 📝 Incident Report Template

For future incidents, document:

```markdown
### Incident Details

- **Date**: YYYY-MM-DD
- **Discovered By**: [Name/Tool]
- **Credential Type**: [API Key/JWT/Password]
- **Affected File**: [path/to/file]
- **Commit Hash**: [hash]
- **Time to Detection**: [hours/days]

### Actions Taken

1. [Action 1 with timestamp]
2. [Action 2 with timestamp]
3. [Action 3 with timestamp]

### Root Cause

[Explanation of how the leak occurred]

### Prevention Measures

[What was changed to prevent future occurrences]

### Lessons Learned

[Key takeaways]
```

---

**Last Updated**: 2025-10-30
**Incident**: SERVICE_ROLE_KEY leak in commit fda83aa
**Status**: ✅ Remediation commits completed (45cdb32, c5ffcdc)
