# Build Solution Architecture Document: Multi-Agent Customer Support Crew

## Metadata

| Field | Value |
| --- | --- |
| Project | Multi-Agent Customer Support Crew |
| Version | 1.0 |
| Status | Ready for Build Phase |
| Phase | MVP / Proof of Concept |
| Adapter | CrewAI |
| Source artifacts | `project-context/1.define/mrd.md`, `project-context/1.define/prd.md`, `project-context/1.define/sad.md` |
| Official Build artifact | `project-context/2.build/sad.md` |

## Executive Summary

The Multi-Agent Customer Support Crew is an AI-assisted support operations system for B2B SaaS companies. It processes incoming email or ticket-style customer support requests and produces a structured review package for human support agents.

The system exists to reduce repetitive support work, improve ticket triage, retrieve relevant support knowledge, identify urgent or frustrated customers, draft grounded responses, recommend routing, and flag escalation risks.

The MVP covers one-ticket-at-a-time processing with mocked/local ticket input, mocked customer metadata, a local knowledge base, specialized CrewAI agents, a Flow-controlled orchestration pipeline, structured outputs, logs, and human review.

The MVP is human-in-the-loop by design. It must not send autonomous customer-facing responses, issue refunds, cancel accounts, change customer records, make legal commitments, or bypass human approval.

## 1. Architecture Overview

The Multi-Agent Customer Support Crew is an AI-assisted support operations system for B2B SaaS support teams. The architecture centers on an orchestration layer that coordinates specialized agents for ticket classification, knowledge retrieval, sentiment analysis, solution drafting, routing, and escalation recommendations.

The system is designed as a human-in-the-loop support workflow. It does not autonomously send customer-facing responses or perform account actions. Instead, it produces a consolidated support review package that a support agent can inspect, edit, approve, reject, route, or escalate.

The MVP prioritizes clear orchestration, auditable agent outputs, retrieval-grounded response drafting, confidence-based fallback behavior, and simplified integrations that can later evolve into production-grade connectors.

### Architectural Goals

- Support modular agent responsibilities.
- Preserve human approval for all customer-facing responses.
- Ground generated responses in approved knowledge base content.
- Expose confidence, rationale, and source references for auditability.
- Allow mocked or simplified integrations for ticketing, customer metadata, and knowledge base sources.
- Keep the design extensible for future production integrations and additional agents.
- Provide enough structure for downstream Build-stage agents to implement without guessing.

### Architecture Principles

- Human authority remains final.
- Customer ticket content is treated as untrusted input.
- Agent outputs must be structured, inspectable, and logged.
- Low confidence should trigger human review, not forced automation.
- Knowledge-grounded responses are preferred over fluent but unsupported responses.
- Vendor-specific integrations should be isolated behind adapters.
- MVP simplicity should not prevent future scalability.

### MVP Runtime Architecture

The MVP should use a simple runtime shape before introducing distributed infrastructure:

- Single backend application or service.
- Synchronous orchestration for one ticket at a time.
- Local or lightweight database storage for tickets, agent outputs, review packages, and decisions.
- Local knowledge base files or a simple knowledge table with source IDs and version metadata.
- Structured JSON logs for observability and evaluation.
- Simple UI, CLI, or API response for presenting the review package.

This runtime shape keeps the MVP implementable while preserving boundaries that can later evolve into asynchronous workers, production databases, real ticketing integrations, and enterprise-grade review workflows.

---

## 2. Architecture Strategy Decision

The Week 2 architecture decision uses the CrewAI decision framework rather than assuming that a multi-agent product should automatically be implemented as a Crew-only system. The product requires both deterministic workflow control and specialized agent collaboration, so the architecture is evaluated across precision and complexity dimensions.

### Precision Scoring

| Precision Dimension | Score | Rationale |
| --- | ---: | --- |
| Output structure | 9 | The system must produce stable structured outputs for classification, sentiment, retrieval, drafts, routing, escalation, review packages, logs, and evaluation results. |
| Accuracy needs | 8 | Incorrect routing, escalation, or response drafting can delay customer support or create account risk, even though humans approve final responses. |
| Reproducibility | 8 | The MVP requires repeatable evaluation against labeled tickets and consistent behavior for confidence gates, safety checks, and handoffs. |
| Error tolerance | 8 | The system can tolerate low-confidence outputs only when they are surfaced to humans; silent errors in escalation or response drafting are not acceptable. |

Overall precision level: high. The average precision score is 8.25 out of 10.

### Complexity Scoring

| Complexity Dimension | Score | Rationale |
| --- | ---: | --- |
| Number of steps | 8 | The workflow includes intake, classification, sentiment analysis, retrieval, drafting, routing, escalation, review package creation, logging, and evaluation. |
| Interdependencies | 8 | Downstream tasks depend on upstream structured outputs; routing and escalation depend on classification, sentiment, customer metadata, and retrieval confidence. |
| Conditional logic | 9 | Confidence gates, missing knowledge, prompt-injection risk, high-risk sentiment, conflicting sources, and escalation severity all alter behavior. |
| Domain knowledge | 7 | The system requires B2B SaaS support domain knowledge, support queue taxonomy, escalation policies, and knowledge base grounding. |

Overall complexity level: high. The average complexity score is 8.0 out of 10.

### Conceptual Quadrant

The project falls into the high precision and high complexity quadrant.

This means the system needs deterministic workflow control and reliable structured outputs, while still benefiting from specialized agents that perform domain-specific reasoning. The architecture should not rely on a purely free-form crew conversation, and it should not reduce all work to a rigid non-agentic flow.

### Selected Architecture

Selected architecture: Flow + Crew hybrid.

The Flow controls the deterministic support-ticket lifecycle: intake, task ordering, confidence gates, safety gates, state transitions, review package assembly, logging, and evaluation. The Crew provides specialized expert agents for classification, sentiment analysis, retrieval, response drafting, routing, and escalation.

### Rationale

Flow + Crew is the best fit because the system has high precision needs and high workflow complexity:

* The Flow provides reproducibility, state management, validation checkpoints, and explicit branching.
* The Crew provides modular expert reasoning for tasks that benefit from agent specialization.
* The hybrid design supports human-in-the-loop control and auditable intermediate outputs.
* The architecture can start sequentially for the MVP and later add parallelism where safe.

