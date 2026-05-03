# System Architecture Document: Multi-Agent Customer Support Crew

## 1. Architecture Overview

The Multi-Agent Customer Support Crew is an AI-assisted support operations system for B2B SaaS support teams. The architecture centers on an orchestration layer that coordinates specialized agents for ticket classification, knowledge retrieval, sentiment analysis, solution drafting, routing, and escalation recommendations.

The MVP is designed as a human-in-the-loop system. It does not autonomously send customer-facing responses or perform account actions. Instead, it produces a consolidated support review package that a support agent can inspect, edit, approve, reject, route, or escalate.

### Architectural Goals

- Support modular agent responsibilities.
- Preserve human approval for all customer-facing responses.
- Ground generated responses in approved knowledge base content.
- Expose confidence, rationale, and source references for auditability.
- Allow mocked or simplified integrations for ticketing, customer metadata, and knowledge base sources.
- Keep the design extensible for future production integrations and additional agents.

### MVP Runtime Architecture

The MVP should use a simple runtime shape before introducing distributed infrastructure:

- Single backend application or service.
- Synchronous orchestration for one ticket at a time.
- Local or lightweight database storage for tickets, agent outputs, review packages, and decisions.
- Local knowledge base files or a simple knowledge table with source IDs and version metadata.
- Structured JSON logs for observability and evaluation.
- Simple UI, CLI, or API response for presenting the review package.

This runtime shape keeps the MVP implementable while preserving boundaries that can later evolve into asynchronous workers, production databases, and real ticketing integrations.

## 2. Logical Architecture

The system is organized into the following logical layers:

### Presentation Layer

Provides the support agent review experience.

Responsibilities:

- Display incoming ticket details.
- Display agent outputs in a single review package.
- Allow the support agent to approve, edit, reject, or regenerate response drafts.
- Allow routing and escalation recommendations to be accepted or overridden.
- Clearly separate AI-generated recommendations from human-approved decisions.

### Application and Workflow Layer

Coordinates ticket lifecycle and human review actions.

Responsibilities:

- Accept ticket intake requests.
- Start agent orchestration.
- Persist ticket state and agent outputs.
- Manage review package status.
- Record human feedback and overrides.

### Multi-Agent Orchestration Layer

Coordinates specialized agents and manages shared context.

Responsibilities:

- Determine agent execution order.
- Pass shared context and upstream outputs to downstream agents.
- Apply confidence gates and escalation rules.
- Handle partial failures and low-confidence outputs.
- Assemble final recommendations.

### Agent Layer

Contains specialized agents with clear responsibilities:

- Classification Agent.
- Knowledge Retrieval Agent.
- Sentiment Analysis Agent.
- Solution Generation Agent.
- Routing Agent.
- Escalation Agent.

### Data and Knowledge Layer

Stores ticket data, agent outputs, knowledge documents, retrieval results, human decisions, and operational logs.

Responsibilities:

- Maintain source ticket records.
- Store knowledge base content and metadata.
- Support retrieval over approved documentation.
- Preserve audit records for recommendations and human actions.

### Integration Layer

Provides adapters to external or mocked systems.

MVP adapters:

- Mock ticket source or email/ticket input.
- Mock customer metadata source.
- Local or simplified knowledge base source.

Future adapters:

- Zendesk.
- Intercom.
- Salesforce Service Cloud.
- HubSpot or Salesforce CRM.
- Internal documentation systems.

## 3. Multi-Agent Orchestration Design

The orchestration design uses a central Orchestrator Agent or orchestration service to manage the support workflow. The orchestrator is responsible for invoking specialized agents, maintaining context, and assembling outputs into a reviewable result.

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

### Confidence Gates

The orchestrator should apply confidence gates before advancing recommendations:

- Low classification confidence: flag for manual triage review.
- Low retrieval confidence: avoid definitive answer drafts and recommend manual response creation.
- High-risk sentiment: increase priority and pass stronger signal to Escalation Agent.
- Conflicting outputs: surface conflict in the review package instead of hiding it.
- Agent failure: continue with partial results when possible and recommend human review.

### Human Authority

Human decisions override agent recommendations. The system should store the original recommendation and the human action so future evaluation can measure acceptance, rejection, and override patterns.

## 4. Agent Communication Flow

Agent communication is mediated by the orchestrator through a shared structured context object. Agents should not directly call each other in the MVP. This keeps dependencies explicit and makes failures easier to isolate.

### Communication Sequence

1. Orchestrator receives `TicketContext`.
2. Classification Agent returns `ClassificationResult`.
3. Sentiment Analysis Agent returns `SentimentResult`.
4. Knowledge Retrieval Agent receives ticket content plus classification context and returns `RetrievalResult`.
5. Solution Generation Agent receives ticket content, classification, sentiment, and retrieval results, then returns `DraftResponse`.
6. Routing Agent receives ticket content, classification, sentiment, customer metadata, and retrieval confidence, then returns `RoutingRecommendation`.
7. Escalation Agent receives all prior outputs and returns `EscalationRecommendation`.
8. Orchestrator creates `ReviewPackage`.

