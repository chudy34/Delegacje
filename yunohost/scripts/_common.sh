#!/bin/bash
# Common variables for Delegacje SaaS YunoHost scripts

# App identifier
app=$YNH_APP_INSTANCE_NAME

# Install/data paths (from manifest resources)
install_dir=$(ynh_app_setting_get --app="$app" --key="install_dir")
data_dir=$(ynh_app_setting_get --app="$app" --key="data_dir")

# Domain and path
domain=$(ynh_app_setting_get --app="$app" --key="domain")
path=$(ynh_app_setting_get --app="$app" --key="path")
path=${path%/}  # Remove trailing slash

# Ports
port_backend=$(ynh_app_setting_get --app="$app" --key="port_backend")
port_frontend=$(ynh_app_setting_get --app="$app" --key="port_frontend")

# DB
db_pwd=$(ynh_app_setting_get --app="$app" --key="db_pwd")

# App settings
ai_provider=$(ynh_app_setting_get --app="$app" --key="ai_provider")
gemini_api_key=$(ynh_app_setting_get --app="$app" --key="gemini_api_key")