### Why Crew Only Was Not Selected

Crew only was not selected because the project requires strict ordering, structured handoffs, confidence-gated behavior, evaluation repeatability, and safety constraints. A Crew-only design would risk too much free-form coordination for a workflow that must produce predictable review packages and enforce human approval.

### Why Flow Only Was Not Selected

Flow only was not selected because the support workflow includes specialized reasoning tasks: interpreting customer intent, assessing sentiment, grounding answers in support knowledge, drafting a nuanced response, and weighing escalation risk. A pure Flow could orchestrate deterministic steps, but it would underuse the benefits of narrow expert agents.

### Impact on the SAD

The SAD should be interpreted as a Flow-controlled architecture with Crew-based specialist execution:

* The Orchestrator is refined as a Flow Controller.
* Agent handoffs must be explicit and structured.
* Sequential execution remains the MVP default.
* Confidence gates and safety gates belong to the Flow.
* Specialist agents return JSON-compatible or sectioned structured outputs to the Flow.
* Future scaling may parallelize selected independent tasks, but only after the sequential workflow is validated.

---

## 3. High-Level System Context

The system sits between customer support intake channels, support knowledge sources, customer/account metadata, and human support agents.

### External Actors

- Customer: submits support requests through email or ticketing channels.
- Support Agent: reviews the AI-generated support package and takes final action.
- Support Manager: reviews escalations, routing quality, and operational performance.
- Customer Success Manager: handles account-sensitive or churn-risk escalations.
- Support Operations Owner: maintains categories, escalation criteria, knowledge readiness, and evaluation metrics.

### External Systems

For MVP:

- Mock ticket input.
- Mock customer metadata.
- Local or simplified knowledge base.
- Local review output through CLI, markdown, JSON, lightweight UI, or API response.

Future production systems:

- Zendesk, Intercom, Salesforce Service Cloud, or ServiceNow for ticketing.
- Salesforce, HubSpot, or internal CRM for account metadata.
- Help center, internal docs, or knowledge management systems for retrieval.
- BI or data warehouse systems for reporting and evaluation.

### System Context Diagram


Customer Ticket / Email
        |
        v
Ticket Intake Adapter
        |
        v
Multi-Agent Support Orchestrator
        |
        |---- Classification Agent
        |---- Sentiment Analysis Agent
        |---- Knowledge Retrieval Agent ---- Knowledge Base
        |---- Solution Generation Agent
        |---- Routing Agent
        |---- Escalation Agent
        |
        v
Support Review Package
        |
        v
Human Support Agent / Manager / CSM


---

## 4. Logical Architecture

The system is organized into the following logical layers.

### 3.1 Presentation Layer

Provides the support agent review experience.

Responsibilities:

* Display incoming ticket details.
* Display agent outputs in a single review package.
* Allow the support agent to approve, edit, reject, or regenerate response drafts.
* Allow routing and escalation recommendations to be accepted or overridden.
* Clearly separate AI-generated recommendations from human-approved decisions.
* Surface warnings, confidence gaps, missing knowledge, and escalation rationale.

MVP implementation options:

* CLI output.
* Markdown report.
* JSON response.
* Lightweight web interface.
* Simple local review page.

### 3.2 Application and Workflow Layer

Coordinates ticket lifecycle and human review actions.

Responsibilities:

* Accept ticket intake requests.
* Start agent orchestration.
* Persist ticket state and agent outputs.
* Manage review package status.
* Record human feedback and overrides.
* Expose review package data to the presentation layer.

### 3.3 Multi-Agent Orchestration Layer

Coordinates specialized agents and manages shared context.

Responsibilities:

* Determine agent execution order.
* Pass shared context and upstream outputs to downstream agents.
* Apply confidence gates and escalation rules.
* Handle partial failures and low-confidence outputs.
* Assemble final recommendations.
* Ensure all customer-facing outputs remain human-approved.

### 3.4 Agent Layer

Contains specialized agents with clear responsibilities:

* Classification Agent.
* Knowledge Retrieval Agent.
* Sentiment Analysis Agent.
* Solution Generation Agent.
* Routing Agent.
* Escalation Agent.

Each agent must return structured output with confidence, rationale, and status.

### 3.5 Data and Knowledge Layer

Stores ticket data, agent outputs, knowledge documents, retrieval results, human decisions, and operational logs.

Responsibilities:

* Maintain source ticket records.
* Store knowledge base content and metadata.
* Support retrieval over approved documentation.
* Preserve audit records for recommendations and human actions.
* Support evaluation against labeled MVP examples.

### 3.6 Integration Layer

Provides adapters to external or mocked systems.

MVP adapters:

* Mock ticket source or email/ticket input.
* Mock customer metadata source.
* Local or simplified knowledge base source.
* Local output adapter for review package rendering.

Future adapters:

* Zendesk.
* Intercom.
* Salesforce Service Cloud.
* HubSpot or Salesforce CRM.
* Internal documentation systems.
* Authentication and identity providers.

---

## 5. Component Architecture

### Core Components

| Component                 | Responsibility                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Ticket Intake Adapter     | Accepts incoming ticket-like input and normalizes it into a `TicketContext`.                                |
| Orchestrator              | Runs the multi-agent workflow, manages context, applies confidence gates, and assembles the review package. |
| Classification Agent      | Classifies the ticket category, intent, product area, and ambiguity level.                                  |
| Sentiment Analysis Agent  | Evaluates urgency, frustration, cancellation intent, and customer risk indicators.                          |
| Knowledge Retrieval Agent | Retrieves approved support knowledge relevant to the ticket.                                                |
| Solution Generation Agent | Drafts a grounded support response for human approval.                                                      |
| Routing Agent             | Recommends the appropriate support queue or team.                                                           |
| Escalation Agent          | Recommends whether and where the ticket should be escalated.                                                |
| Review Package Builder    | Converts agent outputs into a consolidated support review package.                                          |
| Human Review Interface    | Presents the review package and captures human decisions.                                                   |
| Audit and Logging Service | Records agent runs, confidence scores, retrieved sources, and human actions.                                |
| Evaluation Module         | Compares outputs against labeled MVP examples for quality validation.                                       |