### Communication Principles

- Agents communicate through structured inputs and outputs.
- Each agent output includes confidence, rationale, and status.
- The orchestrator owns workflow state.
- Downstream agents receive only the context they need.
- All recommendation-producing agents must support a low-confidence or unable-to-determine state.

### Agent Output Contracts

The orchestrator should normalize agent outputs into stable contracts:

| Agent | Output Contract | Required Fields |
| --- | --- | --- |
| Classification Agent | `ClassificationResult` | `category`, `intent`, `product_area`, `confidence`, `rationale`, `needs_manual_review` |
| Sentiment Analysis Agent | `SentimentResult` | `sentiment_label`, `urgency`, `risk_flags`, `confidence`, `rationale` |
| Knowledge Retrieval Agent | `RetrievalResult` | `sources`, `snippets`, `relevance_scores`, `retrieval_confidence`, `missing_knowledge` |
| Solution Generation Agent | `DraftResponse` | `draft_text`, `source_ids`, `confidence`, `safety_notes`, `sendable_after_human_review` |
| Routing Agent | `RoutingRecommendation` | `queue`, `confidence`, `rationale`, `manual_review_required` |
| Escalation Agent | `EscalationRecommendation` | `escalate`, `severity`, `target`, `reason`, `confidence` |

Stable contracts reduce coupling between agents and make logs, review packages, and evaluation easier to implement.

## 5. Shared Memory and Context Strategy

The MVP should use short-lived shared context for each ticket plus persistent storage for audit and evaluation.

### Short-Lived Execution Context

Used during a single orchestration run.

Contents:

- Ticket subject and body.
- Channel and timestamp.
- Customer metadata.
- Prior agent outputs.
- Retrieved knowledge snippets.
- Confidence scores.
- Runtime warnings or errors.

### Persistent Ticket Memory

Stored after orchestration completes.

Contents:

- Original ticket.
- Final review package.
- Agent outputs.
- Source references.
- Human edits and approvals.
- Routing and escalation overrides.
- Processing timestamps.

### Knowledge Memory

Used by the Knowledge Retrieval Agent.

Contents:

- Approved knowledge base articles.
- Article titles, sections, tags, and source IDs.
- Embeddings or search indexes where applicable.
- Last updated timestamp or version.

### Design Constraints

- The system should not use cross-ticket memory to generate customer-facing claims in the MVP unless the data is explicitly part of approved knowledge or provided customer metadata.
- Sensitive ticket content should not be included in unnecessary agent prompts.
- Memory should support auditability without retaining unnecessary secrets or credentials.

## 6. Knowledge Retrieval Strategy

Knowledge retrieval is the primary control against unsupported response generation. The system should use retrieval-augmented generation for answer drafting.

### MVP Retrieval Sources

- Local or mocked knowledge base articles.
- Product documentation excerpts.
- Internal support FAQ content.
- Policy snippets for billing, onboarding, and technical support.

### Retrieval Process

1. Normalize and index approved knowledge documents.
2. Use ticket subject, body, category, and intent as retrieval query inputs.
3. Retrieve top matching documents or snippets.
4. Rank results by relevance.
5. Return source IDs, titles, snippets, and relevance scores.
6. Pass only relevant retrieved content to the Solution Generation Agent.

### Retrieval Quality Controls

- If retrieval confidence is low, the system should not produce a definitive answer.
- Drafts should be traceable to retrieved source references.
- The review package should expose sources so the support agent can verify them.
- Knowledge documents should have version or source metadata for auditability.

### Source Governance

- Approved knowledge base articles should be preferred over historical tickets or unverified notes.
- Each source should include `source_id`, `title`, `version`, `updated_at`, and `approved` status.
- Stale documents should be flagged in retrieval results.
- Conflicting sources should trigger manual review or a cautious draft rather than a definitive answer.
- Retrieval should use a minimum confidence threshold before response drafting is considered reliable.

### Future Retrieval Enhancements

- Hybrid keyword and vector retrieval.
- Product-area-specific indexes.
- Permission-aware retrieval.
- Feedback-based retrieval tuning.
- Integration with live help center content.

## 7. Escalation Workflow

The Escalation Agent evaluates whether a ticket requires priority handling or specialist involvement.

### Escalation Inputs

- Ticket category.
- Classification confidence.
- Sentiment and urgency.
- Customer metadata such as account tier or strategic status.
- Retrieval confidence.
- Routing recommendation.
- Ticket complexity indicators.
- Sensitive phrases such as cancellation, legal threat, data loss, outage, payment failure, or repeated unresolved issue.

