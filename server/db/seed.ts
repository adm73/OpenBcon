import { environment } from '../config'
import { databasePool } from './pool'

function createSeedCompanyLogo(mark: string, background: string) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="30" fill="${background}"/><circle cx="64" cy="48" r="24" fill="#ffffff" opacity=".92"/><path d="M32 92c8-18 20-27 32-27s24 9 32 27" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round"/><text x="64" y="116" fill="#ffffff" font-family="Arial,sans-serif" font-size="18" font-weight="700" text-anchor="middle">${mark}</text></svg>`,
  )}`
}

const demoUsers = [
  {
    email: 'alex@northstarfoods.ca',
    displayName: 'Alex Morgan',
    role: 'owner',
    password: environment.DEMO_USER_PASSWORD ?? '',
  },
  {
    email: 'ava@northstarfoods.ca',
    displayName: 'Ava Lin',
    role: 'member',
    password: '',
  },
  {
    email: 'morgan@greenlinehvac.ca',
    displayName: 'Morgan Chen',
    role: 'member',
    password: '',
  },
  {
    email: 'jordan@fieldnoteai.ca',
    displayName: 'Jordan Smith',
    role: 'member',
    password: '',
  },
] as const

const demoCompanies = [
  {
    name: 'Northstar Foods',
    ownerEmail: 'ava@northstarfoods.ca',
    founderName: 'Ava Lin',
    businessSummary: 'Wholesale and direct-to-consumer functional snack boxes for busy families.',
    industry: 'Food manufacturing',
    location: 'Toronto, Ontario',
    stage: 'Growth',
    revenueModel: 'Wholesale accounts, retail pilots, and recurring subscriptions',
    teamBackground: 'Ava Lin leads a 4-person food manufacturing team in Toronto, Ontario.',
    traction: 'Annualized revenue of $216,000 with a 58% gross margin.',
    useOfFunds: 'Equipment, inventory, hiring, and retail market expansion.',
    annualRevenue: 216000,
    monthlyRevenue: 18000,
    employeeCount: 4,
    website: 'https://northstarfoods.example',
    metadata: {
      logo: createSeedCompanyLogo('NF', '#1b6c63'),
      corporationDate: '2019-06',
      legalStructure: 'Corporation',
      sector: 'Secondary',
      productsOrServices:
        'Functional snack boxes and wholesale snack packs. Average order value is CAD 42 with an estimated gross margin of 58%.',
      busyPeriods: ['november', 'december'],
      slowPeriods: ['january', 'february'],
      mission: 'Make better everyday nutrition accessible to busy families.',
      vision: 'Build the most trusted locally sourced snack brand in Canada.',
      values: 'Practicality, transparency, customer care, and responsible growth.',
      email: 'ava@northstarfoods.ca',
      emailVerified: true,
      phone: '+1 416 555 0184',
      fundingUsage: ['inventory', 'advertising', 'payroll'],
      teamMembers: [
        {
          id: 'northstar-ava-lin',
          name: 'Ava Lin',
          title: 'Founder and CEO',
          responsibilities: 'Leads strategy, partnerships, and operating decisions.',
        },
      ],
      fundingTarget: '250,000',
      readiness: 84,
      status: 'Active',
      updatedAt: 'Updated 2 hours ago',
    },
  },
  {
    name: 'Greenline HVAC',
    ownerEmail: 'morgan@greenlinehvac.ca',
    founderName: 'Morgan Chen',
    businessSummary: 'A regional HVAC installer expanding energy-efficient heat-pump services.',
    industry: 'Construction',
    location: 'Ottawa, Ontario',
    stage: 'Growth',
    revenueModel: 'Installation projects, maintenance contracts, and commercial retrofits',
    teamBackground: 'Morgan Chen leads a field service team focused on reliable customer delivery.',
    traction: 'Growing commercial retrofit pipeline and repeat maintenance demand.',
    useOfFunds: 'Fleet modernization, equipment, hiring, and digital adoption.',
    annualRevenue: 480000,
    monthlyRevenue: 40000,
    employeeCount: 9,
    website: 'https://greenlinehvac.example',
    metadata: {
      logo: createSeedCompanyLogo('GH', '#286a8d'),
      corporationDate: '2017-03',
      legalStructure: 'Corporation',
      sector: 'Secondary',
      productsOrServices:
        'Heat-pump installation, retrofit planning, and maintenance services. Typical projects range from CAD 18,000 to CAD 75,000 with a 32% gross margin.',
      busyPeriods: ['march', 'april', 'may', 'june'],
      slowPeriods: ['december', 'january'],
      mission: 'Help commercial buildings lower energy costs through practical electrification.',
      vision: 'Make efficient building systems the default across small and mid-sized properties.',
      values: 'Reliability, measurable impact, safety, and long-term partnerships.',
      email: 'morgan@greenlinehvac.ca',
      emailVerified: true,
      phone: '+1 905 555 0142',
      fundingUsage: ['equipment', 'hiring', 'advertising'],
      teamMembers: [
        {
          id: 'greenline-morgan-chen',
          name: 'Morgan Chen',
          title: 'Managing Director',
          responsibilities: 'Owns delivery quality, sales operations, and strategic accounts.',
        },
      ],
      fundingTarget: '500,000',
      readiness: 72,
      status: 'Needs review',
      updatedAt: 'Updated yesterday',
    },
  },
  {
    name: 'Fieldnote AI',
    ownerEmail: 'jordan@fieldnoteai.ca',
    founderName: 'Jordan Smith',
    businessSummary: 'Workflow software that helps field teams capture and organize operational knowledge.',
    industry: 'Software and technology',
    location: 'Vancouver, British Columbia',
    stage: 'Launch',
    revenueModel: 'Subscription software for small and mid-sized field service teams',
    teamBackground: 'Jordan Smith leads product development and early customer discovery.',
    traction: 'Pilot users are validating the workflow and reporting requirements.',
    useOfFunds: 'Product development, hiring, customer acquisition, and infrastructure.',
    annualRevenue: 96000,
    monthlyRevenue: 8000,
    employeeCount: 3,
    website: 'https://fieldnoteai.example',
    metadata: {
      logo: createSeedCompanyLogo('FA', '#654aa5'),
      corporationDate: '2024-09',
      legalStructure: 'Corporation',
      sector: 'Quaternary',
      productsOrServices:
        'Subscription software for field reporting, priced per active seat with implementation support and usage-based expansion.',
      busyPeriods: ['all-year'],
      slowPeriods: ['december'],
      mission: 'Turn field observations into clear, actionable project intelligence.',
      vision: 'Help every infrastructure team make faster decisions from better field data.',
      values: 'Clarity, useful automation, trust, and customer-led learning.',
      email: 'jordan@fieldnote.ai',
      emailVerified: false,
      phone: '+1 519 555 0168',
      fundingUsage: ['hiring', 'advertising', 'payroll'],
      teamMembers: [
        {
          id: 'fieldnote-jordan-smith',
          name: 'Jordan Smith',
          title: 'Co-founder and CEO',
          responsibilities: 'Leads customer discovery, product direction, and commercial partnerships.',
        },
        {
          id: 'fieldnote-priya-nair',
          name: 'Priya Nair',
          title: 'Co-founder and CTO',
          responsibilities: 'Owns platform architecture, AI quality, and secure product delivery.',
        },
      ],
      fundingTarget: '150,000',
      readiness: 46,
      status: 'Draft',
      updatedAt: 'Updated Jul 22',
    },
  },
] as const

const demoPrograms = [
  {
    name: 'FedDev Ontario Growth Program',
    provider: 'Federal Economic Development Agency',
    category: 'Grant',
    programUrl: 'https://feddev-ontario.canada.ca/en/funding',
    fundingAmount: 250000,
    location: 'Ontario',
    country: 'Canada',
    description: 'Growth funding for Ontario businesses investing in productivity, expansion, and commercialization.',
    deadline: 'Aug 31, 2026',
    eligibility: 'Established Ontario businesses with a credible growth plan and measurable economic impact.',
    eligibleUses: 'Equipment, hiring, productivity improvements, market development, and commercialization.',
    process: 'Review eligibility, prepare the growth plan and budget, contact FedDev Ontario, then submit the application package.',
    sourceRecordId: 'demo-feddev-ontario-growth',
  },
  {
    name: 'Canada Digital Adoption Program',
    provider: 'Government of Canada',
    category: 'Grant',
    programUrl: 'https://ised-isde.canada.ca/site/canada-digital-adoption-program/en',
    fundingAmount: 15000,
    location: 'Canada',
    country: 'Canada',
    description: 'Support for small businesses adopting digital tools and improving their online operations.',
    deadline: 'Rolling intake',
    eligibility: 'Canadian small businesses with a practical digital adoption need and an eligible implementation plan.',
    eligibleUses: 'Digital tools, ecommerce, software implementation, consulting, and online marketing.',
    process: 'Confirm the intake stream, document the digital need, collect vendor estimates, and submit the online application.',
    sourceRecordId: 'demo-canada-digital-adoption',
  },
  {
    name: 'BDC Small Business Loan',
    provider: 'Business Development Bank of Canada',
    category: 'Loan',
    programUrl: 'https://www.bdc.ca/en/financing/small-business-loan',
    fundingAmount: 100000,
    location: 'Canada',
    country: 'Canada',
    description: 'Flexible working capital financing for Canadian small businesses with an operating plan.',
    deadline: 'Open',
    eligibility: 'Canadian businesses able to demonstrate repayment capacity and a defined use of funds.',
    eligibleUses: 'Working capital, equipment, inventory, hiring, and business expansion.',
    process: 'Start with a conversation with BDC, prepare financial statements and a cash flow forecast, then complete underwriting.',
    sourceRecordId: 'demo-bdc-small-business-loan',
  },
  {
    name: 'Ontario Business Expansion Fund',
    provider: 'Government of Ontario',
    category: 'Grant',
    programUrl: 'https://www.ontario.ca/page/business-and-economy',
    fundingAmount: 100000,
    location: 'Ontario',
    country: 'Canada',
    description: 'Support for Ontario businesses entering new markets, adding capacity, or creating jobs.',
    deadline: 'Sep 18, 2026',
    eligibility: 'Ontario businesses with a viable expansion project, budget, and measurable outcomes.',
    eligibleUses: 'Market expansion, equipment, staffing, marketing, and implementation costs.',
    process: 'Review the program guide, speak with the program contact, prepare the project budget, and submit before the deadline.',
    sourceRecordId: 'demo-ontario-business-expansion',
  },
  {
    name: 'Clean Technology Adoption Fund',
    provider: 'Government of Canada',
    category: 'Grant',
    programUrl: 'https://ised-isde.canada.ca/site/strategic-innovation-fund/en/clean-technology-adoption',
    fundingAmount: 120000,
    location: 'Canada',
    country: 'Canada',
    description: 'Funding support for businesses adopting clean technology and reducing operating emissions.',
    deadline: 'Nov 15, 2026',
    eligibility: 'Canadian businesses with an eligible clean technology investment and measurable environmental outcomes.',
    eligibleUses: 'Clean equipment, energy efficiency projects, fleet modernization, and implementation support.',
    process: 'Confirm technology eligibility, document the baseline and expected impact, then submit the project application.',
    sourceRecordId: 'demo-clean-technology-adoption',
  },
  {
    name: 'Ontario Market Expansion Grant',
    provider: 'Government of Ontario',
    category: 'Grant',
    programUrl: 'https://www.ontario.ca/page/business-and-economy',
    fundingAmount: 85000,
    location: 'Ontario',
    country: 'Canada',
    description: 'Support for Ontario businesses building sales channels and reaching new customer segments.',
    deadline: 'Oct 30, 2026',
    eligibility: 'Ontario businesses with a documented market opportunity, sales plan, and implementation milestones.',
    eligibleUses: 'Marketing, sales enablement, customer research, channel development, and market entry.',
    process: 'Define the target market, prepare the sales and marketing milestones, and submit the application with supporting evidence.',
    sourceRecordId: 'demo-ontario-market-expansion',
  },
] as const

const demoApplications = [
  {
    sourceId: 'seed-demo-application-2',
    title: 'Growth project application',
    programName: 'FedDev Ontario Growth Program',
    companyName: 'Northstar Foods',
    ownerEmail: 'ava@northstarfoods.ca',
    amount: 250000,
    status: 'In Review',
    progress: 72,
    deadline: 'Aug 31, 2026',
    deadlineOrder: 34,
    documentsComplete: 6,
    documentsTotal: 8,
    nextAction: 'Review eligible project costs',
    note: 'Finance team is validating equipment quotes and matching funds.',
  },
  {
    sourceId: 'seed-demo-application-3',
    title: 'Digital adoption plan',
    programName: 'Canada Digital Adoption Program',
    companyName: 'Greenline HVAC',
    ownerEmail: 'morgan@greenlinehvac.ca',
    amount: 15000,
    status: 'Ready',
    progress: 94,
    deadline: 'Rolling intake',
    deadlineOrder: 999,
    documentsComplete: 7,
    documentsTotal: 7,
    nextAction: 'Final applicant sign-off',
    note: 'Digital plan and vendor estimates are complete.',
  },
  {
    sourceId: 'seed-demo-application-4',
    title: 'Working capital financing',
    programName: 'BDC Small Business Loan',
    companyName: 'Fieldnote AI',
    ownerEmail: 'jordan@fieldnoteai.ca',
    amount: 100000,
    status: 'Draft',
    progress: 38,
    deadline: 'Open',
    deadlineOrder: 999,
    documentsComplete: 3,
    documentsTotal: 8,
    nextAction: 'Upload year-to-date financials',
    note: '',
  },
  {
    sourceId: 'seed-demo-application-5',
    title: 'Ontario expansion proposal',
    programName: 'Ontario Business Expansion Fund',
    companyName: 'Northstar Foods',
    ownerEmail: 'ava@northstarfoods.ca',
    amount: 100000,
    status: 'Submitted',
    progress: 100,
    deadline: 'Sep 18, 2026',
    deadlineOrder: 52,
    documentsComplete: 9,
    documentsTotal: 9,
    nextAction: 'Monitor reviewer communications',
    note: 'Confirmation number ON-BEF-20481.',
  },
  {
    sourceId: 'seed-demo-application-6',
    title: 'Heat-pump fleet modernization',
    programName: 'Clean Technology Adoption Fund',
    companyName: 'Greenline HVAC',
    ownerEmail: 'morgan@greenlinehvac.ca',
    amount: 120000,
    status: 'Awarded',
    progress: 100,
    deadline: 'Nov 15, 2026',
    deadlineOrder: 110,
    documentsComplete: 8,
    documentsTotal: 8,
    nextAction: 'Complete contribution agreement',
    note: 'Approved for $96,000 subject to contribution agreement.',
  },
  {
    sourceId: 'seed-demo-application-7',
    title: 'Retail market expansion',
    programName: 'Ontario Market Expansion Grant',
    companyName: 'Northstar Foods',
    ownerEmail: 'ava@northstarfoods.ca',
    amount: 85000,
    status: 'Draft',
    progress: 24,
    deadline: 'Oct 30, 2026',
    deadlineOrder: 94,
    documentsComplete: 2,
    documentsTotal: 8,
    nextAction: 'Draft market expansion milestones',
    note: '',
  },
] as const

export async function seedDatabase(
  database = databasePool,
  catalogDatabase = database,
) {
  const client = await database.connect()
  const catalogClient = catalogDatabase === database
    ? client
    : await catalogDatabase.connect()
  try {
    await client.query('BEGIN')
    if (catalogClient !== client) await catalogClient.query('BEGIN')
    const userIds = new Map<string, string>()
    for (const user of demoUsers) {
      const userResult = await client.query<{ id: string }>(
        `
          INSERT INTO app_users (email, display_name, role, password_hash)
          VALUES (
            $1,
            $2,
            $3,
            CASE
              WHEN NULLIF($4, '') IS NULL THEN NULL
              ELSE crypt($4, gen_salt('bf'))
            END
          )
          ON CONFLICT (email) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            role = EXCLUDED.role,
            password_hash = COALESCE(EXCLUDED.password_hash, app_users.password_hash)
          RETURNING id
        `,
        [user.email, user.displayName, user.role, user.password],
      )
      const userId = userResult.rows[0]?.id
      if (!userId) throw new Error(`Could not seed demo user ${user.email}.`)
      userIds.set(user.email, userId)
    }
    const userId = userIds.get('alex@northstarfoods.ca') ?? environment.DEMO_USER_ID
    await client.query(
      `
        SELECT setval(
          pg_get_serial_sequence('app_users', 'id'),
          GREATEST((SELECT COALESCE(MAX(id), 1) FROM app_users), 1),
          true
        )
      `,
    )
    await client.query(
      `
        INSERT INTO workspaces (id, name, slug, kind, created_by)
        VALUES ($1, 'Community workspace', 'community-workspace', 'founder', $2)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          kind = EXCLUDED.kind
      `,
      [environment.DEMO_WORKSPACE_ID, userId],
    )
    await client.query(
      `
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
      `,
      [environment.DEMO_WORKSPACE_ID, userId],
    )
    for (const [email, memberId] of userIds) {
      await client.query(
        `
          INSERT INTO workspace_members (workspace_id, user_id, role)
          VALUES ($1, $2, $3)
          ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
        `,
        [
          environment.DEMO_WORKSPACE_ID,
          memberId,
          email === 'alex@northstarfoods.ca' ? 'owner' : 'member',
        ],
      )
    }

    const companyIds = new Map<string, string>()
    for (const company of demoCompanies) {
      const ownerId = userIds.get(company.ownerEmail)
      if (!ownerId) throw new Error(`Could not find demo owner ${company.ownerEmail}.`)
      const companyResult = await client.query<{ id: string }>(
        `
          INSERT INTO companies (
            workspace_id,
            owner_user_id,
            created_by,
            updated_by,
            name,
            legal_name,
            founder_name,
            business_summary,
            industry,
            location,
            stage,
            revenue_model,
            team_background,
            traction,
            use_of_funds,
            annual_revenue,
            monthly_revenue,
            employee_count,
            website,
            metadata
          )
          VALUES ($1, $2, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb)
          ON CONFLICT (workspace_id, name) DO UPDATE SET
            owner_user_id = EXCLUDED.owner_user_id,
            updated_by = EXCLUDED.updated_by,
            legal_name = EXCLUDED.legal_name,
            founder_name = EXCLUDED.founder_name,
            business_summary = EXCLUDED.business_summary,
            industry = EXCLUDED.industry,
            location = EXCLUDED.location,
            stage = EXCLUDED.stage,
            revenue_model = EXCLUDED.revenue_model,
            team_background = EXCLUDED.team_background,
            traction = EXCLUDED.traction,
            use_of_funds = EXCLUDED.use_of_funds,
            annual_revenue = EXCLUDED.annual_revenue,
            monthly_revenue = EXCLUDED.monthly_revenue,
            employee_count = EXCLUDED.employee_count,
            website = EXCLUDED.website,
            metadata = EXCLUDED.metadata,
            updated_at = now()
          RETURNING id::text
        `,
        [
          environment.DEMO_WORKSPACE_ID,
          ownerId,
          company.name,
          `${company.name} Ltd.`,
          company.founderName,
          company.businessSummary,
          company.industry,
          company.location,
          company.stage,
          company.revenueModel,
          company.teamBackground,
          company.traction,
          company.useOfFunds,
          company.annualRevenue,
          company.monthlyRevenue,
          company.employeeCount,
          company.website,
          JSON.stringify(company.metadata),
        ],
      )
      const companyId = companyResult.rows[0]?.id
      if (!companyId) throw new Error(`Could not seed demo company ${company.name}.`)
      companyIds.set(company.name, companyId)
    }

    const programIds = new Map<string, string>()
    for (const program of demoPrograms) {
      const existingProgram = await catalogClient.query<{ id: string }>(
        `
          SELECT id::text
          FROM funding_programs
          WHERE workspace_id IS NULL
            AND source_id = $1
            AND name = $2
          LIMIT 1
        `,
        ['seed-demo-catalog', program.name],
      )
      let programId = existingProgram.rows[0]?.id
      if (!programId) {
        const programResult = await catalogClient.query<{ id: string }>(
          `
            INSERT INTO funding_programs (
              workspace_id,
              name,
              provider,
              category,
              program_url,
              funding_amount,
              currency,
              location,
              country,
              description,
              process,
              deadline,
              eligibility,
              eligible_uses,
              target_company_types,
              required_evidence,
              match_score,
              source_type,
              source_id,
              source_record_id,
              source_version,
              record_version,
              status,
              created_by,
              updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'CAD', $7, $8, $9, $10, $11, $12, $13, $14, $15, 80, 'builtin', 'seed-demo-catalog', $16, 'seed-v1', $16, 'active', $17, $17)
            RETURNING id::text
          `,
          [
            null,
            program.name,
            program.provider,
            program.category,
            program.programUrl,
            program.fundingAmount,
            program.location,
            program.country,
            program.description,
            program.process,
            program.deadline,
            program.eligibility,
            program.eligibleUses,
            'Small and medium-sized businesses with a clear operating plan and measurable next steps.',
            'Business profile, ownership details, financial information, project budget, and measurable milestones.',
            program.sourceRecordId,
            userId,
          ],
        )
        programId = programResult.rows[0]?.id
      }
      if (!programId) throw new Error(`Could not seed demo program ${program.name}.`)
      programIds.set(program.name, programId)
    }

    for (const application of demoApplications) {
      const companyId = companyIds.get(application.companyName)
      const programId = programIds.get(application.programName)
      const ownerId = userIds.get(application.ownerEmail)
      if (!companyId || !programId || !ownerId) {
        throw new Error(`Could not resolve demo application ${application.title}.`)
      }
      await client.query(
        `
          INSERT INTO applications (
            workspace_id,
            funding_program_id,
            company_id,
            owner_user_id,
            source_id,
            title,
            amount,
            status,
            progress,
            deadline,
            deadline_order,
            documents_complete,
            documents_total,
            next_action,
            note
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (workspace_id, source_id) DO NOTHING
        `,
        [
          environment.DEMO_WORKSPACE_ID,
          programId,
          companyId,
          ownerId,
          application.sourceId,
          application.title,
          application.amount,
          application.status,
          application.progress,
          application.deadline,
          application.deadlineOrder,
          application.documentsComplete,
          application.documentsTotal,
          application.nextAction,
          application.note,
        ],
      )
    }
    if (catalogClient !== client) await catalogClient.query('COMMIT')
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    if (catalogClient !== client) await catalogClient.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    if (catalogClient !== client) catalogClient.release()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(async () => {
      await databasePool.end()
    })
    .catch(async (error: unknown) => {
      process.stderr.write(
        `Database seed failed: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      )
      await databasePool.end()
      process.exitCode = 1
    })
}
