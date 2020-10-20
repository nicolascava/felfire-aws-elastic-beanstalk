#!/bin/bash

echo 'ECS_AVAILABLE_LOGGING_DRIVERS=["json-file","awslogs"]' >> /etc/ecs/ecs.config

docker pull amazon/amazon-ecs-agent:latest
docker stop ecs-agent
docker rm ecs-agent
start ecs
