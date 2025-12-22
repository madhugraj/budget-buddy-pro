-- Disable triggers
ALTER TABLE public.profiles DISABLE TRIGGER ALL;
ALTER TABLE public.user_roles DISABLE TRIGGER ALL;

-- Clean existing data
TRUNCATE public.audit_logs CASCADE;
TRUNCATE public.notifications CASCADE;
TRUNCATE public.cam_monthly_reports CASCADE;
TRUNCATE public.savings_tracking CASCADE;
TRUNCATE public.savings_master CASCADE;
TRUNCATE public.mc_users CASCADE;
TRUNCATE public.cam_tracking CASCADE;
TRUNCATE public.petty_cash CASCADE;
TRUNCATE public.expenses CASCADE;
TRUNCATE public.income_actuals CASCADE;
TRUNCATE public.income_budget CASCADE;
TRUNCATE public.income_categories CASCADE;
TRUNCATE public.budget_master CASCADE;
TRUNCATE public.user_roles CASCADE;
TRUNCATE public.profiles CASCADE;

-- Insert Data from CSV Files
-- Specify columns explicitly for all tables to match the CSV files
\copy public.profiles (id, email, full_name, created_at) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/profiles-export-2025-12-22_09-56-18.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.user_roles (id, user_id, role, created_at) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/user_roles-export-2025-12-22_09-57-24.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.budget_master (id, fiscal_year, serial_no, item_name, category, committee, annual_budget, monthly_budget, created_at, updated_at, created_by) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/budget_master-export-2025-12-22_09-52-51.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.income_categories (id, name, description, committee, created_at, updated_at, created_by) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/income_categories-export-2025-12-22_09-55-21.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.income_budget (id, category_id, fiscal_year, budget_amount, created_at, updated_at, created_by) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/income_budget-export-2025-12-22_09-55-08.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.income_actuals (id, category_id, fiscal_year, month, amount, notes, created_at, updated_at, created_by) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/income_actuals-export-2025-12-22_09-54-49.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.expenses (id, budget_item_id, amount, description, invoice_url, status, claimed_by, approved_by, expense_date, created_at, updated_at, budget_master_id, gst_amount, is_correction, correction_reason, correction_requested_at, correction_approved_at, correction_completed_at, tds_percentage, tds_amount) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/expenses-export-2025-12-22_09-54-08.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.petty_cash (id, item_name, description, amount, date, status, submitted_by, approved_by, approved_at, created_at, updated_at, bill_url) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/petty_cash-export-2025-12-22_09-56-06.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.cam_tracking (id, tower, year, quarter, paid_flats, pending_flats, total_flats, notes, uploaded_by, created_at, updated_at, dues_cleared_from_previous, advance_payments, month, is_locked, status, submitted_at, approved_by, approved_at, correction_reason, correction_requested_at, correction_approved_at, document_url) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/cam_tracking-export-2025-12-22_09-53-42.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.mc_users (id, name, tower_no, unit_no, contact_number, email, photo_url, interest_groups, login_username, password_hash, temp_password, status, approved_by, approved_at, rejection_reason, created_at, updated_at) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/mc_users-export-2025-12-22_09-55-41.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.savings_master (id, name, description, category, target_amount, fiscal_year, is_active, created_by, created_at, updated_at) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/savings_master-export-2025-12-22_09-56-29.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.savings_tracking (id, savings_id, month, amount, notes, fiscal_year, created_by, created_at, updated_at) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/savings_tracking-export-2025-12-22_09-56-43.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.cam_monthly_reports (id, tower, year, month, report_type, file_url, uploaded_by, uploaded_at, created_at, updated_at) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/cam_monthly_reports-export-2025-12-22_09-53-13.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.notifications (id, user_id, title, message, type, is_read, created_at) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/notifications-export-2025-12-22_09-55-55.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

\copy public.audit_logs (id, expense_id, action, performed_by, details, created_at, old_values, new_values, correction_type, is_correction_log) FROM '/Volumes/Cogitate/Cogitate/budget-buddy-pro/db/audit_logs-export-2025-12-22_09-52-11.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

-- Re-enable triggers
ALTER TABLE public.profiles ENABLE TRIGGER ALL;
ALTER TABLE public.user_roles ENABLE TRIGGER ALL;