### Component Boundary Principle

The orchestration layer should not contain vendor-specific logic. Ticketing tools, CRM systems, and knowledge repositories should be accessed through adapters so the MVP remains simple while keeping the future architecture extensible.

---

## 6. Multi-Agent Orchestration Design

The orchestration design uses a Flow Controller as the central orchestrator for the support workflow. The Flow Controller invokes specialized Crew agents, maintains context, applies confidence gates, controls branching, and assembles outputs into a reviewable result.

### Baseline Execution Pattern

1. Ticket intake receives a new ticket.
2. Orchestrator creates a shared ticket context.
3. Classification Agent classifies the ticket and assigns confidence.
4. Sentiment Analysis Agent evaluates tone, urgency, and customer risk.
5. Knowledge Retrieval Agent retrieves relevant approved support content.
6. Solution Generation Agent drafts a knowledge-grounded response when sufficient evidence exists.
7. Routing Agent recommends a destination team or queue.
8. Escalation Agent evaluates whether the ticket requires priority handling or manager involvement.
9. Orchestrator assembles the final support review package.
10. Human support agent reviews and takes final action.

### MVP Execution Mode

The MVP uses synchronous sequential execution.

Rationale:

* Easier to implement and debug.
* Easier to demonstrate in a capstone environment.
* Easier to log and evaluate.
* Sufficient for processing one ticket at a time.
* Preserves a clean path toward future asynchronous execution.

Future versions may move independent agents to parallel execution, especially classification, sentiment analysis, and retrieval.

### Confidence Gates

The orchestrator should apply confidence gates before advancing recommendations:

* Low classification confidence: flag for manual triage review.
* Low retrieval confidence: avoid definitive answer drafts and recommend manual response creation.
* High-risk sentiment: increase priority and pass stronger signal to Escalation Agent.
* Conflicting outputs: surface conflict in the review package instead of hiding it.
* Agent failure: continue with partial results when possible and recommend human review.

### Suggested MVP Confidence Thresholds

| Signal                    | Suggested Threshold | System Behavior                               |
| ------------------------- | ------------------- | --------------------------------------------- |
| Classification confidence | < 0.70              | Manual triage review                          |
| Retrieval confidence      | < 0.70              | Draft marked as unsupported or unsafe to send |
| Routing confidence        | < 0.70              | Manual routing review                         |
| Escalation confidence     | < 0.70              | Advisory escalation recommendation            |
| High-risk sentiment       | >= 0.75             | Escalation priority increased                 |

These thresholds should be treated as initial MVP defaults and may be adjusted during testing.

### Human Authority

Human decisions override agent recommendations. The system should store the original recommendation and the human action so future evaluation can measure acceptance, rejection, edit distance, and override patterns.

---

## 7. Agent Design Strategy

The agent design should favor specialists over generalists. Each agent should have a narrow expert role, a clear goal, a concise backstory for Build-stage prompting, and a single primary responsibility in the workflow.

For the MVP, the process should remain sequential first. Hierarchical delegation should be avoided until evaluation shows that the workflow needs it. The most important design factor is task clarity, not elaborate persona detail. Role, Goal, and Backstory should help focus the agent, but the task definition and structured output contract should drive behavior.

### Agent Design Principles

* Specialists over generalists: each agent should own one narrow support workflow responsibility.
* Use narrow expert agents instead of broad generalist agents.
* Define explicit handoffs between agents through structured outputs.
* Use sequential execution first for reproducibility and easier debugging.
* Avoid premature hierarchy or manager-agent patterns beyond the Flow Controller.
* Keep Role, Goal, and Backstory concise and grounded in the support workflow.
* Prioritize task design, validation criteria, and output schemas over persona detail.
* Keep customer-facing authority with the human reviewer, not with any agent.

### Build-Stage Role, Goal, Backstory Guidance

In the Build phase, each agent should be defined with:

* Role: the agent's narrow support operations specialization.
* Goal: the specific outcome the agent is accountable for.
* Backstory: a short domain framing that improves focus without adding unnecessary narrative.

Backstories should not grant agents extra authority, bypass safety rules, or blur task boundaries.

### Agent Specialization Table

| Agent | Role Specialization | Primary Task | Expected Structured Output | Handoff Target |
| --- | --- | --- | --- | --- |
| Orchestrator / Flow Controller | Deterministic workflow controller and state manager | Control sequence, validate handoffs, apply gates, assemble review package | `ReviewPackage`, workflow state, warnings, audit events | Human Review Interface, Evaluation Module |
| Classification Agent | Ticket taxonomy specialist | Identify category, intent, product area, ambiguity, and confidence | `ClassificationResult` | Sentiment Analysis Agent, Knowledge Retrieval Agent, Routing Agent, Escalation Agent |
| Sentiment Analysis Agent | Customer tone and urgency specialist | Detect frustration, urgency, churn risk, business impact, and risk flags | `SentimentResult` | Routing Agent, Escalation Agent, Solution Generation Agent |
| Knowledge Retrieval Agent | Approved support knowledge specialist | Retrieve and rank relevant KB sources with source IDs and confidence | `RetrievalResult` | Solution Generation Agent, Escalation Agent |
| Solution Generation Agent | Grounded response drafting specialist | Draft a support response using ticket context and approved retrieved sources | `DraftResponse` | Orchestrator / Flow Controller, Human Review Interface |
| Routing Agent | Support queue assignment specialist | Recommend the correct queue based on category, sentiment, metadata, and confidence | `RoutingRecommendation` | Escalation Agent, Orchestrator / Flow Controller |
| Escalation Agent | Support risk and escalation specialist | Recommend escalation target, severity, and rationale | `EscalationRecommendation` | Orchestrator / Flow Controller, Human Review Interface |

---

## 8. Agent Communication Flow

Agent communication is mediated by the Flow Controller through a shared structured context object. Agents should not directly call each other in the MVP. This keeps dependencies explicit and makes failures easier to isolate.

### Communication Sequence

