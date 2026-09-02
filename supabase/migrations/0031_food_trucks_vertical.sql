-- Add Food Trucks to the Event & Wedding pipeline family.

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
      'food_trucks','hair_makeup_hmua','mobile_bartending','photography_videography',
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
