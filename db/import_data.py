#!/usr/bin/env python3
"""
Import CSV data from Lovable export to new Supabase project.
This script reads CSV files and inserts them into the database using the Supabase client.
"""

import csv
import os
import sys
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://uusloviqtxtaqacxhuia.supabase.co"
SUPABASE_KEY = "sb_publishable_6_6B0JzuTFJmXdauy_LOHw_h-p-Uy70"  # Public/anon key

# You MUST set the service role key as an environment variable for data import
# Get this from: Supabase Dashboard -> Settings -> API -> service_role key
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SERVICE_ROLE_KEY:
    print("ERROR: Please set the SUPABASE_SERVICE_ROLE_KEY environment variable")
    print("Get it from: https://supabase.com/dashboard/project/uusloviqtxtaqacxhuia/settings/api")
    print("\nExample:")
    print('  export SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."')
    print('  python import_data.py')
    sys.exit(1)

# Initialize Supabase client with service role key (bypasses RLS)
supabase: Client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

BASE_DIR = "/Volumes/Cogitate/Cogitate/budget-buddy-pro/db"

# Define import order (respects foreign key constraints)
IMPORT_CONFIG = [
    {
        "table": "profiles",
        "file": "profiles-export-2025-12-22_09-56-18.csv",
        "csv_columns": ["id", "email", "full_name", "created_at"],
        "db_columns": ["id", "email", "full_name", "created_at"]
    },
    {
        "table": "user_roles",
        "file": "user_roles-export-2025-12-22_09-57-24.csv",
        "csv_columns": ["id", "user_id", "role", "created_at"],
        "db_columns": ["id", "user_id", "role", "created_at"]
    },
    {
        "table": "budget_master",
        "file": "budget_master-export-2025-12-22_09-52-51.csv",
        "csv_columns": ["id", "fiscal_year", "serial_no", "item_name", "category", "committee", 
                       "annual_budget", "monthly_budget", "created_at", "updated_at", "created_by"],
        "db_columns": ["id", "fiscal_year", "serial_no", "item_name", "category", "committee", 
                      "annual_budget", "monthly_budget", "created_at", "updated_at", "created_by"]
    },
    {
        "table": "income_categories",
        "file": "income_categories-export-2025-12-22_09-55-21.csv",
        "csv_columns": ["id", "category_name", "subcategory_name", "display_order", "is_active", "created_at", "updated_at"],
        "db_columns": ["id", "category_name", "subcategory_name", "display_order", "is_active", "created_at", "updated_at"]
    },
    {
        "table": "income_budget",
        "file": "income_budget-export-2025-12-22_09-55-08.csv",
        "csv_columns": ["id", "fiscal_year", "category_id", "budget_amount", "created_by", "created_at", "updated_at"],
        "db_columns": ["id", "fiscal_year", "category_id", "budgeted_amount", "created_by", "created_at", "updated_at"]
    },
    {
        "table": "income_actuals",
        "file": "income_actuals-export-2025-12-22_09-54-49.csv",
        "csv_columns": ["id", "fiscal_year", "month", "category_id", "amount", "notes", "created_by", "created_at", "updated_at"],
        "db_columns": ["id", "fiscal_year", "month", "category_id", "actual_amount", "notes", "recorded_by", "created_at", "updated_at"]
    },
    {
        "table": "expenses",
        "file": "expenses-export-2025-12-22_09-54-08.csv",
        "csv_columns": ["id", "budget_item_id", "amount", "description", "invoice_url", "status", 
                       "claimed_by", "approved_by", "expense_date", "created_at", "updated_at", 
                       "budget_master_id", "gst_amount", "is_correction", "correction_reason", 
                       "correction_requested_at", "correction_approved_at", "correction_completed_at", 
                       "tds_percentage", "tds_amount"],
        "db_columns": ["id", "budget_item_id", "amount", "description", "invoice_url", "status", 
                      "claimed_by", "approved_by", "expense_date", "created_at", "updated_at", 
                      "budget_master_id", "gst_amount", "is_correction", "correction_reason", 
                      "correction_requested_at", "correction_approved_at", "correction_completed_at", 
                      "tds_percentage", "tds_amount"]
    },
    {
        "table": "petty_cash",
        "file": "petty_cash-export-2025-12-22_09-56-06.csv",
        "csv_columns": ["id", "item_name", "description", "amount", "date", "status", 
                       "submitted_by", "approved_by", "created_at", "updated_at", "bill_url"],
        "db_columns": ["id", "item_name", "description", "amount", "date", "status", 
                      "submitted_by", "approved_by", "created_at", "updated_at", "bill_url"]
    },
    {
        "table": "cam_tracking",
        "file": "cam_tracking-export-2025-12-22_09-53-42.csv",
        "csv_columns": ["id", "tower", "year", "quarter", "paid_flats", "pending_flats", "total_flats", 
                       "notes", "uploaded_by", "created_at", "updated_at", "dues_cleared_from_previous", 
                       "advance_payments", "month", "is_locked", "status", "submitted_at", "approved_by", 
                       "approved_at", "correction_reason", "correction_requested_at", 
                       "correction_approved_at", "document_url"],
        "db_columns": ["id", "tower", "year", "quarter", "paid_flats", "pending_flats", "total_flats", 
                      "notes", "uploaded_by", "created_at", "updated_at", "dues_cleared_from_previous", 
                      "advance_payments", "month", "is_locked", "status", "submitted_at", "approved_by", 
                      "approved_at", "correction_reason", "correction_requested_at", 
                      "correction_approved_at", "document_url"]
    },
    {
        "table": "mc_users",
        "file": "mc_users-export-2025-12-22_09-55-41.csv",
        "csv_columns": ["id", "name", "tower_no", "unit_no", "contact_number", "email", "photo_url", 
                       "interest_groups", "login_username", "password_hash", "temp_password", "status", 
                       "approved_by", "approved_at", "rejection_reason", "created_at", "updated_at"],
        "db_columns": ["id", "name", "tower_no", "unit_no", "contact_number", "email", "photo_url", 
                      "interest_groups", "login_username", "password_hash", "temp_password", "status", 
                      "approved_by", "approved_at", "rejection_reason", "created_at", "updated_at"],
        "transform": "mc_users_array"
    },
    {
        "table": "savings_master",
        "file": "savings_master-export-2025-12-22_09-56-29.csv",
        "csv_columns": ["id", "investment_type", "investment_name", "bank_institution", "account_number",
                       "principal_amount", "interest_rate", "start_date", "maturity_date", "duration_months",
                       "expected_maturity_amount", "current_value", "current_status", "document_url", "notes",
                       "fiscal_year", "created_by", "created_at", "updated_at"],
        "db_columns": ["id", "investment_type", "investment_name", "bank_institution", "account_number",
                      "principal_amount", "interest_rate", "start_date", "maturity_date", "duration_months",
                      "expected_maturity_amount", "current_value", "current_status", "document_url", "notes",
                      "fiscal_year", "created_by", "created_at", "updated_at"]
    },
    {
        "table": "savings_tracking",
        "file": "savings_tracking-export-2025-12-22_09-56-43.csv",
        "csv_columns": ["id", "savings_id", "month", "amount", "notes", "fiscal_year", 
                       "created_by", "created_at", "updated_at"],
        "db_columns": ["id", "savings_id", "month", "amount", "notes", "fiscal_year", 
                      "created_by", "created_at", "updated_at"]
    },
    {
        "table": "cam_monthly_reports",
        "file": "cam_monthly_reports-export-2025-12-22_09-53-13.csv",
        "csv_columns": ["id", "tower", "year", "month", "report_type", "file_url", 
                       "uploaded_by", "uploaded_at", "created_at", "updated_at"],
        "db_columns": ["id", "tower", "year", "month", "report_type", "file_url", 
                      "uploaded_by", "uploaded_at", "created_at", "updated_at"]
    },
    {
        "table": "notifications",
        "file": "notifications-export-2025-12-22_09-55-55.csv",
        "csv_columns": ["id", "user_id", "title", "message", "type", "is_read", "created_at"],
        "db_columns": ["id", "user_id", "title", "message", "type", "is_read", "created_at"]
    },
    {
        "table": "audit_logs",
        "file": "audit_logs-export-2025-12-22_09-52-11.csv",
        "csv_columns": ["id", "expense_id", "action", "performed_by", "details", "created_at", 
                       "old_values", "new_values", "correction_type", "is_correction_log"],
        "db_columns": ["id", "expense_id", "action", "performed_by", "details", "created_at", 
                      "old_values", "new_values", "correction_type", "is_correction_log"]
    }
]