1. Orchestrator / Flow Controller receives `TicketContext`.
2. Classification Agent returns `ClassificationResult`.
3. Sentiment Analysis Agent returns `SentimentResult`.
4. Knowledge Retrieval Agent receives ticket content plus classification context and returns `RetrievalResult`.
5. Solution Generation Agent receives ticket content, classification, sentiment, and retrieval results, then returns `DraftResponse`.
6. Routing Agent receives ticket content, classification, sentiment, customer metadata, and retrieval confidence, then returns `RoutingRecommendation`.
7. Escalation Agent receives all prior outputs and returns `EscalationRecommendation`.
8. Orchestrator / Flow Controller creates `ReviewPackage`.

### Communication Principles

* Agents communicate through structured inputs and outputs.
* Each agent output includes confidence, rationale, and status.
* The Orchestrator / Flow Controller owns workflow state.
* Downstream agents receive only the context they need.
* All recommendation-producing agents must support a low-confidence or unable-to-determine state.
* The review package should preserve each major intermediate output for auditability.

### Agent Output Contracts

The Orchestrator / Flow Controller should normalize agent outputs into stable contracts:

| Agent                     | Output Contract            | Required Fields                                                                         |
| ------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| Classification Agent      | `ClassificationResult`     | `category`, `intent`, `product_area`, `confidence`, `rationale`, `needs_manual_review`  |
| Sentiment Analysis Agent  | `SentimentResult`          | `sentiment_label`, `urgency`, `risk_flags`, `confidence`, `rationale`                   |
| Knowledge Retrieval Agent | `RetrievalResult`          | `sources`, `snippets`, `relevance_scores`, `retrieval_confidence`, `missing_knowledge`  |
| Solution Generation Agent | `DraftResponse`            | `draft_text`, `source_ids`, `confidence`, `safety_notes`, `sendable_after_human_review` |
| Routing Agent             | `RoutingRecommendation`    | `queue`, `confidence`, `rationale`, `manual_review_required`                            |
| Escalation Agent          | `EscalationRecommendation` | `escalate`, `severity`, `target`, `reason`, `confidence`                                |

Stable contracts reduce coupling between agents and make logs, review packages, and evaluation easier to implement.

---

## 9. Task Design Strategy

Task design is the main control mechanism for predictable agent behavior. Each task should be narrow, explicit, and validated before its output is passed downstream.

### Task Design Principles

* Each task has a single purpose and a single primary output.
* Each task defines explicit inputs, outputs, scope, and validation criteria.
* Tasks should use structured outputs such as JSON-compatible schemas or clearly named markdown sections.
* Avoid "god tasks" that ask one agent to classify, retrieve, draft, route, and escalate in a single step.
* Downstream tasks should consume upstream structured outputs instead of free-form text.
* Validation should happen at each handoff so low-confidence, missing, or malformed outputs are caught early.
* The Flow Controller owns branching and retries; individual agents should not independently change the overall workflow.

### MVP Task Boundaries

| Task | Single Purpose | Primary Output | Validation Criteria |
| --- | --- | --- | --- |
| Classify ticket | Assign support taxonomy and intent | `ClassificationResult` | Category is allowed, confidence present, rationale present |
| Analyze sentiment | Determine urgency and risk signals | `SentimentResult` | Sentiment label, urgency, confidence, and risk flags are present |
| Retrieve knowledge | Find approved support sources | `RetrievalResult` | Source IDs and relevance scores are present or missing knowledge is explicit |
| Draft response | Produce human-reviewable response | `DraftResponse` | Draft references source IDs or is marked unsafe/unsupported |
| Recommend routing | Select support queue | `RoutingRecommendation` | Queue is valid or manual review is required |
| Recommend escalation | Determine severity and target | `EscalationRecommendation` | Severity and escalation rationale are present |

---

## 10. Shared Memory and Context Strategy

The MVP should use short-lived shared context for each ticket plus persistent storage for audit and evaluation.

### Short-Lived Execution Context

Used during a single orchestration run.

Contents:

* Ticket subject and body.
* Channel and timestamp.
* Customer metadata.
* Prior agent outputs.
* Retrieved knowledge snippets.
* Confidence scores.
* Runtime warnings or errors.
* Current workflow state.

### Persistent Ticket Memory

Stored after orchestration completes.

Contents:

* Original ticket.
* Final review package.
* Agent outputs.
* Source references.
* Human edits and approvals.
* Routing and escalation overrides.
* Processing timestamps.
* Final review status.

### Knowledge Memory

Used by the Knowledge Retrieval Agent.

Contents:

* Approved knowledge base articles.
* Article titles, sections, tags, and source IDs.
* Embeddings or search indexes where applicable.
* Last updated timestamp or version.
* Approval status.

### Design Constraints

* The system should not use cross-ticket memory to generate customer-facing claims in the MVP unless the data is explicitly part of approved knowledge or provided customer metadata.
* Sensitive ticket content should not be included in unnecessary agent prompts.
* Memory should support auditability without retaining unnecessary secrets or credentials.
* Runtime context should be scoped to the ticket being processed.
* Persistent storage should support evaluation but avoid unnecessary data retention.

---

## 11. Knowledge Retrieval Strategy

Knowledge retrieval is the primary control against unsupported response generation. The system should use retrieval-augmented generation for answer drafting.

### MVP Retrieval Sources

* Local or mocked knowledge base articles.
* Product documentation excerpts.
* Internal support FAQ content.
* Policy snippets for billing, onboarding, and technical support.

### Retrieval Process

1. Normalize and index approved knowledge documents.
2. Use ticket subject, body, category, and intent as retrieval query inputs.
3. Retrieve top matching documents or snippets.
4. Rank results by relevance.
5. Return source IDs, titles, snippets, and relevance scores.
6. Pass only relevant retrieved content to the Solution Generation Agent.

### Retrieval Quality Controls

* If retrieval confidence is low, the system should not produce a definitive answer.
* Drafts should be traceable to retrieved source references.
* The review package should expose sources so the support agent can verify them.
* Knowledge documents should have version or source metadata for auditability.
* Missing or conflicting knowledge should trigger a manual review warning.

### Source Governance

