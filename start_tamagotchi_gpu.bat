@echo off
:: AIRI Tamagotchi - GPU-Enabled Dev Starter
:: Starts pnpm dev:tamagotchi with main GPU active

echo Starting Tamagotchi with GPU acceleration...
set AIRI_FORCE_HIGH_PERFORMANCE_GPU=1

call pnpm dev:tamagotchi
