#!/bin/zsh

# Configuration
PROJECT_ID="uusloviqtxtaqacxhuia"
DB_PASS="YOUR_DB_PASSWORD" # User will need to provide this or we use direct psql if available

# Ensure paths are absolute
BASE_PATH="/Volumes/Cogitate/Cogitate/budget-buddy-pro/db"

# Connection string template
# postgres://postgres:[password]@db.uusloviqtxtaqacxhuia.supabase.co:5432/postgres

echo "Please enter your Supabase Database Password:"
read -s DB_PASSWORD

CONN_STR="postgres://postgres:$DB_PASSWORD@db.uusloviqtxtaqacxhuia.supabase.co:5432/postgres"

# Execute the SQL file using psql
psql "$CONN_STR" -f "$BASE_PATH/import_data.sql"