* Approved knowledge base articles should be preferred over historical tickets or unverified notes.
* Each source should include `source_id`, `title`, `version`, `updated_at`, and `approved` status.
* Stale documents should be flagged in retrieval results.
* Conflicting sources should trigger manual review or a cautious draft rather than a definitive answer.
* Retrieval should use a minimum confidence threshold before response drafting is considered reliable.

### Future Retrieval Enhancements

* Hybrid keyword and vector retrieval.
* Product-area-specific indexes.
* Permission-aware retrieval.
* Feedback-based retrieval tuning.
* Integration with live help center content.
* Semantic reranking for improved source relevance.

---

## 12. Response Drafting Strategy

The Solution Generation Agent creates a response draft only for human review.

### Drafting Inputs

* Original ticket content.
* Ticket summary.
* Classification result.
* Sentiment result.
* Retrieved knowledge snippets.
* Source IDs.
* Safety constraints.
* Escalation signals.

### Drafting Rules

* Drafts must be grounded in approved retrieved sources when available.
* Drafts must not invent policies, product behavior, pricing, timelines, or commitments.
* Drafts must not offer refunds, credits, cancellations, legal commitments, or account modifications.
* Drafts should use a professional B2B SaaS support tone.
* Drafts should acknowledge customer context and provide clear next steps.
* Drafts should indicate when more information is needed.
* Drafts with insufficient evidence should be marked as unsafe or not ready to send.

### Draft Output

The draft response should include:

* Suggested customer-facing text.
* Source IDs used.
* Confidence level.
* Safety notes.
* Whether the draft is sendable after human review.
* Any unresolved assumptions.

---

## 13. Routing and Escalation Workflow

The Routing Agent and Escalation Agent work together to determine the correct queue and whether priority handling is required.

### Routing Queues

The MVP supports five routing queues:

* Billing.
* Technical Support.
* Onboarding.
* Customer Success.
* General Support.

### Classification-to-Routing Mapping

| Classification Category    | Default Routing Queue |
| -------------------------- | --------------------- |
| Billing                    | Billing               |
| Technical support          | Technical Support     |
| Bug report                 | Technical Support     |
| Onboarding                 | Onboarding            |
| Account management         | Customer Success      |
| Cancellation or churn risk | Customer Success      |
| Feature request            | General Support       |
| Product question           | General Support       |
| General support            | General Support       |

### Escalation Inputs

* Ticket category.
* Classification confidence.
* Sentiment and urgency.
* Customer metadata such as account tier or strategic status.
* Retrieval confidence.
* Routing recommendation.
* Ticket complexity indicators.
* Sensitive phrases such as cancellation, legal threat, data loss, outage, payment failure, or repeated unresolved issue.

### Escalation Outcomes

* No escalation required.
* Escalate to support team lead.
* Escalate to technical specialist.
* Escalate to billing specialist.
* Escalate to onboarding team.
* Escalate to customer success manager.
* Manual review required due to low confidence or conflicting signals.

### Severity Levels

| Severity      | Meaning                            | Example Triggers                                                                              |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| P0            | Critical customer or business risk | Outage, data loss, security issue, executive escalation, legal threat                         |
| P1            | High priority                      | Strategic account blocked, cancellation threat, repeated unresolved issue, severe frustration |
| P2            | Standard support issue             | Billing question, normal technical issue, onboarding blocker without strategic risk           |
| P3            | Low-risk request                   | General product question, feature request, informational request                              |
| Manual Review | Confidence or policy concern       | Conflicting signals, low retrieval confidence, ambiguous category                             |

Severity should be included in the `EscalationRecommendation` and surfaced in the review package.

### Escalation Rules

The MVP should support rule-guided escalation combined with agent judgment:

* High-risk sentiment increases escalation likelihood.
* Low confidence in classification or retrieval triggers manual review.
* Billing, cancellation, data loss, outage, and strategic customer issues receive stricter review.
* Complex technical issues with insufficient knowledge evidence should be escalated rather than answered definitively.
* Prompt injection or suspicious customer instructions should be flagged for human attention.

### Human Review

Escalation recommendations must be visible to support agents or managers, who can accept or dismiss them. Overrides should be recorded for later quality evaluation.

---

## 14. External Integrations

The MVP uses simplified or mocked integrations to reduce implementation complexity while preserving realistic architecture boundaries.

### MVP Integrations

| Integration          | MVP Approach                                                 | Purpose                                  |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| Ticket source        | Mock ticket input, fixture data, or simple form/API          | Simulate email and ticket intake         |
| Customer metadata    | Mock customer/account records                                | Support routing and escalation decisions |
| Knowledge base       | Local markdown, JSON, CSV, or simple indexed store           | Ground retrieval and response drafting   |
| Human review surface | Simple application UI, CLI, markdown report, or API response | Present review package                   |
| Logging store        | File, lightweight database, or structured logs               | Support audit and evaluation             |

### Future Production Integrations

* Zendesk ticket intake, updates, tags, and internal notes.
* Intercom conversations and help center content.
* Salesforce Service Cloud cases.
* CRM account metadata from Salesforce or HubSpot.
* Authentication provider and enterprise SSO.
* Data warehouse or BI export for analytics.
* Internal documentation or knowledge management tools.

### Integration Design Principles

* Use adapter interfaces around external systems.
* Keep core orchestration independent from vendor-specific APIs.
* Treat external system failures as recoverable where possible.
* Never allow integrations to send customer-facing responses without explicit human approval.
* Keep secrets in environment variables, never hard-coded in source control.

---

## 15. High-Level Data Model

The MVP data model should support ticket processing, agent outputs, human decisions, auditability, and evaluation.

### Core Entities

#### Ticket

Represents the original customer request.

Fields:

* `ticket_id`.
* `subject`.
* `body`.
* `channel`.
* `customer_id`.
* `created_at`.
* `status`.

#### CustomerAccount

Represents simplified customer or account metadata.

Fields:

* `customer_id`.
* `company_name`.
* `account_tier`.
* `account_status`.
* `assigned_csm`.
* `risk_level`.

#### KnowledgeDocument

Represents approved support knowledge.

Fields:

* `document_id`.
* `title`.
* `body`.
* `tags`.
* `source`.
* `version`.
* `updated_at`.
* `approved`.

