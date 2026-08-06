-- Fill catalog fields for existing funding-program rows created before the catalog schema.

UPDATE funding_programs
SET
  provider = CASE
    WHEN provider IS NULL OR btrim(provider) = '' THEN 'Mock Funding Provider'
    ELSE provider
  END,
  category = CASE
    WHEN category IS NULL OR btrim(category) = '' THEN 'Grant'
    ELSE category
  END,
  program_url = CASE
    WHEN program_url IS NULL OR btrim(program_url) = '' THEN 'https://example.com/funding-programs/' || pid
    ELSE program_url
  END,
  funding_amount = COALESCE(funding_amount, 50000),
  location = CASE
    WHEN location IS NULL OR btrim(location) = '' THEN 'Canada'
    ELSE location
  END,
  raw_guidelines_text = CASE
    WHEN raw_guidelines_text IS NULL OR btrim(raw_guidelines_text) = '' THEN 'Mock program guidelines for testing eligibility, funding use, evidence, and application workflows.'
    ELSE raw_guidelines_text
  END,
  target_outcome = CASE
    WHEN target_outcome IS NULL OR btrim(target_outcome) = '' THEN 'Support measurable business growth, operational readiness, and responsible use of funds.'
    ELSE target_outcome
  END,
  description = CASE
    WHEN btrim(description) = '' THEN 'Mock funding opportunity for businesses seeking practical growth support through ' || name || '.'
    ELSE description
  END,
  eligibility = CASE
    WHEN btrim(eligibility) = '' THEN 'Businesses with a documented need, an accountable owner, and a credible plan for using the funds.'
    ELSE eligibility
  END,
  eligible_uses = CASE
    WHEN btrim(eligible_uses) = '' THEN 'Equipment, technology, hiring, marketing, market development, and implementation costs.'
    ELSE eligible_uses
  END,
  target_company_types = CASE
    WHEN btrim(target_company_types) = '' THEN 'Small and medium-sized businesses with a clear operating model and measurable next steps.'
    ELSE target_company_types
  END,
  required_evidence = CASE
    WHEN btrim(required_evidence) = '' THEN 'Business profile, ownership details, financial information, project budget, and measurable milestones.'
    ELSE required_evidence
  END,
  match_score = CASE WHEN match_score = 0 THEN 75 ELSE match_score END,
  source_id = COALESCE(NULLIF(btrim(source_id), ''), 'mock-catalog'),
  source_record_id = COALESCE(NULLIF(btrim(source_record_id), ''), id::text),
  source_version = CASE WHEN btrim(source_version) = '' THEN 'mock-v1' ELSE source_version END,
  record_version = CASE WHEN btrim(record_version) = '' THEN 'mock-v1-' || id::text ELSE record_version END;
