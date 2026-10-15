# 🌐 Antigravity Capabilities & Architecture Guide

> **Complete Catalog of Subagents, Skills, MCP Servers, and Lifecycle Hooks**  
> Verified against active IDE configuration, plugins, and repository workspaces.

---

## 📑 Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Autonomous Subagents (17 Total)](#2-autonomous-subagents-17-total)
   - [System Architecture & Code Discovery](#system-architecture--code-discovery)
   - [Testing, Quality & Error Prevention](#testing-quality--error-prevention)
   - [Frontend, React & Modern Web](#frontend-react--modern-web)
   - [Security & Database Specialists](#security--database-specialists)
   - [Runtime Browser Automation](#runtime-browser-automation)
3. [Domain Skills (230 Total)](#3-domain-skills-230-total)
   - [Core Software Engineering & Testing](#core-software-engineering--testing)
   - [UI Design Systems, Themes & Aesthetics](#ui-design-systems-themes--aesthetics)
   - [Frontend Frameworks, Next.js & Performance](#frontend-frameworks-nextjs--performance)
   - [Cloud Data, BigQuery & Pipeline Orchestration](#cloud-data-bigquery--pipeline-orchestration)
   - [Biomedical, Chemistry & Scientific Databases](#biomedical-chemistry--scientific-databases)
   - [Document Generators & Media Processors](#document-generators--media-processors)
   - [Specialized Integrations & Utilities](#specialized-integrations--utilities)
4. [Model Context Protocol (MCP) Servers (15 Total)](#4-model-context-protocol-mcp-servers-15-total)
5. [Lifecycle & Event Hooks (2 Suites)](#5-lifecycle--event-hooks-2-suites)
6. [Workflow Playbook: How to Dispatch Capabilities](#6-workflow-playbook-how-to-dispatch-capabilities)

---

## 1. Executive Summary

The Antigravity development environment combines four complementary extension primitives to enable autonomous and multi-agent software engineering:

| Extension Type | Count | Core Responsibility | Configuration File / Directory |
|---|---|---|---|
| **Subagents** | **17** | Independent autonomous workers with dedicated system prompts, specialized tools, and narrow scopes. | `~/.gemini/config/agents/` |
| **Skills** | **230** | Dynamic on-demand playbooks containing domain instructions, templates, and architectural rules. | `skills/` across workspace, plugins, and builtins |
| **MCP Servers** | **15** | Live Model Context Protocol connections to external databases, design APIs, cloud runners, and registries. | `~/.gemini/config/mcp_config.json` |
| **Hooks** | **2 Suites** | Deterministic lifecycle triggers executed on `PreInvocation` or `PreToolUse` for state sync and telemetry. | `~/.gemini/config/hooks.json` |

---

## 2. Autonomous Subagents (17 Total)

Subagents operate with dedicated personas and isolated context windows. They can be triggered explicitly by the user or dynamically dispatched by the orchestrator.

### System Architecture & Code Discovery

#### 🔹 `capability-orchestrator`
**Role**: Dynamically discovers, evaluates, composes, and dispatches the smallest effective combination of skills, plugins, MCP servers, tools, external connections, specialized sub-agents, and framework capabilities for each task. Resolves genuine capability conflicts, preserves complementary capabilities, minimizes context usage, and routes execution to the appropriate downstream agents.

**Key Competencies & Rules**:
- Skills (Global & Project-Local)
- MCP servers

#### 🔹 `code-architect`
**Role**: Principal software architecture specialist for system design, scalable implementation planning, trade-off analysis, and anti-pattern prevention. Use when planning new features, refactoring systems, or evaluating architectural trade-offs before implementation.

**Key Competencies & Rules**:
- 🚩 **Big Ball of Mud**: State or business logic scattered across unrelated components without clear module boundaries.
- 🚩 **God Object / God Component**: A single module, component, or class handling fetching, validation, state, rendering, and persistence.

#### 🔹 `code-explorer`
**Role**: Deeply analyzes an existing codebase by tracing execution paths, architecture layers, dependencies, integrations, patterns, and abstractions before development. Use before any implementation task to build shared context.

**Key Competencies & Rules**:
- Project directory structure and module boundaries
- Entry points and execution paths

#### 🔹 `code-simplifier`
**Role**: Simplifies and refines code for clarity, consistency, and maintainability while strictly preserving behavior. Use after implementing features to eliminate dead code, unused imports, over-abstracted single-use helpers, and complex conditionals.

**Key Competencies & Rules**:


### Testing, Quality & Error Prevention

#### 🔹 `code-reviewer`
**Role**: Reviews implementation changes for correctness, bugs, security vulnerabilities, regressions, maintainability, project conventions, and integration problems before code is considered complete.

**Key Competencies & Rules**:
- Logic errors and edge cases
- Broken execution paths and unhandled error states

#### 🔹 `silent-failure-hunter`
**Role**: Hunts silent failures, swallowed errors, bad fallbacks, and missing error propagation in code. Use PROACTIVELY after writing error handling, async code, API integrations, or database operations. Specialized pass that typescript-reviewer and react-reviewer do NOT fully cover — finds code that appears to work but silently loses errors.

**Key Competencies & Rules**:
- Intentional fallbacks with clear documentation and downstream handling
- Error boundaries in React (intentional catch-and-render pattern)

#### 🔹 `tdd-guide`
**Role**: Test-Driven Development specialist enforcing write-tests-first methodology. Use PROACTIVELY when writing new features, fixing bugs, or refactoring code. Ensures 80%+ test coverage via Red-Green-Refactor cycle. Does NOT overlap with react-reviewer or typescript-reviewer — those review existing code, this guides writing tests before implementation.

**Key Competencies & Rules**:

#### 🔹 `e2e-runner`
**Role**: End-to-end testing specialist using browser automation with Playwright. Use PROACTIVELY for generating, maintaining, and running E2E tests on critical user flows. Manages test journeys, quarantines flaky tests, captures screenshots and videos, and ensures critical user flows work end-to-end. Does NOT overlap with tdd-guide (unit/integration) — this is browser-level flow testing only.

**Key Competencies & Rules**:


### Frontend, React & Modern Web

#### 🔹 `react-reviewer`
**Role**: Expert React/JSX code reviewer specializing in hook correctness, render performance, server/client component boundaries, accessibility, and React-specific security. Use for any change touching .tsx/.jsx files or React component logic. MUST BE USED for React projects. Invoke alongside typescript-reviewer on all .tsx/.jsx PRs.

**Key Competencies & Rules**:
- PR review: use the actual base branch via `gh pr view --json baseRefName` when available; otherwise the current branch's upstream/merge-base. Never hard-code `main`.

#### 🔹 `react-build-resolver`
**Role**: Diagnose and fix React build failures across Vite, webpack, Next.js, CRA, Parcel, esbuild, and Bun. Handles JSX/TSX compile errors, hydration mismatches, server/client component boundary failures, missing types, and bundler-specific configuration issues with minimal, surgical changes. MUST BE USED when a React build fails.

**Key Competencies & Rules**:

#### 🔹 `typescript-reviewer`
**Role**: Expert TypeScript/JavaScript code reviewer specializing in type safety, async correctness, Node/web security, and idiomatic patterns. Use for all TypeScript and JavaScript code changes. MUST BE USED for TypeScript/JavaScript projects. For .tsx/.jsx files invoke alongside react-reviewer.

**Key Competencies & Rules**:
- For PR review, use the actual PR base branch when available (e.g., `gh pr view --json baseRefName`) or the current branch's upstream/merge-base. Do not hard-code `main`.

#### 🔹 `performance-optimizer`
**Role**: Performance analysis and optimization specialist. Use PROACTIVELY for identifying bottlenecks, optimizing slow code, reducing bundle sizes, and improving runtime performance. Handles profiling, memory leaks, React render optimization, code splitting, and algorithmic improvements.

**Key Competencies & Rules**:

#### 🔹 `a11y-architect`
**Role**: Accessibility Architect specializing in WCAG 2.2 compliance for Web and Native platforms. Use PROACTIVELY when designing UI components, establishing design systems, or auditing code for inclusive user experiences. Provides ARIA specs, focus flow, keyboard nav, and touch target requirements.

**Key Competencies & Rules**:

#### 🔹 `seo-specialist`
**Role**: SEO specialist for technical SEO audits, on-page optimization, structured data, Core Web Vitals, and content/keyword mapping. Use for site audits, meta tag reviews, schema markup, sitemap and robots issues, and SEO remediation plans.

**Key Competencies & Rules**:
- read_url_content


### Security & Database Specialists

#### 🔹 `security-reviewer`
**Role**: Security vulnerability detection and remediation specialist. Use PROACTIVELY after writing code that handles user input, authentication, API endpoints, file uploads, payments, or sensitive data. Flags hardcoded secrets, SSRF, injection, broken auth, unsafe crypto, and OWASP Top 10 vulnerabilities. Does NOT overlap with react-reviewer or typescript-reviewer — this is a dedicated security-only pass.

**Key Competencies & Rules**:
- Environment variables in `.env.example` (not actual secrets)

#### 🔹 `database-reviewer`
**Role**: Relational database & SQL specialist for PostgreSQL, Supabase, Prisma, and ORM schemas. Reviews query performance, schema design, foreign key indexing, migrations, connection pooling, and detects N+1 queries.

**Key Competencies & Rules**:
- Foreign Key Indexing**: Are all foreign key columns indexed? (Unindexed FKs cause full table scans during joins and cascade deletes).


### Runtime Browser Automation
#### 🔹 `browser_subagent`
**Role**: Autonomous interactive browser agent with dedicated tools to launch headless or headed browser sessions, navigate URLs, click interactive elements, type input, inspect live DOM state, resize viewports, and automatically record sessions as WebP animations in the artifact store.

**Key Competencies & Rules**:
- Live UI end-to-end verification and regression testing.
- Automated WebP interaction recording for audit proof.
- Real-time DOM inspection and interactive workflow execution.
- Automatically pauses and blocks until tasks finish or fail.

---

## 3. Domain Skills (230 Total)

Skills are on-demand domain playbooks consisting of instructions, templates, reference scripts, and architectural rules loaded dynamically when matching workflows are encountered.

### Core Software Engineering & Testing (21 Skills)

| Skill Name | Source | Description / When to Use |
|---|---|---|
| **`accidental-data-loss-prevention`** | Workspace | **STOP AND VERIFY**: Before running any command or tool that results in irreversible data loss, you MUST obtain explicit user consent. When in doubt, ask. It... |
| **`author-auth0-skill`** | Workspace | Use when adding or editing Auth0 guidance in this repo's single auth0 skill — a new framework, feature, tooling, or pattern reference — to get the file struc... |
| **`executing-plans`** | Workspace | Use when you have a written implementation plan to execute in a separate session with review checkpoints |
| **`finishing-a-development-branch`** | Workspace | Use when implementation is complete, all tests pass, and you need to decide how to integrate the work |
| **`full-output-enforcement`** | Workspace | Overrides default LLM truncation behavior. Enforces complete code generation, bans placeholder patterns, and handles token-limit splits cleanly. Apply to any... |
| **`gcp-managed-airflow-dag-authoring`** | Workspace | Guides the authoring and validation of Apache Airflow DAGs for Managed Service for Apache Airflow (MSAA; formerly Cloud Composer). Covers environment context... |
| **`managing-python-dependencies`** | Workspace | Ensures proper Python dependency management, avoiding global `pip install` and adhering to project-specific tooling.  Use this skill if any of the following ... |
| **`permissioned-github`** | Builtin | Guidelines for interacting with GitHub and request permissions from the user when commands fail due to restrictions in the agent environment. |
| **`receiving-code-review`** | Workspace | Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technic... |
| **`requesting-code-review`** | Workspace | Use when completing tasks, implementing major features, or before merging to verify work meets requirements |
| **`scienceskillscommon`** | Config / Plugin | Shared Python package for Science Skills, currently containing http_client -- a unified HTTP client with rate limiting, retries, and exponential backoff. Not... |
| **`skill-creator`** | Workspace | Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize a... |
| **`skill-repair`** | Workspace | Use this to fix and re-install agent skills that have failed installation. This skill provides the necessary context and permissions to surgically update the... |
| **`systematic-debugging`** | Workspace | Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes |
| **`test-driven-development`** | Workspace | Use when implementing any feature or bugfix, before writing implementation code |
| **`using-git-worktrees`** | Workspace | Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists vi... |
| **`using-superpowers`** | Workspace | Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions |
| **`webapp-testing`** | Workspace | Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing... |
| **`workflow-skill-creator`** | Config / Plugin | Distills a completed user workflow or interaction into a reusable agent skill. Use when the user asks to turn their workflow, interaction, or multi-step proc... |
| **`writing-plans`** | Workspace | Use when you have a spec or requirements for a multi-step task, before touching code |
| **`writing-skills`** | Workspace | Use when creating new skills, editing existing skills, or verifying skills work before deployment |

### UI Design Systems, Themes & Aesthetics (48 Skills)

| Skill Name | Source | Description / When to Use |
|---|---|---|
| **`algorithmic-art`** | Workspace | Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, gener... |
| **`artistic`** | Workspace | High-contrast, expressive style with creative typography and bold color choices for visually striking interfaces. |
| **`bento`** | Workspace | Modular grid layout with card-like blocks, clear hierarchy, soft spacing, and subtle visual contrast for organized, scannable interfaces. |
| **`bold`** | Workspace | Strong visual presence with heavyweight typography, high-contrast colors, and commanding layouts. |
| **`brandkit`** | Workspace | Premium brand-kit image generation skill for creating high-end brand-guidelines boards, logo systems, identity decks, and visual-world presentations. Trained... |
| **`brutalism`** | Workspace | Raw, anti-design aesthetic inspired by concrete architecture with unadorned elements, jarring layouts, and functional minimalism. |
| **`cafe`** | Workspace | Cozy cafe-inspired interface with warm tones, soft typography, and clean layouts for a relaxed browsing experience. |
| **`canvas-design`** | Workspace | Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art... |
| **`claymorphism`** | Workspace | Soft, rounded 3D-like shapes mimicking malleable clay with playful, puffy elements and colorful surfaces. |
| **`clean`** | Workspace | Simplicity-focused design with ample whitespace, legible typography, and a limited color palette to reduce visual clutter. |
| **`colorful`** | Workspace | Vibrant, high-contrast palettes and gradients for engaging, memorable, and modern user experiences. |
| **`corporate`** | Workspace | Professional, brand-aligned design with structured grids, minimalist layouts, and consistent enterprise patterns. |
| **`data-autocleaning`** | Workspace | Automated data quality and transformation capabilities for Dataform/dbt/BigQuery pipelines. Processes data sourced from BigQuery or Cloud Storage (GCS), appl... |
| **`design-taste-frontend`** | Workspace | Anti-slop frontend skill for landing pages, portfolios, and redesigns. The agent reads the brief, infers the right design direction, and ships interfaces tha... |
| **`doodle`** | Workspace | Hand-drawn, sketch-like style with doodles, handwritten fonts, and imperfect lines for a playful, informal feel. |
| **`editorial`** | Workspace | Magazine-inspired editorial layout with refined serif typography, structured grids, and elegant reading experiences. |
| **`figma-design-to-code`** | Workspace | **MANDATORY prerequisite** — you MUST invoke this skill BEFORE calling the `get_design_context` Figma MCP tool. You MUST trigger this skill whenever the user... |
| **`frontend-design`** | Workspace | Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making... |
| **`glassmorphism`** | Workspace | Frosted glass effect with translucent layers, subtle blur, and luminous borders for depth and modern elegance. |
| **`gradient`** | Workspace | Smooth color transitions and gradient-rich surfaces for modern, playful interfaces with visual depth. |
| **`high-end-visual-design`** | Workspace | Teaches the AI to design like a high-end agency. Defines the exact fonts, spacing, shadows, card structures, and animations that make a website feel expensiv... |
| **`industrial-brutalist-ui`** | Workspace | Raw mechanical interfaces fusing Swiss typographic print with military terminal aesthetics. Rigid grids, extreme type scale contrast, utilitarian color, anal... |
| **`matrix`** | Workspace | A cyber-slick, dark-only Matrix-inspired interface defined by minimalist fashion, high-tech digital elements |
| **`minimal`** | Workspace | Stripped-back design emphasizing whitespace, clean typography, and restrained color for maximum clarity and focus. |
| **`minimalist-ui`** | Workspace | Clean editorial-style interfaces. Warm monochrome palette, typographic contrast, flat bento grids, muted pastels. No gradients, no heavy shadows. |
| **`modern`** | Workspace | Contemporary editorial style with serif typography, minimal palettes, and clean layouts for polished digital products. |
| **`mono`** | Workspace | Monospace-driven, matrix-inspired design with high-contrast elements, compact density, and a hacker-chic aesthetic. |
| **`neobrutalism`** | Workspace | Modern take on brutalism with bold borders, vivid accent colors, and raw, high-contrast layouts on warm surfaces. |
| **`neon`** | Workspace | Electric neon glow effects with high-contrast color pairings for bold, attention-grabbing interfaces. |
| **`neumorphism`** | Workspace | Soft, extruded UI elements with inner and outer shadows on monochromatic surfaces for a tactile, embedded look. |
| **`next-partial-prefetching-adoption`** | Workspace | Turn on Partial Prefetching in a Next.js app and work through the insights it surfaces. Use when the user wants to enable or adopt Partial Prefetching, flip ... |
| **`pacman`** | Workspace | Retro arcade-inspired design with pixel fonts, dotted borders, playful high-contrast colors, and 8-bit game aesthetics. |
| **`pulse`** | Workspace | Dynamic, vibrant style with thick borders, geometric shapes, high-contrast colors, and expressive typography conveying motion and vitality. |
| **`redesign-existing-projects`** | Workspace | Upgrades existing websites and apps to premium quality. Audits current design, identifies generic AI patterns, and applies high-end design standards without ... |
| **`retro`** | Workspace | Throwback design with vintage-inspired typography, high-contrast retro palettes, and nostalgic visual elements. |
| **`riso`** | Workspace | A playful, joyful, two-color risograph print aesthetic built on a single warm off-white paper surface running through every section |
| **`sega`** | Workspace | A playful, arcade-inspired interface for games — built on the VT323 pixel typeface, hard-edged 0px corners, chunky pill buttons that physically press into so... |
| **`shadcn`** | Workspace | Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composing UI, including chat interfaces. Provides project context... |
| **`sketch`** | Workspace | A friendly, hand-drawn sketch interface inspired by pencil illustrations on warm cream paper. Soft teal brand accents, hand-written display headings, rounded... |
| **`skeumorphism`** | Workspace | Real-world mimicry with textured surfaces, 3D effects, and familiar physical metaphors for intuitive digital interfaces. |
| **`sleek`** | Workspace | Modern minimalist aesthetic with clean lines, intentional color palette, subtle interactions, and consistent spacing. |
| **`stitch`** | Workspace | Clean, high-contrast enterprise design for data-driven workflows with intuitive drag-and-drop patterns and structured layouts. |
| **`terracotta`** | Workspace | A sun-baked, clay-toned editorial interface built on warm cream surfaces, ink-brown headlines set in a display serif, and a single terracotta accent. |
| **`tetris`** | Workspace | Classic block-game inspired design with playful colors, bold display fonts, and compact, high-energy layouts. |
| **`theme-factory`** | Workspace | Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc. There are 10 pre-set themes with colors... |
| **`vintage`** | Workspace | 1950s-1990s nostalgia with skeuomorphic touches, grainy textures, retro color palettes, and pixel-style typography. |
| **`web-artifacts-builder`** | Workspace | Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologies (React, Tailwind CSS, shadcn/ui). Use ... |
| **`web-design-guidelines`** | Workspace | Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my si... |

### Frontend Frameworks, Next.js & Performance (13 Skills)

| Skill Name | Source | Description / When to Use |
|---|---|---|
| **`frontend-app-builder`** | Workspace | Use for new frontend applications, dashboards, games, creative websites, hero sections, and visually driven UI from scratch, or when the user explicitly asks... |
| **`image-to-code`** | Workspace | Elite website image-to-code skill for Codex. For visually important web tasks, it must first generate the design image(s) itself, deeply analyze them, then i... |
| **`imagegen-frontend-mobile`** | Workspace | Elite mobile app image-generation skill for creating premium, app-native screen concepts and flows. Designed for iOS, Android, and cross-platform mobile prod... |
| **`imagegen-frontend-web`** | Workspace | Elite frontend image-direction skill for generating premium, conversion-aware website design references. CRITICAL OUTPUT RULE — generate ONE separate horizon... |
| **`next-cache-components-adoption`** | Workspace | Turn on Cache Components in a Next.js app and resolve the blocking routes it surfaces. Use when the user wants to enable, adopt, or migrate to Cache Componen... |
| **`next-cache-components-optimizer`** | Workspace | Drive a Next.js route to instant navigation by setting up an agentic loop, under Cache Components / PPR, on initial load (hard navigation) and client-side na... |
| **`next-dev-loop`** | Workspace | Verify Next.js runtime behavior after editing app code. Use this skill to confirm a change actually works in a running app — not just that it compiles or typ... |
| **`nextjs-framer-motion-animations`** | Workspace | Adds production-safe Motion for React or Framer Motion animations to Next.js apps, including reveal, hover and tap micro-interactions, whileInView, stagger, ... |
| **`reactome-database`** | Config / Plugin | Query the Reactome database (Analysis and Content Services). Use when the user asks about pathway analysis, gene list enrichment, retrieving results by token... |
| **`vercel-composition-patterns`** | Workspace | React composition patterns that scale. Use when refactoring components with boolean prop proliferation, building flexible component libraries, or designing r... |
| **`vercel-optimize`** | Workspace | Use for Vercel cost and performance optimization on deployed projects, especially Next.js, SvelteKit, Nuxt, and limited Astro apps. Collect Vercel metrics, u... |
| **`vercel-react-best-practices`** | Workspace | React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.j... |
| **`vercel-react-view-transitions`** | Workspace | Guide for implementing smooth, native-feeling animations using React's View Transition API (`<ViewTransition>` component, `addTransitionType`, and CSS view t... |

### Cloud Data, BigQuery & Pipeline Orchestration (22 Skills)

| Skill Name | Source | Description / When to Use |
|---|---|---|
| **`bigquery-ai-ml`** | Workspace | Leverages BigQuery's built-in machine learning and GenAI capabilities for advanced data analytics. Use when you need to write SQL queries that perform time-s... |
| **`bigquery-bigframes`** | Workspace | Generates Python code using BigQuery DataFrames (BigFrames), the pandas/scikit-learn-style API over BigQuery. Use when writing BigFrames code or doing pandas... |
| **`bigquery-data-transfer-service`** | Workspace | Discovers and inspects BigQuery Data Transfer Service (DTS) configurations. Use this to identify existing ingestion pipelines and extract datasource or trans... |
| **`bigquery-graph`** | Workspace | Provides guidelines and best practices for querying and defining property graphs and semantic graphs in BigQuery using GQL (Graph Query Language). Use when c... |
| **`bigquery-sql`** | Workspace | Provides BigQuery SQL query optimization techniques, execution best practices, and performance tuning rules for high-efficiency querying. Use when optimizing... |
| **`dataform-bigquery`** | Workspace | Expertise in generating clean, correct, and efficient Dataform pipeline code for BigQuery ELT. Use this when creating or modifying Dataform pipelines, action... |
| **`dbt-bigquery`** | Workspace | Expert guidance for creating, modifying, and optimizing dbt pipelines for BigQuery. Use this skill whenever user asks for generating or modifying a dbt model... |
| **`discovering-gcp-data-assets`** | Workspace | Finds and inspects data assets within Google Cloud. Relevant when any of the following conditions are true:   1. The user request involves finding, exploring... |
| **`federate-lakehouse-catalog`** | Workspace | Sets up Google Cloud Lakehouse federated catalogs to remote Iceberg REST Catalogs. Currently supported catalogs: Databricks Unity, AWS Glue. Supported clouds... |
| **`gcp-composer-troubleshooting`** | Workspace | Provides expert guidance for troubleshooting Cloud Composer (Apache Airflow) and Orchestration pipelines. Use this skill when the user asks to generate Root ... |
| **`gcp-data-pipelines`** | Workspace | Primary entry point for building, managing, and orchestrating data pipelines on Google Cloud. Guides users to the appropriate skill for dbt, Dataflow (Apache... |
| **`gcp-dataflow`** | Workspace | Guides writing, packaging, executing, and troubleshooting Apache Beam pipelines on Dataflow. Use when creating new pipelines, configuring Flex Templates, or ... |
| **`gcp-managed-airflow-migrations`** | Workspace | Provides guidance for migrating Apache Airflow DAGs in Managed Service for Apache Airflow (MSAA; formerly Cloud Composer). Covers migration to Airflow 2.11.1... |
| **`gcp-managed-airflow-recommendations`** | Workspace | Provides recommendations and best practices for creating, configuring, tuning and optimizing Managed Service for Apache Airflow (MSAA, Cloud Composer) enviro... |
| **`gcp-pipeline-orchestration`** | Workspace | This skill helps the agent generate or update orchestration pipeline definitions for Google Cloud Composer to initialize orchestration pipeline or update the... |
| **`gcp-pipeline-resource-provisioning`** | Workspace | Automates declarative resource creation and provisioning for data pipelines, supporting BigQuery, Dataform, Dataproc, BigQuery Data Transfer Service (DTS), a... |
| **`gcp-spark`** | Workspace | Develops and executes Spark code on Dataproc Clusters and Serverless. Reads and writes data using BigLake Iceberg catalogs, BigQuery and Spanner. Debugs exec... |
| **`gcp-spark-troubleshooting`** | Config / Plugin | Provides expert guidance for troubleshooting Google Cloud Spark and Dataproc workloads (Dataproc Serverless batches and standard Dataproc clusters), and insp... |
| **`gcs-security-assessment`** | Workspace | Assesses security posture, evaluates risks, and checks SAIF compliance for Google Cloud Storage buckets or projects. Use when the user requests security scan... |
| **`google-cloud-storage-basics`** | Workspace | Stores, retrieves, and manages data as objects in Cloud Storage (Google Cloud Storage, or GCS) buckets. Use when you need to interact with Cloud Storage — cr... |
| **`ml-best-practices`** | Workspace | CRITICAL RULE: You MUST use this skill whenever the task involves any machine learning tasks or data analysis. Use this skill if the user's prompt or require... |
| **`notebook-guidance`** | Workspace | This skill guides the use of Jupyter notebooks for data analysis, exploration, and visualization, particularly with BigQuery. It outlines best practices for ... |

### Biomedical, Chemistry & Scientific Databases (23 Skills)

| Skill Name | Source | Description / When to Use |
|---|---|---|
| **`alphafold-database-fetch-and-analyze`** | Config / Plugin | Retrieve and analyze AlphaFold predicted structures for a protein. Use when the user provides a specific UniProt Accession ID and wants structural confidence... |
| **`alphagenome-single-variant-analysis`** | Config / Plugin | Analyzes genetic variant effects on gene expression (RNA-seq), chromatin accessibility (DNASE), histone marks (ChIP), and transcription factors using the Alp... |
| **`chembl-database`** | Config / Plugin | Query the ChEMBL database for bioactive molecules, drug targets, bioactivity data, approved drugs, and chemical structures. Use when the user asks about comp... |
| **`clinical-trials-database`** | Config / Plugin | Query ClinicalTrials.gov via APIv2. Use when you want to search for trials by condition, drug, location, status, or phase; retrieve trial details by NCT ID; ... |
| **`clinvar-database`** | Config / Plugin | Use when needing clinical significance, pathogenicity classifications (e.g., Pathogenic, Benign, VUS), clinical evidence rationales, or finding "hard positiv... |
| **`dbsnp-database`** | Config / Plugin | Use when you want to look up, map, and search for short genetic variants (SNPs, indels) in NCBI's dbSNP database. Resolves between rsIDs, genomic coordinates... |
| **`ensembl-database`** | Config / Plugin | Query the Ensembl database to resolve gene, transcript, and protein IDs, fetch genomic or protein sequences, retrieve gene structures (exons), and get varian... |
| **`foldseek-structural-search`** | Config / Plugin | Performs 3D structural searches of proteins against various databases (PDB, AlphaFold, CATH, MGnify, etc.) using the Foldseek API. Use ONLY when the user pro... |
| **`gnomad-database`** | Config / Plugin | Query the Genome Aggregation Database (gnomAD). Use when determining the rarity or allele frequency of specific genetic variants, retrieving gene constraint ... |
| **`gtex-database`** | Config / Plugin | Use when you want to retrieve quantitative RNA expression data and variant eQTL information from the GTEx (Genotype-Tissue Expression) Project across 54 non-... |
| **`jaspar-database`** | Config / Plugin | Query the JASPAR database for Transcription Factor (TF) binding profiles. Use when retrieving Position Frequency Matrices (PFMs) or Position Weight Matrices ... |
| **`literature-search-arxiv`** | Config / Plugin | Search for scientific papers, preprints, and publications on arXiv. Extract metadata, abstracts, and download full-text PDFs or HTML versions of papers. Use ... |
| **`literature-search-biorxiv`** | Config / Plugin | Browse, filter, and download life sciences, biology, and medical preprints from bioRxiv and medRxiv. Supports fetching paper metadata by DOI, and browsing by... |
| **`literature-search-europepmc`** | Config / Plugin | Search Europe PMC for scientific literature and download open-access full texts and PDFs. Retrieve full-text XML/plain text by PMCID, get citation lists and ... |
| **`literature-search-openalex`** | Config / Plugin | Query the OpenAlex scholarly database for research papers, authors, institutions, topics, sources, publishers, funders, geo-locations, and keywords. Use when... |
| **`openfda-database`** | Config / Plugin | Query, search, and download data from the openFDA API for drugs, devices, foods, tobacco, cosmetics, animal and veterinary products, substances, and transpar... |
| **`pdb-database`** | Config / Plugin | Use when you want to search for or download experimentally-determined 3D structures for biomolecules (proteins, nucleic acids, bound ligands). Supports searc... |
| **`pubchem-database`** | Config / Plugin | Query PubChem, search by name/CID/SMILES, retrieve properties, similarity/substructure searches, bioactivity, for cheminformatics. Use when a user asks about... |
| **`pubmed-database`** | Config / Plugin | Search PubMed for scientific literature, including published clinical trials. Fetch abstracts and full text. Link published research to biological databases ... |
| **`pymol`** | Config / Plugin | Visualize, analyze, and render protein and molecular structures using PyMOL. Use when the user wants to create images of protein structures, perform structur... |
| **`quickgo-database`** | Config / Plugin | Query the QuickGO and Evidence & Conclusion Ontology (ECO) REST API. Use this when you need to map genes to biological processes, molecular functions, or cel... |
| **`string-database`** | Config / Plugin | Query the STRING database for protein-protein interactions (PPIs), functional enrichment, and homology. Use when the user asks about interactions between spe... |
| **`uniprot-database`** | Config / Plugin | Access protein metadata, function, taxonomy, and sequences across UniProtKB, UniParc, and UniRef. Use when searching for proteins, mapping identifiers, or re... |

### Document Generators & Media Processors (4 Skills)

| Skill Name | Source | Description / When to Use |
|---|---|---|
| **`docx`** | Workspace | Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files) or Word templates (.dotx files). Triggers include: a... |
| **`pdf`** | Workspace | Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multipl... |
| **`pptx`** | Workspace | Use this skill any time a .pptx or .potx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch decks, or presen... |
| **`xlsx`** | Workspace | Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix an existing ... |

### Specialized Integrations & Utilities (69 Skills)

| Skill Name | Source | Description / When to Use |
|---|---|---|
| **`agentic`** | Workspace | Conversational AI-first interface with minimal controls, clear outcomes, and delegated task flows for agentic workflows. |
| **`agy-customizations`** | Builtin | Comprehensive guide and reference for the Antigravity Customization System. Use to explain how customizations work, their loading priority, discovery mechani... |
| **`android-cli`** | Config / Plugin | Provides instructions for installing and using the `android` CLI. The `android` command-line tool is a critical tool for Android development and helps you cr... |
| **`ant`** | Workspace | Structured, enterprise-focused design system emphasizing clarity, consistency, and efficiency for data-dense web applications. |
| **`antigravity-guide`** | Builtin | Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY), including the Antigravity CLI (agy), Antigravity 2.0, Antigravity ... |
| **`basic`** | Workspace | Print-inspired visual language for books, magazines, and reports with editorial grids and expressive typography. |
| **`brainstorming`** | Workspace | You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requi... |
| **`building-data-apps`** | Workspace | Build modern data apps, dashboards, and interactive reports using either React + Vite or Streamlit. Includes optional Gemini Data Analytics chat integration ... |
| **`claude`** | Workspace | A research-journal aesthetic printed on warm stone — authoritative, editorial, almost achromatic. Pages live on warm ivory parchment (never pure white), with... |
| **`claude-api`** | Workspace | Reference for the Claude API / Anthropic SDK — model ids, pricing, params, streaming, tool use, MCP, agents, caching, token counting, model migration. TRIGGE... |
| **`codex`** | Workspace | A radically minimal, blank-canvas interface built as a pure edge-to-edge surface, with almost no color and typography carrying the visual weight. Black serve... |
| **`contemporary`** | Workspace | Current-era minimalist design with bento grids, dark mode support, and high-performance accessible layouts. |
| **`cosmic`** | Workspace | Futuristic sci-fi aesthetic with dark themes, vibrant neon accents, and immersive spatial elements. |
| **`creative`** | Workspace | Playful, character-driven design with expressive typography and bold graphics for landing pages and creative projects. |
| **`credentials`** | Config / Plugin | Instructions for handling API keys and credentials safely, verifying their presence, and prompting the user to add them if missing using a safe protocol. |
| **`dispatching-parallel-agents`** | Workspace | Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies |
| **`dithered`** | Workspace | Dot-pattern rendering technique that simulates shades with a limited palette for nostalgic, retro, high-contrast visuals. |
| **`dramatic`** | Workspace | High-contrast, theatrical design with bold layouts, immersive visuals, and unconventional compositions that command attention. |
| **`embl-ebi-ols`** | Config / Plugin | Query and search the EMBL-EBI Ontology Lookup Service (OLS) for biomedical ontology terms, definitions, and hierarchies across 250+ ontologies (e.g., GO, DOI... |
| **`encode-ccres-database`** | Config / Plugin | Query the ENCODE Registry of cis-Regulatory Elements (cCREs) via the SCREEN GraphQL API, or make custom queries to the ENCODE Portal REST API for experiments... |
| **`enforcing-resource-attribution`** | Workspace | Enforces resource attribution for CLI commands. Use this skill whenever you are running `bq` or `gcloud` commands via `run_command`. It ensures mandatory lab... |
| **`enterprise`** | Workspace | Dark-themed cloud-platform aesthetic with modular grids, glass-like panels, and strong data hierarchy for productivity dashboards. |
| **`expressive`** | Workspace | Vibrant, personality-driven design with bold colors, playful graphics, and dynamic layouts that balance creativity with structure. |
| **`fantasy`** | Workspace | Game-inspired fantasy aesthetic with bold, premium visuals, rich color palettes, and immersive thematic elements. |
| **`fiction`** | Workspace | A playful, energetic, cartoonesque interface inspired by friendly children's-book illustrations — warm cream backgrounds, big bold custom display typography,... |
| **`flat`** | Workspace | Two-dimensional minimalist style with vibrant colors, clean typography, and no 3D effects for fast, user-friendly interfaces. |
| **`friendly`** | Workspace | Approachable, intuitive design with rounded elements, ample whitespace, and soft pastel color palettes. |
| **`futuristic`** | Workspace | Forward-looking design with tech-inspired typography, modern layouts, and a sleek, innovation-driven aesthetic. |
| **`gcloud-auth-verification`** | Workspace | Guidelines for identifying and resolving missing Google Cloud authentication and Application Default Credentials (ADC). Use this skill if `gcloud`, `bq`, `da... |
| **`gemini-api-dev`** | Config / Plugin | Use this skill when building applications with Gemini API hosted models, including Gemini and Gemma 4, working with multimodal content (text, images, audio, ... |
| **`gemini-interactions-api`** | Config / Plugin | Use this skill when writing code that calls the Gemini API for text generation, multi-turn chat, multimodal understanding, image generation, video generation... |
| **`gemini-live-api-dev`** | Config / Plugin | Use this skill when building real-time, bidirectional streaming applications with the Gemini Live API. Covers WebSocket-based audio/video/text streaming, voi... |
| **`gemini-omni-flash-api`** | Config / Plugin | Use this skill for generative video editing, text-to-video, image-referenced video generation, and first-frame-to-video transition animations using the offic... |
| **`geometric`** | Workspace | Geometric, structured design with clean typography, neutral colors, precise shapes, and intuitive layouts that stay out of the way. |
| **`google-cloud-auth-verification`** | Config / Plugin | Mandatory Step 0 pre-flight execution order and authentication verification for Google Cloud Platform (GCP), Application Default Credentials (ADC), gcloud CL... |
| **`google-maps-platform`** | Config / Plugin | A collection of skills for architecting and implementing production-ready code using Google Maps Platform APIs and SDKs for any map, place, address, geocodin... |
| **`herdr`** | Config / Plugin | Control Herdr, a terminal multiplexer for coding agents. Use only when the user explicitly mentions Herdr or asks to use Herdr to inspect or control panes, t... |
| **`human-protein-atlas-database`** | Config / Plugin | Use when you want to retrieve semi-quantitative protein expression and spatial localisation data from the Human Protein Atlas (HPA). |
| **`immersive`** | Workspace | An immersive, interactive, exhibit-style interface that blends storytelling, animation, and gamified elements to create a playful, experience-driven journey.... |
| **`impeccable`** | Workspace | A modern, graphic, editorial-poster aesthetic — warm and confident — built on alternating cream and burnt orange sections, an amber brand color. |
| **`interpro-database`** | Config / Plugin | Identify domains, families, and sites in proteins; find all proteins in a family or sharing a domain; explore species distribution for a domain; annotate gen... |
| **`levels`** | Workspace | Conversion-focused design that removes friction and guides users toward action through clarity, trust, and speed. |
| **`lingo`** | Workspace | Playful, minimal design with bright colors, rounded shapes, tactile 3D borders, and friendly illustrations for approachable interfaces. |
| **`material`** | Workspace | Google's Material Design with layered surfaces, dynamic theming, built-in motion, and responsive cross-platform patterns. |
| **`mcp-builder`** | Workspace | Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use whe... |
| **`ncbi-sequence-fetch`** | Config / Plugin | Retrieve protein and nucleotide sequences from NCBI databases using E-utilities. Supports direct accession lookup, CDS translation, gene+organism search, loc... |
| **`opentargets-database`** | Config / Plugin | Query Open Targets Platform for target-disease associations, drug target discovery, tractability/safety data, genetics/omics evidence, known drugs, for thera... |
| **`paper`** | Workspace | Paper-textured, print-inspired design with minimal colors, clean serif/sans typography, and tactile surface qualities. |
| **`perspective`** | Workspace | Spatial depth design with isometric views, vanishing points, and layered elements that guide attention through 3D-like realism. |
| **`power`** | Workspace | High-end dark aesthetic with bold headings, monochromatic palette, and premium feel for premium brand experiences. |
| **`predictingthepast`** | Config / Plugin | Ancient text restoration, attribution, dating, contextualization, and embedding via Aeneas (Latin) / Ithaca (Ancient Greek). Use when asked to "restore", "at... |
| **`premium`** | Workspace | Apple-inspired premium aesthetic with precise spacing, modern typography, and a refined, polished visual language. |
| **`professional`** | Workspace | Polished, business-ready design with modern typography, structured layouts, and a trustworthy visual identity. |
| **`protein-sequence-msa`** | Config / Plugin | Performs multiple sequence alignment of proteins with EBI Clustal Omega. Use when you need to align multiple sequences to assess similarity, domain conservat... |
| **`protein-sequence-similarity-search`** | Config / Plugin | Searches for homologous protein sequences using MMseqs2 (fast, default) or BLAST (comprehensive, fallback). Trigger this whenever the user provides a protein... |
| **`refined`** | Workspace | Carefully curated, modern minimal style with elegant serif typography and understated, sophisticated palettes. |
| **`retrieving-developer-knowledge`** | Config / Plugin | Searches, retrieves, and synthesizes official Google developer documentation across Google Cloud, AI/Gemini, Android, Chrome, Web, Flutter, Go, Firebase, and... |
| **`roku`** | Workspace | App dashboard with purple-themed aesthetic, top-bar navigation, card-based layouts, and developer-first workflows. |
| **`schema-mapping`** | Config / Plugin | Guides the process of analyzing, mapping, and documenting transformations between source and target schemas for any database, data warehouse, or data platfor... |
| **`spacious`** | Workspace | Generous whitespace, consistent padding, and grid-based layouts for clean, readable, and breathing interfaces. |
| **`square`** | Workspace | Graceful, refined aesthetic with delicate typography, minimal palettes, and polished layouts that exude sophistication. |
| **`storytelling`** | Workspace | Narrative-driven design using visuals, copy, and interaction to guide users through engaging, emotionally resonant journeys. |
| **`subagent-driven-development`** | Workspace | Use when executing implementation plans with independent tasks in the current session |
| **`supabase-postgres-best-practices`** | Workspace | Postgres best practices maintained by Supabase, for Postgres running anywhere. Load this skill BEFORE writing or changing anything that lives in a Postgres d... |
| **`ucsc-conservation-and-tfbs`** | Config / Plugin | Fetch Evolutionary Conservation scores (phyloP, phastCons) and Transcription Factor Binding Sites (TFBS) from the UCSC Genome Browser. Use when analyzing whe... |
| **`unibind-database`** | Config / Plugin | Queries the UniBind database for experimentally validated transcription factor (TF) binding sites. Use when retrieving direct TF-DNA interaction datasets, do... |
| **`uv`** | Config / Plugin | Checks whether the uv Python package manager is installed and installs it if missing. Ensures uv is on PATH. Use when another skill requires uv as a prerequi... |
| **`verification-before-completion`** | Workspace | Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output... |
| **`vibrant`** | Workspace | Lively, colorful design with bold playful typography, warm accents, and dynamic visual energy. |

---

## 4. Model Context Protocol (MCP) Servers (15 Total)

Model Context Protocol (MCP) servers extend agent capabilities with external live tools, contextual databases, design APIs, and cloud services.

| Server Name | Provider / Package | Connection Type | Capability & Purpose |
|---|---|---|---|
| **`StitchMCP`** | Google Cloud / Stitch API | `Remote (`https://stitch.googleapis.com/mcp`)` | Automated design-to-code translation, generating responsive web and mobile UIs directly from visual concepts and specs. |
| **`TestSprite`** | @testsprite/testsprite-mcp | `Local Node/npx` | Autonomous end-to-end and API testing suite that generates, executes, and validates functional test cases against running backends and frontends. |
| **`Figma`** | figma-developer-mcp | `Local Node/npx (`--stdio`)` | Direct integration with Figma developer workspace to fetch live design tokens, wireframes, component layouts, and CSS properties. |
| **`context7`** | @upstash/context7-mcp | `Local Node/npx` | Vector database query engine for up-to-date third-party framework documentation, semantic search, and contextual retrieval. |
| **`shadcn`** | shadcn@latest mcp | `Local Node/npx` | Direct integration with the Shadcn UI component registry to search, install, and configure accessible React components. |
| **`google-developer-knowledge`** | Developer Knowledge API | `Remote (`developerknowledge.googleapis.com/mcp`)` | Official Google developer documentation search across GCP, AI/Gemini, Android, Chrome, Web, Flutter, and Go platforms. |
| **`notebooks`** | Google Data Cloud Extension | `Local Node Bundle (`mcp_proxy_bundle.js`)` | Inspects, runs, and manages Jupyter notebook runtimes and cell executions in Google Cloud environments. |
| **`visualization`** | Google Data Cloud Extension | `Local Node Bundle (`mcp_proxy_bundle.js`)` | Renders interactive charts, financial graphs, and tabular analytics visualizations directly within the IDE. |
| **`data-agent-kit`** | Google Data Cloud Extension | `Local Node Bundle (`mcp_proxy_bundle.js`)` | Data pipeline automation, schema mapping, and ETL orchestration framework for cloud databases. |
| **`datacloud_bigquery_remote`** | Google Cloud BigQuery | `Remote (`https://bigquery.googleapis.com/mcp`)` | Executes live SQL queries, inspects table schemas, evaluates query execution plans, and analyzes dataset partitioning. |
| **`datacloud_dataproc_remote`** | Google Cloud Dataproc | `Remote (`https://dataproc-${REGION}.googleapis.com/mcp`)` | Submits and manages Spark, PySpark, and Hadoop batch jobs on serverless and clustered Dataproc compute. |
| **`datacloud_knowledge_catalog_remote`** | Google Cloud Dataplex | `Remote (`https://dataplex.googleapis.com/mcp`)` | Searches enterprise data catalogs, tracks lineage, inspects data governance policies, and verifies asset quality. |
| **`datacloud_spanner_remote`** | Google Cloud Spanner | `Remote (`https://spanner.googleapis.com/mcp`)` | Inspects and queries globally distributed relational schemas and transaction states in Google Cloud Spanner. |
| **`datacloud_alloydb_remote`** | Google Cloud AlloyDB | `Remote (`https://alloydb.${REGION}.rep.googleapis.com/mcp`)` | PostgreSQL-compatible enterprise database queries, index evaluations, and performance tuning. |
| **`datacloud_cloud-sql_remote`** | Google Cloud SQL | `Remote (`https://sqladmin.googleapis.com/mcp`)` | Manages and monitors managed MySQL, PostgreSQL, and SQL Server instances on Google Cloud Platform. |

---

## 5. Lifecycle & Event Hooks (2 Suites)

Hooks are deterministic event handlers triggered automatically by the IDE runtime before or after tool invocations, prompts, or sessions to enforce policies, record telemetry, or sync external state.

### Active Hook Suites in This Environment

#### 1. Herdr Agent State Hook (`PreInvocation`)
- **Configuration File**: `~/.gemini/config/hooks.json`
- **Trigger Phase**: `PreInvocation` (Fires immediately before the AI model starts planning or responding to a user turn).
- **Command**: `powershell -NoProfile -ExecutionPolicy Bypass ~/.gemini/config/hooks/herdr-agent-state.ps1 session`
- **Execution Timeout**: 10 seconds
- **Purpose**: Synchronizes active terminal multiplexer panes, session identifiers, and multi-agent coordination states for Herdr.

#### 2. Google Data Cloud Telemetry Hook (`PreToolUse`)
- **Configuration File**: `~/.gemini/config/plugins/googlecloudtools.datacloud_telemetry/hooks.json`
- **Trigger Phase**: `PreToolUse` (Fires before any IDE tool is executed by an agent, matching `*`).
- **Command**: `node telemetry_hook_bundle.js --agent_name gemini --install_source "Antigravity IDE" ; exit 0`
- **Execution Timeout**: 30 seconds
- **Purpose**: Captures execution latency, tool invocation health, and usage telemetry for Google Data Cloud tool bundles.

---

## 6. Workflow Playbook: How to Dispatch Capabilities

### 1. Activating a Subagent
You can explicitly direct the assistant to invoke a subagent for a focused pass:
```text
"Please invoke the security-reviewer subagent to audit our authentication and run ingestion endpoints."
"Use performance-optimizer to profile the transaction grid and memoize heavy React components."
"Dispatch code-simplifier to clean up single-use helpers and nested conditionals in backend/engine."
```

### 2. Applying Design & Aesthetic Skills
To style UI components or redesign interfaces, mention the design skill name:
```text
"Redesign our KPI summary cards using the bento layout and glassmorphism styling."
"Apply shadcn design patterns with accessible keyboard navigation for the drawer component."
```

### 3. Leveraging MCP Servers
You can query external live documentation or Figma specs:
```text
"Query the context7 MCP to fetch the latest documentation on Vite rolldown options."
"Use the Figma MCP to pull the color tokens and typography hierarchy for our dashboard."
```