#### AgentRun

Represents one agent execution.

Fields:

* `agent_run_id`.
* `ticket_id`.
* `agent_name`.
* `input_summary`.
* `output_payload`.
* `confidence`.
* `status`.
* `error_message`.
* `started_at`.
* `completed_at`.

#### ReviewPackage

Represents the consolidated output shown to a human.

Fields:

* `review_package_id`.
* `ticket_id`.
* `classification_result`.
* `sentiment_result`.
* `retrieval_result`.
* `draft_response`.
* `routing_recommendation`.
* `escalation_recommendation`.
* `overall_status`.
* `warnings`.
* `created_at`.

Recommended lifecycle statuses:

* `received`.
* `processing`.
* `ready_for_review`.
* `needs_manual_review`.
* `approved`.
* `rejected`.
* `routed`.
* `escalated`.
* `closed`.

#### HumanDecision

Represents support agent or manager actions.

Fields:

* `decision_id`.
* `ticket_id`.
* `user_id`.
* `action_type`.
* `original_recommendation`.
* `final_value`.
* `notes`.
* `created_at`.

#### AuditLog

Represents notable system events.

Fields:

* `event_id`.
* `ticket_id`.
* `actor_type`.
* `actor_id`.
* `event_type`.
* `event_payload`.
* `created_at`.

#### EvaluationResult

Represents comparison between expected labels and system outputs.

Fields:

* `evaluation_id`.
* `ticket_id`.
* `expected_category`.
* `actual_category`.
* `expected_routing_queue`.
* `actual_routing_queue`.
* `expected_sentiment`.
* `actual_sentiment`.
* `expected_escalation`.
* `actual_escalation`.
* `expected_source_ids`.
* `retrieved_source_ids`.
* `draft_quality_score`.
* `safety_passed`.
* `created_at`.

---

## 16. Data Lifecycle

### MVP Data Flow

1. Ticket is loaded from fixture, local file, simple form, or API request.
2. Ticket is normalized into `TicketContext`.
3. Orchestrator creates an execution context.
4. Agents generate structured outputs.
5. Review package is assembled.
6. Human feedback is captured or simulated.
7. Outputs are logged or stored for evaluation.
8. Evaluation module compares outputs against labeled expectations.

### Data Retention for MVP

The MVP should retain enough data to support debugging and evaluation:

* Original demo ticket.
* Agent outputs.
* Retrieved source IDs.
* Review package.
* Human feedback or simulated feedback.
* Evaluation result.

The MVP should avoid storing unnecessary sensitive data. Demo datasets should use synthetic, sanitized, or fictional customer information.

---

## 17. Security and Privacy Considerations

Support tickets may contain personal data, confidential customer details, product logs, credentials, or sensitive business context. The architecture should minimize unnecessary exposure and preserve control over customer-facing actions.

### Security Principles

* Store only data required for ticket processing, review, and evaluation.
* Avoid collecting credentials, payment details, secrets, or unnecessary personal data.
* Redact or flag sensitive patterns where possible.
* Limit agent context to the minimum data required for each task.
* Preserve human approval before any external customer communication.
* Keep audit records for AI recommendations and human overrides.

### AI-Specific Safety Controls

* Treat customer ticket text as untrusted input.
* Do not allow customer-provided instructions to override system, developer, safety, routing, escalation, or response-generation policies.
* Do not reveal hidden prompts, internal policies, unrelated customer data, or confidential operational instructions.
* Redact or flag likely secrets, credentials, payment data, or sensitive personal data before unnecessary agent processing where feasible.
* Require source-grounded response generation for customer-facing drafts.
* If a ticket appears to contain prompt injection or malicious instructions, surface the risk in the review package and continue with constrained processing.

### MVP Controls

* Use mocked or sanitized customer metadata.
* Use approved knowledge sources only.
* Do not allow agents to perform account modifications.
* Do not allow automatic refunds, credits, cancellations, or policy exceptions.
* Record when a draft was AI-generated and when a human approved or changed it.
* Keep API keys and secrets out of source control.

### Future Controls

* Role-based access control.
* Enterprise SSO.
* Tenant isolation.
* Encryption at rest and in transit.
* PII redaction pipeline.
* Data retention policies.
* Permission-aware knowledge retrieval.
* Audit export for compliance teams.

---

## 18. Observability and Logging

Observability is required to evaluate agent quality, diagnose failures, and support trust in the system.

### Logs to Capture

* Ticket intake event.
* Orchestration start and completion.
* Agent start, completion, failure, latency, and confidence.
* Retrieved source IDs and relevance scores.
* Draft generation status.
* Routing and escalation recommendations.
* Human approval, edit, rejection, route override, and escalation override.
* Errors, timeouts, and fallback behavior.
* Safety warnings and prompt-injection flags.

### Metrics to Track

* Ticket processing volume.
* Agent latency by role.
* Agent failure rate.
* Classification confidence distribution.
* Retrieval hit rate.
* Draft acceptance rate.
* Routing override rate.
* Escalation acceptance and dismissal rate.
* Low-confidence ticket rate.
* Safety violation rate.
* Prompt-injection detection count.
* Retrieval source coverage against expected source IDs.

### Traceability

Each ticket should have a correlation ID or ticket ID that connects:

* Original input.
* Agent runs.
* Retrieved knowledge.
* Review package.
* Human decisions.
* Audit events.
* Evaluation results.

### MVP Logging Format

Structured logs should be preferred over plain text logs.

Recommended minimum fields:

* `timestamp`.
* `ticket_id`.
* `event_type`.
* `component`.
* `status`.
* `latency_ms`.
* `confidence`.
* `message`.
* `error`, when applicable.

---

## 19. Scalability and Reliability Considerations

The MVP can begin with synchronous orchestration, but the architecture should allow future asynchronous processing as ticket volume grows.

### Scalability Considerations

* Keep agents stateless where possible.
* Store shared context externally rather than in process memory only for future versions.
* Use adapter boundaries for external integrations.
* Support independent scaling of retrieval and generation workloads in future versions.
* Design agent inputs and outputs as structured payloads to allow queue-based execution later.
* Keep ticket processing isolated so one ticket failure does not affect others.

