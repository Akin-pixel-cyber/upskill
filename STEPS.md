# Exquis Upskill: deployment steps (zero to running)

Follow the parts in order. Every command is copy-pasteable. Text in `<ANGLE_BRACKETS>` is something you replace.

**What you will end up with:** one Ubuntu 24.04 EC2 server (t3.small) running the app with Docker Compose, nightly backups to a private S3 bucket (no AWS keys on the server), and a tested way to restore everything on a brand-new server.

| Part | What |
|---|---|
| 1 | Create the S3 backup bucket |
| 2 | Create the IAM role for the server |
| 3 | Launch the EC2 instance |
| 4 | Connect over SSH and install everything |
| 5 | Get the code onto the server |
| 6 | Configure `.env` |
| 7 | Zoho Mail SMTP |
| 8 | Start the app |
| 9 | First login and creating your team |
| 10 | Backups and cron |
| 11 | Disaster recovery walkthrough |
| 12 | Updating the app / adding the AI key |
| 13 | **LATER: domain + HTTPS** |
| 14 | Troubleshooting |

Pick one AWS region and use it everywhere (examples use `eu-west-1`; use the one closest to your team, for example `af-south-1` Cape Town or `eu-west-1` Ireland for Lagos).

---

## Part 1: Create the S3 backup bucket

Easiest path: open **AWS CloudShell** (the `>_` icon at the top of the AWS console) and paste these. It is already logged in with your account permissions.

```bash
export REGION=eu-west-1
export BUCKET=exquis-upskill-backups-$(openssl rand -hex 4)   # must be globally unique
echo "YOUR BUCKET NAME: $BUCKET"        # write this down

# 1. Create the bucket (for us-east-1 remove the --create-bucket-configuration part)
aws s3api create-bucket --bucket $BUCKET --region $REGION \
  --create-bucket-configuration LocationConstraint=$REGION

# 2. Block ALL public access
aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 3. Turn on versioning
aws s3api put-bucket-versioning --bucket $BUCKET --versioning-configuration Status=Enabled

# 4. Lifecycle rule: delete backups (and old versions) after 30 days
cat > lifecycle.json <<'JSON'
{ "Rules": [ {
  "ID": "expire-old-backups", "Status": "Enabled", "Filter": { "Prefix": "" },
  "Expiration": { "Days": 30 },
  "NoncurrentVersionExpiration": { "NoncurrentDays": 30 },
  "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 } } ] }
JSON
aws s3api put-bucket-lifecycle-configuration --bucket $BUCKET --lifecycle-configuration file://lifecycle.json
```

Check it worked: `aws s3api get-bucket-versioning --bucket $BUCKET` should print `"Status": "Enabled"`.

*Console alternative:* S3 → Create bucket → name it, keep **Block all public access** ticked, enable **Bucket Versioning** → Create. Then open the bucket → **Management** → **Create lifecycle rule** → apply to all objects → tick *Expire current versions* (30 days) and *Permanently delete noncurrent versions* (30 days).

Cost: a few cents a month for ~12 users.

---

## Part 2: Create the IAM role (least privilege to that one bucket)

Still in CloudShell (the variables `$BUCKET` must still be set; if CloudShell restarted, re-run `export BUCKET=<your bucket name>`):

```bash
cat > iam-policy.json <<JSON
{ "Version": "2012-10-17", "Statement": [
  { "Sid": "ListBackupBucket", "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"], "Resource": "arn:aws:s3:::$BUCKET" },
  { "Sid": "ReadWriteBackupObjects", "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject"], "Resource": "arn:aws:s3:::$BUCKET/*" } ] }
JSON
cat > trust.json <<'JSON'
{ "Version": "2012-10-17", "Statement": [ { "Effect": "Allow", "Principal": { "Service": "ec2.amazonaws.com" }, "Action": "sts:AssumeRole" } ] }
JSON

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws iam create-policy --policy-name upskill-backup-s3 --policy-document file://iam-policy.json
aws iam create-role --role-name upskill-ec2-role --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name upskill-ec2-role --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/upskill-backup-s3
aws iam create-instance-profile --instance-profile-name upskill-ec2-profile
aws iam add-role-to-instance-profile --instance-profile-name upskill-ec2-profile --role-name upskill-ec2-role
```

