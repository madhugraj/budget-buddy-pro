-- Fix swapped CAM data for July (Month 7)
-- "CAM with GST" and "CAM without GST" amounts were swapped.

DO $$
DECLARE
  v_cam_with_gst_id uuid;
  v_cam_without_gst_id uuid;
  v_cam_with_gst_record record;
  v_cam_without_gst_record record;
BEGIN
  -- 1. Get Category IDs
  SELECT id INTO v_cam_with_gst_id FROM income_categories WHERE category_name ILIKE '%CAM with GST%' LIMIT 1;
  SELECT id INTO v_cam_without_gst_id FROM income_categories WHERE category_name ILIKE '%CAM without GST%' LIMIT 1;

  IF v_cam_with_gst_id IS NULL OR v_cam_without_gst_id IS NULL THEN
    RAISE NOTICE 'Could not find CAM categories. Skipping migration.';
    RETURN;
  END IF;

  -- 2. Get July Records (Month 7)
  -- Assuming fiscal year is 'FY25-26' based on previous context, but let's check for any fiscal year to be safe or restrict if needed.
  -- The issue description implies it's for the current data.
  
  -- Fetch record for CAM with GST
  SELECT * INTO v_cam_with_gst_record 
  FROM income_actuals 
  WHERE category_id = v_cam_with_gst_id AND month = 7;

  -- Fetch record for CAM without GST
  SELECT * INTO v_cam_without_gst_record 
  FROM income_actuals 
  WHERE category_id = v_cam_without_gst_id AND month = 7;

  IF v_cam_with_gst_record IS NULL OR v_cam_without_gst_record IS NULL THEN
    RAISE NOTICE 'Could not find both income records for July. Skipping migration.';
    RETURN;
  END IF;

  -- 3. Swap amounts
  -- Update CAM with GST record with values from CAM without GST record
  UPDATE income_actuals
  SET 
    actual_amount = v_cam_without_gst_record.actual_amount,
    gst_amount = v_cam_without_gst_record.gst_amount
  WHERE id = v_cam_with_gst_record.id;

  -- Update CAM without GST record with values from CAM with GST record (original values stored in variable)
  UPDATE income_actuals
  SET 
    actual_amount = v_cam_with_gst_record.actual_amount,
    gst_amount = v_cam_with_gst_record.gst_amount
  WHERE id = v_cam_without_gst_record.id;

  RAISE NOTICE 'Successfully swapped CAM amounts for July.';

END $$;
