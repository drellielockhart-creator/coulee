#!/bin/bash
cd /home/eleanor/projects/coulee
just run play --session /home/eleanor/projects/coulee/playtests/2026-10-11-r2-catalogkid-ironford42/session "$@" 2>&1 | tail -n +2