The role can only list this bucket and read/write objects in it. It cannot delete objects (lifecycle handles expiry) and cannot touch anything else in the account. The same JSON files are in the repo under `deploy/`.

*Console alternative:* IAM → Roles → Create role → *AWS service* → *EC2* → skip permissions → name `upskill-ec2-role` → create. Open it → *Add permissions* → *Create inline policy* → JSON tab → paste the policy above (with your bucket name) → save.

---

## Part 3: Launch the EC2 instance

EC2 → **Launch instance**:

| Setting | Value |
|---|---|
| Name | `exquis-upskill` |
| AMI | **Ubuntu Server 24.04 LTS** (64-bit x86) |
| Instance type | **t3.small** |
| Key pair | *Create new key pair* → name `upskill-key`, type **ED25519**, format `.pem`. It downloads once; keep it safe. |
| Network settings → Security group | *Create security group* with these inbound rules: **SSH (22)** source **My IP**; **Custom TCP 8080** source **0.0.0.0/0** (or your office IP range if you want it private). |
| Storage | **30 GiB**, type **gp3** |
| Advanced details → IAM instance profile | `upskill-ec2-profile` |

Click **Launch instance**.

Then give it a fixed address so it does not change when the server restarts: EC2 → *Elastic IPs* → *Allocate Elastic IP address* → Allocate → select it → *Actions* → *Associate Elastic IP address* → pick your instance. Use this address everywhere below as `<EC2_IP>`.

> If your home/office IP changes, SSH will stop working. Edit the security group's SSH rule to your new IP (Security group → Edit inbound rules → My IP).

---

## Part 4: Connect and install everything

On your computer:

```bash
chmod 400 ~/Downloads/upskill-key.pem
ssh -i ~/Downloads/upskill-key.pem ubuntu@<EC2_IP>
```

On the server, run each block:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git unzip curl ca-certificates gnupg
```

**Add 2 GB swap** (the t3.small has 2 GB RAM and the first build is memory hungry):

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**AWS CLI v2:**

```bash
cd /tmp && curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip -q awscliv2.zip && sudo ./aws/install && rm -rf aws awscliv2.zip && cd ~
aws sts get-caller-identity       # should show an assumed-role/upskill-ec2-role ARN
```

**Docker Engine + Compose plugin (official Docker repository):**

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker        # start Docker on every boot
sudo usermod -aG docker $USER             # run docker without sudo
```

Log out and back in so the group change applies (`exit`, then SSH in again), then test:

```bash
docker run --rm hello-world
docker compose version
```

---

## Part 5: Get the code onto the server

First, on your computer, push this repo to GitHub (create an empty repo, then):

```bash
unzip upskill.zip && cd upskill
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:<YOUR_ORG>/<YOUR_REPO>.git
git push -u origin main
```

`.env` is in `.gitignore`, so no secrets are pushed.

**On the server, public repo:**

```bash
git clone https://github.com/<YOUR_ORG>/<YOUR_REPO>.git upskill && cd upskill
```

**On the server, private repo (deploy key, recommended):**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/upskill_deploy -N "" -C "upskill-server"
cat ~/.ssh/upskill_deploy.pub
```

Copy that line. In GitHub: your repo → **Settings → Deploy keys → Add deploy key** → paste → leave *Allow write access* **off** → Add key. Then:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-upskill
  HostName github.com
  User git
  IdentityFile ~/.ssh/upskill_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
git clone git@github-upskill:<YOUR_ORG>/<YOUR_REPO>.git upskill && cd upskill
```

(Answer `yes` to the GitHub fingerprint question.)

*Alternative, token over HTTPS:* GitHub → Settings → Developer settings → Fine-grained tokens → repo access to this repo only, permission *Contents: Read-only*. Then `git clone https://<TOKEN>@github.com/<YOUR_ORG>/<YOUR_REPO>.git upskill`.

---

## Part 6: Configure `.env`

```bash
cd ~/upskill
cp .env.example .env
```

Generate secrets (copy each output into the matching line):

```bash
openssl rand -hex 24     # -> POSTGRES_PASSWORD
openssl rand -hex 48     # -> SESSION_SECRET
```

