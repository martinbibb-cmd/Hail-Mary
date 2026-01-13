# Atlas VM Bootstrap (Ubuntu)

This runbook documents the initial setup steps for a fresh Atlas Ubuntu VM.

## 0) SSH into the VM (from Mac)

```bash
ssh bibbm@192.168.6.52
```

## 1) Update OS

```bash
sudo apt update && sudo apt upgrade -y
```

## 2) Install base tooling

```bash
sudo apt install -y \
  ca-certificates curl gnupg git unzip htop nano tmux \
  ufw fail2ban
```

## 3) Install Docker Engine + Compose (Ubuntu-supported way)

> NOTE: Do this on the Ubuntu VM, not Unraid.

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 4) Allow your user to run docker without sudo

```bash
sudo usermod -aG docker $USER
newgrp docker
```

## 5) Sanity checks

```bash
docker --version
docker compose version
```

## 6) Basic firewall (allow SSH, leave the rest for later)

```bash
sudo ufw allow OpenSSH
sudo ufw --force enable
```

## 7) Enable fail2ban

```bash
sudo systemctl enable --now fail2ban
```

## 8) Create an apps directory

```bash
mkdir -p ~/apps
cd ~/apps
```