### Escalation Outcomes

- No escalation required.
- Escalate to support team lead.
- Escalate to technical specialist.
- Escalate to billing specialist.
- Escalate to onboarding team.
- Escalate to customer success manager.
- Manual review required due to low confidence or conflicting signals.

### Severity Levels

| Severity | Meaning | Example Triggers |
| --- | --- | --- |
| P0 | Critical customer or business risk | Outage, data loss, security issue, executive escalation, legal threat |
| P1 | High priority | Strategic account blocked, cancellation threat, repeated unresolved issue, severe frustration |
| P2 | Standard support issue | Billing question, normal technical issue, onboarding blocker without strategic risk |
| P3 | Low-risk request | General product question, feature request, informational request |
| Manual Review | Confidence or policy concern | Conflicting signals, low retrieval confidence, ambiguous category |

Severity should be included in the `EscalationRecommendation` and surfaced in the review package.

### Escalation Rules

The MVP should support rule-guided escalation combined with agent judgment:

- High-risk sentiment increases escalation likelihood.
- Low confidence in classification or retrieval triggers manual review.
- Billing, cancellation, data loss, outage, and strategic customer issues receive stricter review.
- Complex technical issues with insufficient knowledge evidence should be escalated rather than answered definitively.

### Human Review

Escalation recommendations must be visible to support agents or managers, who can accept or dismiss them. Overrides should be recorded for later quality evaluation.

## 8. External Integrations

The MVP uses simplified or mocked integrations to reduce implementation complexity while preserving realistic architecture boundaries.

### MVP Integrations

| Integration | MVP Approach | Purpose |
| --- | --- | --- |
| Ticket source | Mock ticket input, fixture data, or simple form/API | Simulate email and ticket intake |
| Customer metadata | Mock customer/account records | Support routing and escalation decisions |
| Knowledge base | Local markdown, JSON, CSV, or simple indexed store | Ground retrieval and response drafting |
| Human review surface | Simple application UI, CLI, or API response | Present review package |
| Logging store | File, database table, or structured logs | Support audit and evaluation |

### Future Production Integrations

- Zendesk ticket intake, updates, tags, and internal notes.
- Intercom conversations and help center content.
- Salesforce Service Cloud cases.
- CRM account metadata from Salesforce or HubSpot.
- Authentication provider and enterprise SSO.
- Data warehouse or BI export for analytics.

### Integration Design Principles

- Use adapter interfaces around external systems.
- Keep core orchestration independent from vendor-specific APIs.
- Treat external system failures as recoverable where possible.
- Never allow integrations to send customer-facing responses without explicit human approval.

## 9. High-Level Data Model

The MVP data model should support ticket processing, agent outputs, human decisions, and auditability.

### Core Entities

#### Ticket

Represents the original customer request.

Fields:

- `ticket_id`.
- `subject`.
- `body`.
- `channel`.
- `customer_id`.
- `created_at`.
- `status`.

#### CustomerAccount

Represents simplified customer or account metadata.

Fields:

- `customer_id`.
- `company_name`.
- `account_tier`.
- `account_status`.
- `assigned_csm`.
- `risk_level`.

#### KnowledgeDocument

Represents approved support knowledge.

Fields:

- `document_id`.
- `title`.
- `body`.
- `tags`.
- `source`.
- `version`.
- `updated_at`.

#### AgentRun

Represents one agent execution.

Fields:

- `agent_run_id`.
- `ticket_id`.
- `agent_name`.
- `input_summary`.
- `output_payload`.
- `confidence`.
- `status`.
- `error_message`.
- `started_at`.
- `completed_at`.

#### ReviewPackage

Represents the consolidated output shown to a human.

Fields:

- `review_package_id`.
- `ticket_id`.
- `classification_result`.
- `sentiment_result`.
- `retrieval_result`.
- `draft_response`.
- `routing_recommendation`.
- `escalation_recommendation`.
- `overall_status`.
- `created_at`.

Recommended lifecycle statuses:

- `received`.
- `processing`.
- `ready_for_review`.
- `needs_manual_review`.
- `approved`.
- `rejected`.
- `routed`.
- `escalated`.
- `closed`.

#### HumanDecision

Represents support agent or manager actions.

Fields:

- `decision_id`.
- `ticket_id`.
- `user_id`.
- `action_type`.
- `original_recommendation`.
- `final_value`.
- `notes`.
- `created_at`.

#### AuditLog

Represents notable system events.

Fields:

- `event_id`.
- `ticket_id`.
- `actor_type`.
- `actor_id`.
- `event_type`.
- `event_payload`.
- `created_at`.

## 10. Security and Privacy Considerations

Support tickets may contain personal data, confidential customer details, product logs, credentials, or sensitive business context. The architecture should minimize unnecessary exposure and preserve control over customer-facing actions.

### Security Principles