### Reliability Considerations

* Agent failure should not fail the entire ticket when partial output is still useful.
* The orchestrator should mark incomplete or failed agent outputs clearly.
* Low-confidence results should default to human review.
* Retrieval failure should prevent unsupported response generation.
* External integration failures should be logged and surfaced.
* Human-approved decisions should be persisted reliably.
* The system should avoid silent failures.

### Failure Modes and Fallbacks

| Failure Mode              | Expected Fallback                                                        |
| ------------------------- | ------------------------------------------------------------------------ |
| Classification fails      | Mark ticket as manual triage required                                    |
| Sentiment analysis fails  | Continue processing but mark sentiment unavailable                       |
| Retrieval fails           | Prevent definitive response drafting and request manual response         |
| Draft generation fails    | Still provide classification, sentiment, routing, and escalation outputs |
| Routing fails             | Mark manual routing required                                             |
| Escalation fails          | Flag manual review required                                              |
| External adapter fails    | Log failure and surface integration warning                              |
| Prompt injection detected | Continue constrained processing and flag safety warning                  |

### Future Reliability Enhancements

* Asynchronous job queue for ticket processing.
* Retry policies with bounded retries.
* Dead-letter queue for failed orchestration runs.
* Circuit breakers around external APIs.
* Health checks for integration adapters.
* Evaluation test sets for regression testing agent quality.

---

## 20. MVP Evaluation Architecture

The MVP should include a small labeled dataset used for validation and regression checks.

### Dataset Characteristics

* 10 to 20 representative English B2B SaaS tickets.
* Expected category and routing queue.
* Expected sentiment or urgency label.
* Expected escalation decision and severity.
* Expected knowledge source IDs where KB coverage exists.
* Human rubric for draft usefulness, correctness, tone, and safety.
* At least one ambiguous ticket.
* At least one high-risk escalation ticket.
* At least one low-knowledge or missing-knowledge ticket.
* At least one malicious or prompt-injection style ticket.

### Evaluation Flow

1. Load labeled evaluation ticket.
2. Process ticket through the orchestrated workflow.
3. Store review package and agent outputs.
4. Compare classification, routing, sentiment, escalation, and retrieval against expected labels.
5. Score draft quality using human rubric or reviewer judgment.
6. Produce a simple evaluation summary.

### Evaluation Metrics

* Classification accuracy.
* Routing recommendation accuracy.
* Escalation precision.
* Retrieval source coverage.
* Draft usability.
* Safety pass rate.
* Processing latency.
* Manual review trigger rate.

This dataset makes the MVP success metrics measurable and prevents the system from relying only on anecdotal demo quality.

---

## 21. Model Selection Strategy

The MVP should start with a simple model strategy. Model routing should not be over-optimized before the system has evaluation results from representative tickets.

### Initial MVP Recommendation

Use one capable general-purpose LLM as the default model for all agents initially. The default model should be strong enough to follow structured-output instructions, handle tool or function-calling patterns where needed, and produce reliable reasoning for the MVP workflow.

This keeps the system easier to evaluate because early quality issues are more likely to come from task design, knowledge quality, schemas, or orchestration rather than inconsistent model behavior across agents.

### Model Selection Principles

* Start with a simple default LLM for the MVP.
* Do not over-optimize multi-model routing before testing.
* Use stronger reasoning models only for high-risk or complex reasoning tasks if evaluation shows quality gaps.
* Use cost-effective models for routine extraction, classification, or formatting tasks where quality remains acceptable.
* Prefer models with reliable structured output and tool/function-calling support for tool-heavy agents.
* Keep API keys in environment variables and do not hard-code credentials.
* Track model name, version, latency, and cost metadata in logs where feasible.

### Future Optimization Path

Model upgrades should be targeted rather than broad. Candidate agents for stronger models are:

* Orchestrator / Flow Controller, if workflow-level reasoning or gate handling is unreliable.
* Escalation Agent, if high-risk cases are missed or severity assignment is inconsistent.
* Solution Generation Agent, if response quality, grounding, or safety is below target.

Routine extraction, classification, formatting, and validation tasks may use more cost-effective models if the evaluation dataset confirms acceptable accuracy.

---

## 22. Deployment Architecture

### MVP Deployment View

The MVP can run locally or as a simple single-service application.

Recommended MVP deployment:

Developer Machine / Local Runtime
        |
        |-- Backend / Orchestrator Service
        |-- Local Knowledge Base
        |-- Demo Ticket Dataset
        |-- Structured Logs
        |-- Review Package Output

MVP runtime dependencies may include:

* Python runtime.
* CrewAI Flow + Crew or equivalent hybrid orchestration framework.
* Local JSON, markdown, or lightweight database files.
* LLM provider configured through environment variables.
* Optional simple frontend or CLI.

### Environment Configuration

Secrets and configuration should be managed through environment variables.

Examples:

* `OPENAI_API_KEY`.
* `MODEL_NAME`.
* `KNOWLEDGE_BASE_PATH`.
* `DEMO_TICKETS_PATH`.
* `LOG_LEVEL`.
* `OUTPUT_PATH`.

No secret values should be committed to version control.

### Future Deployment View

Future production architecture may include:

* Web frontend.
* Backend API service.
* Queue-based worker layer.
* Vector database or search service.
* Relational database.
* Object storage for logs or documents.
* Integration adapters for ticketing and CRM systems.
* Authentication and authorization layer.
* Monitoring and observability stack.

---

## 23. Key Technical Decisions and Rationale

### Decision 1: Use Flow + Crew Hybrid Architecture

Decision:

Use a Flow-controlled workflow with Crew-based specialist agents.

Rationale:

The project scores high for both precision and complexity. The Flow provides deterministic control, state management, validation, confidence gates, and safety gates. The Crew provides specialized reasoning for classification, sentiment, retrieval, drafting, routing, and escalation.

### Decision 2: Use Specialized Agents Instead of One General Agent

Decision:

Separate classification, retrieval, sentiment, drafting, routing, and escalation into distinct agent roles.

Rationale:

The MRD and PRD identify support as a multi-step workflow. Specialized agents make outputs easier to tune, evaluate, inspect, and replace.