Edit the file: `nano .env` (save with `Ctrl+O`, Enter, exit with `Ctrl+X`).

| Variable | What it does | What to put |
|---|---|---|
| `APP_URL` | Address people type; used in email links | `http://<EC2_IP>:8080` (no trailing slash) |
| `APP_PORT` | Port opened on the server | `8080` |
| `SITE_ADDRESS` | Proxy listen address | `:8080` for now (see Part 13 for HTTPS) |
| `EMAIL_DOMAIN` | Only this email domain can sign up | `exquisappfactory.com` |
| `ADMIN_EMAILS` | Comma-separated; these become Admin on signup | your email, e.g. `you@exquisappfactory.com` |
| `POSTGRES_USER` / `POSTGRES_DB` | Database user and name | leave `upskill` |
| `POSTGRES_PASSWORD` | Database password | the 24-byte hex you generated |
| `SESSION_SECRET` | Signs login cookies (min 32 chars) | the 48-byte hex you generated |
| `COOKIE_SECURE` | Force secure cookies | leave empty (auto-on when `APP_URL` is `https://`) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Email sending | see Part 7; leave `SMTP_HOST` empty to log links instead |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | Optional AI plans | leave empty for now; see Part 12 |
| `S3_BUCKET` | Backup bucket | your bucket name from Part 1 |
| `AWS_REGION` | Bucket region | e.g. `eu-west-1` |

**Keep a copy of `.env` in your company password manager.** It is deliberately *not* backed up to S3 because it contains secrets, and you need it for disaster recovery (Part 11).

Lock the file: `chmod 600 .env`

---

## Part 7: Zoho Mail SMTP

1. **Find your data centre.** Log in to Zoho Mail and look at the address bar: `mail.zoho.com` (US), `mail.zoho.eu` (EU), `mail.zoho.in` (India), `mail.zoho.com.au` (Australia), `mail.zoho.jp` (Japan), `mail.zohocloud.ca` (Canada).
2. **Pick the SMTP host:**

   | Data centre | `SMTP_HOST` |
   |---|---|
   | US | `smtp.zoho.com` |
   | EU | `smtp.zoho.eu` |
   | India | `smtp.zoho.in` |
   | Australia | `smtp.zoho.com.au` |
   | Japan | `smtp.zoho.jp` |
   | Canada | `smtp.zohocloud.ca` |

   If your organisation is on a paid Zoho Workplace / Zoho Mail plan and `smtp.zoho.*` rejects you, try `smtppro.zoho.com` (or `smtppro.zoho.eu`, `.in`).
