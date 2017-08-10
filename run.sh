#!/usr/bin/env bash

# setup git user
git config user.name "Node Sauce Connect Cron"
git config user.email "node-sauce-connect-cron@users.noreply.github.com"

openssl aes-256-cbc -K $encrypted_2610d76ecfd3_key -iv $encrypted_2610d76ecfd3_iv -in deploy_key.enc -out deploy_key -d
chmod 600 deploy_key
eval `ssh-agent -s`
ssh-add deploy_key

# run script
npm run update