def clean_value(value: str) -> any:
    """Clean CSV value and convert to appropriate type."""
    if value == "" or value is None:
        return None
    # Handle booleans
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    return value


def import_table(config: dict) -> None:
    """Import data from CSV file into specified table."""
    table_name = config["table"]
    file_path = os.path.join(BASE_DIR, config["file"])
    csv_columns = config["csv_columns"]
    db_columns = config["db_columns"]
    transform_type = config.get("transform")
    
    print(f"\n📥 Importing {table_name}...")
    
    if not os.path.exists(file_path):
        print(f"  ⚠️  File not found: {file_path}")
        return
    
    # Read CSV file
    rows = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            # Clean and map row data from CSV columns to DB columns
            clean_row = {}
            for csv_col, db_col in zip(csv_columns, db_columns):
                if csv_col in row:
                    value = clean_value(row[csv_col])
                    
                    # Special transformation for mc_users interest_groups array
                    if transform_type == "mc_users_array" and db_col == "interest_groups" and value:
                        # Convert from CSV format: "[\"Sports\",\"Finance\"]"
                        # to PostgreSQL array format: ["Sports", "Finance"]
                        try:
                            import json
                            # Remove outer quotes and unescape
                            if isinstance(value, str) and value.startswith('"[') and value.endswith(']"'):
                                value = value[1:-1]  # Remove outer quotes
                            value = json.loads(value) if value else []
                        except:
                            value = []
                    
                    clean_row[db_col] = value
            
            rows.append(clean_row)
    
    if not rows:
        print(f"  ℹ️  No data to import (empty file)")
        return
    
    print(f"  📊 Found {len(rows)} rows")
    
    # Delete existing data first
    try:
        print(f"  🗑️  Clearing existing data...")
        supabase.table(table_name).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    except Exception as e:
        print(f"  ⚠️  Could not clear table (might be empty): {e}")
    
    # Insert in batches of 100
    batch_size = 100
    total_inserted = 0
    
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            result = supabase.table(table_name).insert(batch).execute()
            total_inserted += len(batch)
            print(f"  ✅ Inserted batch {i//batch_size + 1} ({len(batch)} rows)")
        except Exception as e:
            print(f"  ❌ Error inserting batch {i//batch_size + 1}: {e}")
            # Try inserting one by one to identify problematic rows
            for idx, row in enumerate(batch):
                try:
                    supabase.table(table_name).insert(row).execute()
                    total_inserted += 1
                except Exception as row_error:
                    print(f"    ⚠️  Failed row {i + idx}: {row_error}")
    
    print(f"  ✨ Completed: {total_inserted}/{len(rows)} rows imported")


def main():
    """Main import function."""
    print("=" * 60)
    print("🚀 Supabase Data Import Tool")
    print("=" * 60)
    print(f"Target: {SUPABASE_URL}")
    print(f"Data Directory: {BASE_DIR}")
    
    # Confirm with user
    response = input("\n⚠️  This will DELETE existing data and import from CSV. Continue? (yes/no): ")
    if response.lower() != "yes":
        print("❌ Import cancelled")
        sys.exit(0)
    
    # Import each table in order
    for config in IMPORT_CONFIG:
        import_table(config)
    
    print("\n" + "=" * 60)
    print("✅ Import completed!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Verify data in Supabase Dashboard")
    print("2. Create auth users for: treasurer@prestige-bella-vista.com, etc.")
    print("3. Test your application")


if __name__ == "__main__":
    main()
