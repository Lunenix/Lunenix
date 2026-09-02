-- Migration 0029: 62 industry verticals + Other custom fallback.
-- Extends existing workspaces.industry_preset (does not recreate CRM tables).

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS industry_custom_label TEXT DEFAULT NULL;

UPDATE workspaces SET industry_preset = 'bridal_shop'
  WHERE industry_preset = 'bridal';
UPDATE workspaces SET industry_preset = 'mobile_bartending'
  WHERE industry_preset = 'mobile_bar';
UPDATE workspaces SET industry_preset = 'contractors_construction'
  WHERE industry_preset = 'contractor';
UPDATE workspaces SET industry_preset = 'graphic_designer'
  WHERE industry_preset = 'creative';
UPDATE workspaces SET industry_preset = 'other'
  WHERE industry_preset = 'general';

CREATE OR REPLACE FUNCTION industry_pipeline_family(p_preset TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_preset IN (
      'architecture_spatial_design','art_gallery','consulting','content_creator',
      'digital_marketing_agency','employment_agency','graphic_designer',
      'home_based_business','hr_company_management','nonprofit','notary_service',
      'project_manager','real_estate_staging','real_estate_investor','realtor',
      'retail_ecommerce','sculptures_fine_art','talent_agency','tax_preparer',
      'travel_agency','virtual_assistant_admin','web_developer','creative'
    ) THEN 'creative'
    WHEN p_preset IN (
      'cleaning_services','contractors_construction','electrician','general_contractor',
      'handyman','hvac','inspection_service','interior_design_services',
      'landscaping_lawn_care','painting_drywall','pest_control','plumbing',
      'rental_company','roofing_exterior_repair','steelworking_metal_fabrication',
      'woodworking_custom_carpentry','contractor'
    ) THEN 'field'
    WHEN p_preset IN (
      'bakery_specialty_food','bridal_shop','caterer','dj_entertainment',
      'event_decor_services','event_planner','event_venue','florist_floral_design',
      'hair_makeup_hmua','mobile_bartending','photography_videography',
      'private_chef_services','bridal','mobile_bar'
    ) THEN 'event'
    WHEN p_preset IN (
      'corporate_trainer','doula_postpartum_care','esthetician_skincare',
      'fitness_wellness','lash_brow_specialist','life_coach','massage_therapy',
      'nutritionist','personal_stylist_image_consultant','pet_care','tattoo_pmu',
      'yoga_pilates_instructor'
    ) THEN 'wellness'
    ELSE 'general'
  END;
$$;

CREATE OR REPLACE FUNCTION seed_pipeline_stages(p_workspace_id UUID, p_preset TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  stages TEXT[];
  stage  TEXT;
  pos    INT := 1;
  family TEXT;
BEGIN
  family := industry_pipeline_family(p_preset);
  stages := CASE family
    WHEN 'creative' THEN ARRAY['Discovery','Proposal','Onboarding','In Production','Review','Final Delivery','Archived']
    WHEN 'field'    THEN ARRAY['Lead','Site Visit','Estimate Sent','Contract Signed','In Progress','Punch List','Closed']
    WHEN 'event'    THEN ARRAY['Inquiry','Consultation','Proposal Sent','Contract Signed','Planning','Day-Of','Follow-Up']
    WHEN 'wellness' THEN ARRAY['Lead','Consult Booked','Package Selected','In Care','Completed','Follow-Up','Closed']
    ELSE                 ARRAY['Lead','Qualified','Proposal','Negotiation','Won','Lost']
  END;

  FOREACH stage IN ARRAY stages LOOP
    INSERT INTO pipeline_stages (workspace_id, name, position, color)
    VALUES (p_workspace_id, stage, pos, '#6366f1')
    ON CONFLICT DO NOTHING;
    pos := pos + 1;
  END LOOP;
END;
$$;