- Store only data required for ticket processing, review, and evaluation.
- Avoid collecting credentials, payment details, secrets, or unnecessary personal data.
- Redact or flag sensitive patterns where possible.
- Limit agent context to the minimum data required for each task.
- Preserve human approval before any external customer communication.
- Keep audit records for AI recommendations and human overrides.

### AI-Specific Safety Controls

- Treat customer ticket text as untrusted input.
- Do not allow customer-provided instructions to override system, developer, safety, routing, escalation, or response-generation policies.
- Do not reveal hidden prompts, internal policies, unrelated customer data, or confidential operational instructions.
- Redact or flag likely secrets, credentials, payment data, or sensitive personal data before unnecessary agent processing where feasible.
- Require source-grounded response generation for customer-facing drafts.
- If a ticket appears to contain prompt injection or malicious instructions, surface the risk in the review package and continue with constrained processing.

### MVP Controls

- Use mocked or sanitized customer metadata.
- Use approved knowledge sources only.
- Do not allow agents to perform account modifications.
- Do not allow automatic refunds, credits, cancellations, or policy exceptions.
- Record when a draft was AI-generated and when a human approved or changed it.

### Future Controls

- Role-based access control.
- Enterprise SSO.
- Tenant isolation.
- Encryption at rest and in transit.
- PII redaction pipeline.
- Data retention policies.
- Permission-aware knowledge retrieval.

## 11. Observability and Logging

Observability is required to evaluate agent quality, diagnose failures, and support trust in the system.

### Logs to Capture

- Ticket intake event.
- Orchestration start and completion.
- Agent start, completion, failure, latency, and confidence.
- Retrieved source IDs and relevance scores.
- Draft generation status.
- Routing and escalation recommendations.
- Human approval, edit, rejection, route override, and escalation override.
- Errors, timeouts, and fallback behavior.

### Metrics to Track

- Ticket processing volume.
- Agent latency by role.
- Agent failure rate.
- Classification confidence distribution.
- Retrieval hit rate.
- Draft acceptance rate.
- Routing override rate.
- Escalation acceptance and dismissal rate.
- Low-confidence ticket rate.
- Safety violation rate.
- Prompt-injection detection count.
- Retrieval source coverage against expected source IDs.

### Traceability

Each ticket should have a correlation ID or ticket ID that connects:

- Original input.
- Agent runs.
- Retrieved knowledge.
- Review package.
- Human decisions.
- Audit events.

## 12. Scalability and Reliability Considerations

The MVP can begin with synchronous orchestration, but the architecture should allow future asynchronous processing as ticket volume grows.

### Scalability Considerations

- Keep agents stateless where possible.
- Store shared context externally rather than in process memory only.
- Use adapter boundaries for external integrations.
- Support independent scaling of retrieval and generation workloads in future versions.
- Design agent inputs and outputs as structured payloads to allow queue-based execution later.

### Reliability Considerations

- Agent failure should not fail the entire ticket when partial output is still useful.
- The orchestrator should mark incomplete or failed agent outputs clearly.
- Low-confidence results should default to human review.
- Retrieval failure should prevent unsupported response generation.
- External integration failures should be logged and surfaced.
- Human-approved decisions should be persisted reliably.

### Future Reliability Enhancements

- Asynchronous job queue for ticket processing.
- Retry policies with bounded retries.
- Dead-letter queue for failed orchestration runs.
- Circuit breakers around external APIs.
- Health checks for integration adapters.
- Evaluation test sets for regression testing agent quality.

### MVP Evaluation Dataset

The MVP should include a small labeled dataset used for validation and regression checks.

Dataset characteristics:

- 10 to 20 representative English B2B SaaS tickets.
- Expected category and routing queue.
- Expected sentiment or urgency label.
- Expected escalation decision and severity.
- Expected knowledge source IDs where KB coverage exists.
- Human rubric for draft usefulness, correctness, tone, and safety.

This dataset makes the MVP success metrics measurable and prevents the system from relying only on anecdotal demo quality.

## 13. Key Technical Decisions and Rationale

### Decision 1: Use Centralized Orchestration

Decision:

Use a central orchestrator to coordinate all specialized agents.

Rationale:

This keeps workflow control explicit, simplifies auditability, avoids hidden agent-to-agent dependencies, and supports confidence gates between steps.

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

## 14. Architecture Summary

The system architecture is a modular, orchestrated, human-in-the-loop AI support workflow. A central orchestrator coordinates specialized agents, stores structured outputs, grounds response drafts in approved knowledge, and presents a consolidated review package to support agents.

The design is high-level enough for the Define phase but directly implementable in later phases using a web app, API service, local knowledge store, structured logs, and mocked integrations. It also leaves clear extension points for production ticketing systems, CRM metadata, permission-aware retrieval, asynchronous processing, and enterprise security controls.