### Decision 3: Require Human Approval for Customer-Facing Responses

Decision:

The MVP must not send autonomous customer-facing responses.

Rationale:

The target market wants AI assistance without unsafe full automation. Human approval reduces brand, legal, and relationship risk.

### Decision 4: Ground Drafts in Approved Knowledge Retrieval

Decision:

The Solution Generation Agent should use retrieved knowledge base content as the basis for response drafts.

Rationale:

This reduces hallucination risk, improves trust, and gives support agents source references to verify before responding.

### Decision 5: Use Mocked or Simplified Integrations for MVP

Decision:

Use simplified inputs for ticketing, customer metadata, and knowledge base sources in the MVP.

Rationale:

This keeps the capstone implementation focused on core multi-agent orchestration while preserving architecture boundaries for future Zendesk, Intercom, Salesforce, and CRM integrations.

### Decision 6: Store Agent Outputs and Human Decisions

Decision:

Persist agent results, confidence scores, source references, and human actions.

Rationale:

The product depends on transparency, evaluation, and trust. Stored outputs support success metrics such as draft acceptance rate, routing override rate, and escalation precision.

### Decision 7: Use Confidence-Gated Fallbacks

Decision:

Low-confidence or conflicting outputs should route to human review instead of being hidden or forced into a definitive recommendation.

Rationale:

This aligns with the MVP's human-in-the-loop design and reduces the risk of incorrect routing, unsupported answers, and missed escalations.

### Decision 8: Use Synchronous Processing for MVP

Decision:

Process one ticket at a time through a synchronous orchestrator in the MVP.

Rationale:

This is sufficient for a capstone demo and avoids premature queueing complexity. The structured payload design still allows future asynchronous workers.

### Decision 9: Define Stable Agent Output Contracts

Decision:

Use explicit structured output contracts for every agent.

Rationale:

Stable contracts make the system easier to implement, test, log, and evaluate. They also prevent agent responsibilities from becoming blurred during later build phases.

### Decision 10: Treat Ticket Content as Untrusted Input

Decision:

Customer ticket text must be treated as untrusted and must not control agent policies or hidden instructions.

Rationale:

Support tickets can contain malicious or accidental prompt-injection text. The architecture must preserve policy control and prevent data leakage.

### Decision 11: Use Local Knowledge Sources for MVP

Decision:

Use local or simplified knowledge sources before integrating live help center or documentation systems.

Rationale:

This keeps the MVP predictable, testable, and aligned with the capstone timeline while preserving retrieval architecture boundaries.

### Decision 12: Include Evaluation as a First-Class Architecture Concern

Decision:

Design the MVP with labeled tickets, expected outputs, and structured logs from the beginning.

Rationale:

Multi-agent systems must be evaluated, not only demonstrated. Evaluation artifacts allow the system to prove classification, routing, escalation, retrieval, and safety quality.

### Decision 13: Start With One Capable Default Model

Decision:

Use one capable general-purpose model across all agents for the MVP, then optimize only after evaluation identifies quality, latency, or cost gaps.

Rationale:

Early complexity should be spent on task design, structured outputs, retrieval quality, and orchestration correctness. Premature multi-model routing would make evaluation harder and could obscure the cause of quality issues.

---

## 24. Build Stage Readiness

This SAD should provide sufficient architectural direction for the following Build-stage epics:

### Solution Architecture

* Flow-controlled orchestration.
* Crew-based specialist agents.
* Sequential MVP process.
* Agent contracts.
* Confidence gates.
* Review package structure.

### Setup

* Python runtime.
* CrewAI Flow + Crew or equivalent hybrid orchestration framework.
* Environment variables.
* Local data files.
* Logging/output folders.

### Backend

* Ticket intake.
* Orchestration service.
* Agent execution.
* Data persistence.
* Review package generation.

### Frontend or Review Interface

* Review package display.
* Human approval/edit/reject controls.
* Routing and escalation override controls.
* Visibility into sources, confidence, and rationale.

### Integration

* Mock ticket dataset.
* Mock customer metadata.
* Local knowledge base.
* Optional LLM provider.
* Structured output storage.

### QA

* Labeled evaluation tickets.
* Expected output comparison.
* Safety test cases.
* Prompt-injection test case.
* Failure-mode test cases.

---

## 25. Scope Control

### In MVP

* One-ticket-at-a-time processing.
* Synchronous Flow-controlled pipeline.
* CrewAI specialist agents.
* Mock or local ticket input.
* Mock customer metadata.
* Local approved knowledge base.
* Structured agent outputs.
* Human review package.
* Confidence and safety warnings.
* Basic structured logs.
* Evaluation dataset of 10 to 20 tickets.
* English-only support.

### Future Work

* Full autonomous resolution.
* Voice support or call center integration.
* Production Zendesk, Intercom, Salesforce, or ServiceNow integrations.
* Deep CRM integration.
* Advanced analytics dashboards.
* Multilingual support.
* Enterprise SSO and granular role-based access control.
* Asynchronous queue-based processing.
* Parallel agent execution.
* Multi-model routing optimization.
* Model fine-tuning.
* Automated refunds, cancellations, credits, account changes, or legal commitments.

### Six-Week MVP Guidance

The MVP should prove the core workflow rather than build a full support platform. The priority is to demonstrate reliable Flow + Crew orchestration, structured handoffs, knowledge-grounded drafting, human approval, and evaluation against representative tickets.

---

## 26. Architecture Summary

The system architecture is a modular, orchestrated, human-in-the-loop AI support workflow. A central orchestrator coordinates specialized agents, stores structured outputs, grounds response drafts in approved knowledge, and presents a consolidated review package to support agents.

The MVP uses synchronous processing, mocked integrations, local or lightweight storage, structured logs, and a small evaluation dataset. This design keeps the implementation realistic for the capstone while preserving clean extension points for production ticketing systems, CRM metadata, permission-aware retrieval, asynchronous processing, observability, and enterprise security controls.

The architecture is intentionally simple at runtime but rigorous in boundaries, contracts, safety, and evaluation. This balance allows the project to demonstrate true multi-agent coordination without overengineering the MVP.
