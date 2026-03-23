#!/bin/bash

SERVICES=(
  matter-server
  mosquitto
  zigbee2mqtt
  homeassistant
  pihole
)

for s in "${SERVICES[@]}"; do
  echo "===================="
  echo "Restarting $s"
  echo "===================="
  ~/homelab/scripts/manage.sh $s
  sleep 3
done
