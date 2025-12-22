#!/usr/bin/env python3
"""
Create auth users in Supabase from the profiles CSV export.
This must be run BEFORE importing data because many tables have foreign keys to auth.users.
"""

import csv
import os
import sys
import requests

# Supabase configuration
SUPABASE_URL = "https://uusloviqtxtaqacxhuia.supabase.co"
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SERVICE_ROLE_KEY:
    print("ERROR: Please set the SUPABASE_SERVICE_ROLE_KEY environment variable")
    sys.exit(1)

BASE_DIR = "/Volumes/Cogitate/Cogitate/budget-buddy-pro/db"
PROFILES_FILE = os.path.join(BASE_DIR, "profiles-export-2025-12-22_09-56-18.csv")

def create_auth_user(user_id: str, email: str, full_name: str) -> bool:
    """Create a user in auth.users using Supabase Admin API."""
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Create user with specific ID and auto-confirm
    payload = {
        "id": user_id,
        "email": email,
        "email_confirm": True,  # Auto-confirm email
        "password": "TempPassword123!",  # Temporary password - users should reset
        "user_metadata": {
            "full_name": full_name or ""
        }
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200 or response.status_code == 201:
            print(f"  ✅ Created: {email} ({user_id})")
            return True
        elif response.status_code == 422 and "already been registered" in response.text:
            print(f"  ℹ️  Already exists: {email}")
            return True
        else:
            print(f"  ❌ Failed: {email} - {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"  ❌ Error creating {email}: {e}")
        return False


def main():
    """Create all auth users from profiles CSV."""
    print("=" * 60)
    print("🔐 Creating Auth Users from Profiles")
    print("=" * 60)
    
    if not os.path.exists(PROFILES_FILE):
        print(f"ERROR: Profiles file not found: {PROFILES_FILE}")
        sys.exit(1)
    
    # Read profiles CSV
    users = []
    with open(PROFILES_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            users.append({
                'id': row['id'],
                'email': row['email'],
                'full_name': row.get('full_name', '')
            })
    
    print(f"Found {len(users)} users to create\n")
    
    success_count = 0
    for user in users:
        if create_auth_user(user['id'], user['email'], user['full_name']):
            success_count += 1
    
    print("\n" + "=" * 60)
    print(f"✅ Created/Verified {success_count}/{len(users)} auth users")
    print("=" * 60)
    print("\n📋 Default password for all users: TempPassword123!")
    print("⚠️  Users should change their password on first login\n")


if __name__ == "__main__":
    main()
