# NPM Package Deployment Guide - LocalDB JS

## Preparation Completed ✅

1. **Package Structure** - Proper folder structure created
2. **Tests** - All 30 tests passing
3. **Documentation** - Complete README.md ready
4. **License** - MIT License added
5. **.npmignore** - Test files excluded

---

## Steps to Publish on NPM

### Step 1: Create NPM Account (if you don't have one)

1. Go to https://www.npmjs.com
2. **Sign Up**
3. Verify your email

### Step 2: Check Package Name Availability

```bash
npm search dimond-db
```

**Note:** If the name is already taken, change it in `package.json`:
- `@imarifluqman/dimond-db`
- `dimond-db-v2`
- `my-diamond-database`

### Step 3: Login to NPM

```bash
npm login
```

It will ask for:
- Username
- Password
- Email
- One-time password (if 2FA is enabled)

### Step 4: Test the Package (Final Check)

```bash
# Run tests
npm test

# Check package contents
npm pack --dry-run
```

This will show which files will be published.

### Step 5: Verify Version Number

```bash
# Check current version
npm version

# If you need to update version:
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

### Step 6: Publish the Package

```bash
npm publish
```

**If it's a scoped package:**
```bash
npm publish --access public
```

### Step 7: Verify Publication

```bash
# Check on NPM
npm view dimond-db

# Or directly install and test
npm install dimond-db
```

---

## Important: Before Publishing

### ✅ Checklist

- [ ] Correct name, version, description in `package.json`
- [ ] `README.md` complete and updated
- [ ] LICENSE file present
- [ ] All tests passing
- [ ] Unnecessary files excluded in `.npmignore`
- [ ] Correct `repository` URL (GitHub/GitLab)
- [ ] Relevant keywords for search

### ⚠️ Repository Setup (Recommended)

Create a GitHub repository before publishing:

```bash
# Initialize Git
git init

# Add files
git add .

# First commit
git commit -m "Initial commit: LocalDB JS v1.0.0

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"

# Create repository on GitHub, then add remote
git remote add origin https://github.com/imarifluqman/dimond-db.git

# Push
git push -u origin main
```

Then update the repository URL in `package.json`.

---

## Complete Process at a Glance

```bash
# 1. Login
npm login

# 2. Check package name
npm search dimond-db

# 3. Run tests
npm test

# 4. Dry run (optional)
npm pack --dry-run

# 5. Publish
npm publish

# 6. Verify
npm view dimond-db
```

---

## After Publishing

### Test Installation

In a new directory:
```bash
mkdir test-dimond-db
cd test-dimond-db
npm init -y
npm install dimond-db
```

### Quick Test:
```javascript
// test.js
import { LocalDB } from 'dimond-db';

const db = new LocalDB({ database: 'test' });
const users = db.collection('users');

await users.insertOne({ name: 'Test User' });
console.log(await users.find());
```

```bash
node test.js
```

---

## Version Updates (Future)

Whenever you make changes:

```bash
# 1. Commit changes
git add .
git commit -m "Fix: bug description"

# 2. Version bump
npm version patch

# 3. Push (with version tag)
git push && git push --tags

# 4. Publish new version
npm publish
```

---

## Troubleshooting

### Error: Package name already exists
**Solution:** Change the name in `package.json` to something unique

### Error: You must be logged in
**Solution:** Run `npm login`

### Error: 402 Payment Required
**Solution:** Use `--access public` for scoped packages

### Tests fail during prepublishOnly
**Solution:** Fix all tests, then publish

---

## Unpublishing a Package (Emergency)

⚠️ **Only within 72 hours:**
```bash
npm unpublish dimond-db@1.0.0
```

⚠️ **Entire package (use carefully):**
```bash
npm unpublish dimond-db --force
```

---

## After Success!

✅ Your package will be available at https://npmjs.com/package/dimond-db!

✅ Anyone can install it:
```bash
npm install dimond-db
```

✅ View NPM stats:
- Downloads
- Dependents
- Versions
