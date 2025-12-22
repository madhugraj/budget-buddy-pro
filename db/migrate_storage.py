#!/usr/bin/env python3
"""
Migrate all storage files from old Supabase project to new one.
Preserves folder structure and file metadata.
"""

import os
import sys
import requests
from pathlib import Path

# OLD Supabase Project (Source)
OLD_PROJECT_ID = "ujnxljbaapuvpnjdkick"
OLD_SUPABASE_URL = f"https://{OLD_PROJECT_ID}.supabase.co"
OLD_SERVICE_ROLE_KEY = os.environ.get("OLD_SUPABASE_SERVICE_ROLE_KEY")

# NEW Supabase Project (Destination)
NEW_PROJECT_ID = "uusloviqtxtaqacxhuia"
NEW_SUPABASE_URL = f"https://{NEW_PROJECT_ID}.supabase.co"
NEW_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1c2xvdmlxdHh0YXFhY3hodWlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjI5MjUyNywiZXhwIjoyMDgxODY4NTI3fQ.9CWtiHZJPUEcd68qx_6ywvWX9P73vvgjF6MAFrcwy7c"

# Buckets to migrate
BUCKETS = ["invoices", "mc-photos", "agreements", "savings", "cam"]

# Temporary download directory
TEMP_DIR = Path("/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/storage_temp")


def check_credentials():
    """Validate that all required credentials are set."""
    if not OLD_SERVICE_ROLE_KEY:
        print("❌ ERROR: OLD_SUPABASE_SERVICE_ROLE_KEY environment variable not set!")
        print("\nPlease set it before running:")
        print("  export OLD_SUPABASE_SERVICE_ROLE_KEY='your_old_service_role_key'")
        print("\nGet it from: https://supabase.com/dashboard/project/ujnxljbaapuvpnjdkick/settings/api")
        print("Look for 'service_role' key (NOT the anon/public key)")
        sys.exit(1)


def list_files_in_bucket(project_url: str, service_key: str, bucket_name: str) -> list:
    """List all files in a bucket."""
    url = f"{project_url}/storage/v1/object/list/{bucket_name}"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}"
    }
    
    all_files = []
    
    def list_folder(path: str = ""):
        """Recursively list files in folder."""
        params = {"limit": 1000}
        if path:
            params["prefix"] = path
        
        try:
            response = requests.get(url, headers=headers, params=params)
            if response.status_code != 200:
                print(f"  ⚠️  Warning: Could not list {bucket_name}/{path}: {response.status_code}")
                return
            
            items = response.json()
            for item in items:
                if item.get("name"):
                    file_path = f"{path}/{item['name']}" if path else item['name']
                    
                    # If it's a folder, recurse
                    if item.get("id") is None:
                        list_folder(file_path)
                    else:
                        all_files.append({
                            "name": item["name"],
                            "path": file_path,
                            "size": item.get("metadata", {}).get("size", 0)
                        })
        except Exception as e:
            print(f"  ⚠️  Error listing {bucket_name}/{path}: {e}")
    
    list_folder()
    return all_files


def download_file(project_url: str, service_key: str, bucket_name: str, file_path: str, local_path: Path) -> bool:
    """Download a file from storage."""
    url = f"{project_url}/storage/v1/object/{bucket_name}/{file_path}"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}"
    }
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            local_path.parent.mkdir(parents=True, exist_ok=True)
            with open(local_path, 'wb') as f:
                f.write(response.content)
            return True
        else:
            print(f"    ❌ Failed to download: {response.status_code}")
            return False
    except Exception as e:
        print(f"    ❌ Error downloading: {e}")
        return False


def upload_file(project_url: str, service_key: str, bucket_name: str, file_path: str, local_path: Path) -> bool:
    """Upload a file to storage."""
    url = f"{project_url}/storage/v1/object/{bucket_name}/{file_path}"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}"
    }
    
    try:
        with open(local_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(url, headers=headers, files=files)
            
            if response.status_code in [200, 201]:
                return True
            else:
                print(f"    ❌ Failed to upload: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        print(f"    ❌ Error uploading: {e}")
        return False


def migrate_bucket(bucket_name: str) -> dict:
    """Migrate all files from one bucket to another."""
    print(f"\n📦 Migrating bucket: {bucket_name}")
    print("=" * 60)
    
    # List files in old bucket
    print("  📋 Listing files in old project...")
    files = list_files_in_bucket(OLD_SUPABASE_URL, OLD_SERVICE_ROLE_KEY, bucket_name)
    
    if not files:
        print("  ℹ️  No files found in this bucket")
        return {"total": 0, "success": 0, "failed": 0}
    
    print(f"  📊 Found {len(files)} files")
    
    # Create temp directory for this bucket
    bucket_temp_dir = TEMP_DIR / bucket_name
    bucket_temp_dir.mkdir(parents=True, exist_ok=True)
    
    stats = {"total": len(files), "success": 0, "failed": 0}
    
    # Download and upload each file
    for idx, file_info in enumerate(files, 1):
        file_path = file_info["path"]
        local_path = bucket_temp_dir / file_path
        
        print(f"\n  [{idx}/{len(files)}] {file_path}")
        print(f"    ⬇️  Downloading from old project...")
        
        if download_file(OLD_SUPABASE_URL, OLD_SERVICE_ROLE_KEY, bucket_name, file_path, local_path):
            print(f"    ✅ Downloaded ({file_info['size']} bytes)")
            print(f"    ⬆️  Uploading to new project...")
            
            if upload_file(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, bucket_name, file_path, local_path):
                print(f"    ✅ Uploaded successfully")
                stats["success"] += 1
                # Clean up temp file
                local_path.unlink()
            else:
                stats["failed"] += 1
        else:
            stats["failed"] += 1
    
    return stats


def main():
    """Main migration function."""
    print("=" * 60)
    print("📦 Supabase Storage Migration Tool")
    print("=" * 60)
    print(f"Source: {OLD_SUPABASE_URL}")
    print(f"Destination: {NEW_SUPABASE_URL}")
    print("=" * 60)
    
    # Check credentials
    check_credentials()
    
    # Confirm with user
    response = input("\n⚠️  This will migrate ALL files from old to new project. Continue? (yes/no): ")
    if response.lower() != "yes":
        print("❌ Migration cancelled")
        sys.exit(0)
    
    # Create temp directory
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    
    # Migrate each bucket
    total_stats = {"total": 0, "success": 0, "failed": 0}
    
    for bucket in BUCKETS:
        stats = migrate_bucket(bucket)
        total_stats["total"] += stats["total"]
        total_stats["success"] += stats["success"]
        total_stats["failed"] += stats["failed"]
    
    # Clean up temp directory
    print(f"\n🧹 Cleaning up temporary files...")
    try:
        import shutil
        shutil.rmtree(TEMP_DIR)
        print("  ✅ Cleanup complete")
    except:
        print(f"  ⚠️  Please manually delete: {TEMP_DIR}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("✅ Migration Complete!")
    print("=" * 60)
    print(f"Total files: {total_stats['total']}")
    print(f"✅ Successfully migrated: {total_stats['success']}")
    print(f"❌ Failed: {total_stats['failed']}")
    print("=" * 60)
    
    if total_stats["failed"] > 0:
        print("\n⚠️  Some files failed to migrate. Check the logs above for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
