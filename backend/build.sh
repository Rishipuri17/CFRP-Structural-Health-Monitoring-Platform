#!/usr/bin/env bash
# Build script for Render.com
# This runs when Render deploys the application.

echo "Installing Node.js dependencies..."
npm install --production

echo "Installing Python dependencies..."
# Render's native Node environment includes python3 and pip3
pip3 install -r requirements.txt

echo "Generating synthetic NASA CFRP data..."
python3 src/simulate.py

echo "Training ML models..."
python3 src/train_classifier.py
python3 src/train_regressor.py

echo "Build complete."