3. **Port:** `465` (SSL) is recommended. `587` (STARTTLS) also works. The app picks the right mode automatically.
4. **Create an app-specific password** (never use your normal password): go to `https://accounts.zoho.com/home#security/app_password` (use your region's accounts domain, for example `accounts.zoho.eu`). You may need to enable two-factor authentication first. Click **Generate New Password**, name it `Upskill`, copy it.
5. **Use a mailbox like `upskill@exquisappfactory.com`** (or any real mailbox/alias in your Zoho org). In Zoho Mail → Settings → Mail Accounts, make sure **SMTP access** is enabled for it.
6. Set in `.env`:

```
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=upskill@exquisappfactory.com
SMTP_PASS=<the app password>
SMTP_FROM="Exquis Upskill <upskill@exquisappfactory.com>"
```

The `From` address must be the authenticated mailbox or one of its aliases, otherwise Zoho rejects the mail.

If SMTP is blank or fails, the app still works: verification and reset links are printed in the server log (`docker compose logs api | grep LINK`).

---

## Part 8: Start the app

```bash
cd ~/upskill
docker compose up -d --build
```

The first build takes 3 to 6 minutes. Then:

```bash
docker compose ps                  # all three services should show "healthy" / "running"
docker compose logs -f api         # Ctrl+C to stop watching; look for "listening on :4000"
curl -s http://localhost:8080/api/health     # {"ok":true}
```

Useful any time: `docker compose logs --tail=100 web api db`, `docker compose restart api`, `docker compose down` (stops, keeps data). Never run `docker compose down -v`: that deletes your data volumes.

All containers use `restart: unless-stopped` and Docker starts on boot, so the app comes back after a reboot. Data lives in named volumes (`pgdata`, `uploads`).

---

## Part 9: First login and your team

1. Open `http://<EC2_IP>:8080` in your browser.
2. Click **Create an account**. Sign up with the email you put in `ADMIN_EMAILS`.
3. Open the verification email and click the link. (No email? `docker compose logs api | grep LINK`, copy the link into the browser.)
4. Sign in. You are an **Admin** automatically (top right badge).
5. Ask your colleagues to sign up the same way. Everyone starts as **Employee**.
6. Go to **Admin** in the sidebar:
   - Change someone's **Role** to Manager, HR or Admin (only Admins can do this).
   - Set each person's **Reporting manager**. The manager must have the Manager (or Admin) role first, so promote managers before assigning reports. This decides who approves their plans.
   - **Deactivate** leavers (they are signed out immediately).

Tip: a plan from someone with no reporting manager is routed to Admins, so approvals never get stuck.

---

## Part 10: Backups

**Test it manually first:**

```bash
cd ~/upskill
./scripts/backup.sh
aws s3 ls s3://<YOUR_BUCKET>/ --recursive --region <REGION>
```

You should see one `db/db-<timestamp>.dump` and one `uploads/uploads-<timestamp>.tar.gz`.

**Schedule nightly at 02:00 (server time, UTC by default):**

```bash
./scripts/install-cron.sh
```

Logs go to `/var/log/upskill-backup.log`. Check it the next morning: `tail -20 /var/log/upskill-backup.log`.

What is backed up: the full PostgreSQL database and every uploaded file (profile pictures and check-in evidence). Files older than 30 days expire automatically via the lifecycle rule, and versioning protects against accidental overwrites.

---

## Part 11: Disaster recovery walkthrough

Use this when the server is gone (terminated, corrupted, wrong region, etc.). Practise it once on a spare instance so you trust it.

1. **Launch a new instance** exactly as in Part 3 (same IAM instance profile `upskill-ec2-profile`, new or same security group). If you used an Elastic IP, associate it with the new instance so the address stays the same.
2. **Install everything**: Part 4, all of it (updates, swap, AWS CLI, Docker). Confirm `aws sts get-caller-identity` works.
3. **Clone the repo**: Part 5.
4. **Recreate `.env`**: `cp .env.example .env`, then paste your saved copy from the password manager (same `S3_BUCKET`, `AWS_REGION`, `ADMIN_EMAILS`, SMTP, and so on). If the new server has a different IP, update `APP_URL`.
5. **List available backups** (optional):
   ```bash
   aws s3 ls s3://<YOUR_BUCKET>/db/ --region <REGION>
   ```
6. **Restore** (latest backup, or give a timestamp such as `20261120T020001Z`):
   ```bash
   cd ~/upskill
   ./scripts/restore.sh            # or: ./scripts/restore.sh 20261120T020001Z
   ```
   Type `yes` when asked. The script downloads the backup, recreates the database, restores the uploads volume, then builds and starts the app.
7. **Confirm**: `docker compose ps` shows everything healthy; open `http://<EC2_IP>:8080`; sign in with an existing account; check Plans, an old check-in's evidence file, and profile pictures.
8. Reinstall the nightly cron: `./scripts/install-cron.sh`.

Users keep their passwords and data. Everyone is signed out once if `SESSION_SECRET` differs from before; that is expected.

---

## Part 12: Updating, and adding the AI key later

**Update to a new version (data is untouched):**

```bash
cd ~/upskill
./scripts/backup.sh          # safety net
git pull
docker compose up -d --build
docker compose ps
```

**Add the AI key (optional):** the app already works without it using the built-in plan generator. To switch AI on, edit `.env`:

```
AI_PROVIDER=openai          # or: anthropic
AI_API_KEY=<your key>
AI_MODEL=                   # optional; defaults: gpt-4o-mini / claude-sonnet-4-5
```

Then `docker compose up -d` (recreates the API with the new settings). If the AI call ever fails or times out, the app automatically falls back to the built-in generator.

---

## Part 13: LATER: add a domain with automatic HTTPS

Do this when you are ready; nothing above needs to change first.

1. **DNS:** at your DNS provider create an **A record**: name `upskill` (for `upskill.yourdomain.com`) pointing to `<EC2_ELASTIC_IP>`. Wait a few minutes. Check: `dig +short upskill.yourdomain.com` returns your IP.
2. **Open ports 80 and 443:** EC2 → Security groups → Edit inbound rules → add **HTTP (80)** and **HTTPS (443)** from `0.0.0.0/0`. (Port 80 is required for Let's Encrypt to issue the certificate.)
3. **Change two settings in `.env`:**
   ```
   SITE_ADDRESS=upskill.yourdomain.com
   APP_URL=https://upskill.yourdomain.com
   ```
4. **Restart:**
   ```bash
   cd ~/upskill && docker compose up -d
   docker compose logs -f web      # look for "certificate obtained successfully"
   ```
5. Open `https://upskill.yourdomain.com`. Cookies become Secure automatically, and email links use the new address.
6. Optional tidy-up: remove the port 8080 rule from the security group.

Rolling back is the same: put `SITE_ADDRESS=:8080` and the old `APP_URL` back and run `docker compose up -d`.

---

## Part 14: Troubleshooting

**I cannot open `http://<EC2_IP>:8080`.**
- The security group must allow TCP 8080 inbound. Use the instance's Elastic IP / current public IP.
- On the server run `docker compose ps`: is `web` up? `curl -s localhost:8080/api/health` should return `{"ok":true}`.
- Using `https://` by mistake? While on the IP address, use `http://`.
- Some corporate networks block unusual ports; try from your phone's data connection.

**Emails are not arriving.**
- `docker compose logs api | grep -i mail`. `535 Authentication Failed` means a wrong user or app password; `Invalid login` often means the wrong Zoho data-centre host.
- Check spam; confirm `SMTP_FROM` matches the authenticated mailbox or alias.
- Port 465 blocked? Try `SMTP_PORT=587`.
- After editing `.env`: `docker compose up -d`.
- Workaround: `docker compose logs api | grep LINK` prints verification and reset links.

**"FATAL: SESSION_SECRET must be set..." or the API keeps restarting.**
- `.env` is missing or `SESSION_SECRET` is under 32 characters. Fix it, then `docker compose up -d`. Check `docker compose logs api`.

**The `api` container is "unhealthy" or the database is not ready.**
- `docker compose logs db`. The first start can take about 30 seconds. If you changed `POSTGRES_PASSWORD` after the first start, the old password is stored in the volume: change it back, or (only on a fresh install with no data) `docker compose down -v` and start again.

**Build fails with "killed" or out-of-memory.**
- Make sure the swap file from Part 4 exists (`free -h`). Retry `docker compose up -d --build`.

**I cannot sign up: "Only @exquisappfactory.com addresses..."**
- That rule is intentional. Check `EMAIL_DOMAIN` in `.env`.

**I signed up with my admin email but I am not Admin.**
- `ADMIN_EMAILS` must contain exactly that email (case-insensitive). Edit `.env`, run `docker compose up -d`, then sign out and in again (admin is applied at sign-in too).

**Backup fails: "Unable to locate credentials" or "AccessDenied".**
- The instance needs the IAM instance profile (EC2 → instance → Actions → Security → Modify IAM role → `upskill-ec2-profile`). Check `aws sts get-caller-identity`. Check `S3_BUCKET` and `AWS_REGION` in `.env`, and the bucket name in the IAM policy.

**Restore errors.**
- `No database backups found`: wrong bucket or region, or no backup was ever uploaded (`aws s3 ls s3://<bucket>/db/`).
- `pg_restore: error`: the dump is from a different Postgres major version (this app uses 16 throughout). Choose another timestamp.
- The script stops the app first. If it aborted midway, rerun it, or run `docker compose up -d`.

**Disk is filling up.**
- `df -h` and `docker system df`. Clean old build cache: `docker builder prune -f`. Increase the EBS volume in the console if needed, then `sudo growpart /dev/nvme0n1 1 && sudo resize2fs /dev/nvme0n1p1`.

**Where are the logs?**
- `docker compose logs --tail=200 api`, `web`, `db`; backups: `/var/log/upskill-backup.log`.
