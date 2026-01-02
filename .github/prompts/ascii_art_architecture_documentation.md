# ASCII Art Architecture Documentation Generator

## Prompt Purpose
Generate comprehensive architecture documentation using ASCII art diagrams to visualize flows, hierarchies, and module dependencies throughout technical documentation.

## When to Use This Prompt
- Creating or updating architecture documentation for complex software projects
- Documenting LSP (Language Server Protocol) implementations
- Visualizing data flow, module dependencies, and system interactions
- Creating developer onboarding documentation that needs clear visual representation

## Prompt Instructions

### Objective
Create comprehensive architecture documentation that uses ASCII art box diagrams to visualize flows and hierarchies, while maintaining structured tables for data reference. The documentation should be both visually appealing and highly informative.

### Key Requirements

#### 1. ASCII Art Diagram Expansion
- **Keep original ASCII box diagrams** if they exist (diagnostics pipeline, domain validators, etc.)
- **Add NEW comprehensive ASCII art diagrams** for major architectural sections:
  - High-Level Architecture flow diagram showing client-server communication
  - Document/Request Lifecycle flow (open, change, close events)
  - Processing pipelines with context detection and routing
  - Feature coordination and data flow
  - Complete Module Dependency Structure (all modules visualized hierarchically)

#### 2. Visual Flow Representation
All flowcharts and hierarchies should use ASCII box drawing characters to create clear visual representations:
- **Box characters**: `┌─`, `│`, `└─`, `├─`, `┤`, `┬`, `┴`, `┼`
- **Arrows**: `→`, `←`, `↑`, `↓`, `►`, `◄`, `▼`, `▲`
- **Visual elements**: Use these to show:
  - Data flow through the system
  - Module dependencies and relationships
  - Pipeline processing steps
  - Feature coordination and routing
  - Request/response cycles

#### 3. Module Documentation Structure
- **Maintain structured tables** for data reference (diagnostic codes, token types, configuration options, etc.)
- **Add comprehensive module summary table** with dependencies
- **Document ALL modules** organized by category:
  - Core infrastructure modules
  - Feature implementation modules
  - Domain-specific validators
  - Support and utility modules

#### 4. Coverage Requirements
Ensure complete documentation of:
- **Core modules**: Main entry points, parsers, indexers, state managers
- **Feature modules**: All LSP features or main application features
- **Domain validators**: Specific business logic validators
- **Validation modules**: Style checks, best practices, performance analyzers
- **Support modules**: Utilities, workspace operations, configuration

#### 5. ASCII Art Design Patterns

##### Pattern 1: High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        [System Name] Architecture                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────┐                                                     │
│  │  Client Layer  │  ◄──── Communication Protocol ────►                 │
│  │  (External)    │                                                     │
│  └────────┬───────┘                                                     │
│           │                                                             │
│           │ Requests (specific types)                                  │
│           ▼                                                             │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │            Main Server/Handler Component                   │        │
│  │  (Core orchestration)                                      │        │
│  ├────────────────────────────────────────────────────────────┤        │
│  │  State Management:                                         │        │
│  │    • State item 1                                          │        │
│  │    • State item 2                                          │        │
│  │    • State item 3                                          │        │
│  └────────────────────┬───────────────────────────────────────┘        │
│                       │                                                 │
│                       │ Delegates to feature modules                   │
│                       ▼                                                 │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │  Feature Modules: module1, module2, module3                │        │
│  └────────────────────────────────────────────────────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

##### Pattern 2: Processing Pipeline
```
┌─────────────────────────────────────────────────────────────────────────┐
│                      [Pipeline Name] Flow                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input Event/Request received                                          │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ Step 1: Initial Processing                                │          │
│  │    specific_function() → what it does                     │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ Step 2: Intermediate Processing                           │          │
│  │                                                           │          │
│  │  Branch A ──► Condition met → Action A                   │          │
│  │  Branch B ──► Condition met → Action B                   │          │
│  │  Branch C ──► Default → Action C                         │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ Step 3: Final Output                                      │          │
│  │    result_function() → return formatted response          │          │
│  └──────────────────────────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  Output returned to caller                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

##### Pattern 3: Module Dependency Hierarchy
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    [Project Name] Module Architecture                   │
│                         (N Total Modules)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │                  main_module.py (Core)                    │          │
│  │          Primary Entry Point & Orchestration              │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│         ┌─────────────┼─────────────┬──────────────────┐               │
│         │             │             │                  │               │
│         ▼             ▼             ▼                  ▼               │
│  ┌────────────┐ ┌───────────┐ ┌──────────┐  ┌──────────────┐         │
│  │ module1.py │ │module2.py │ │module3.py│  │  module4.py  │         │
│  │  (Type)    │ │  (Type)   │ │  (Type)  │  │    (Type)    │         │
│  ├────────────┤ ├───────────┤ ├──────────┤  ├──────────────┤         │
│  │• Function1 │ │• Function │ │• Function│  │• Function    │         │
│  │• Function2 │ │  roles    │ │  roles   │  │  roles       │         │
│  │• Purpose   │ │• Purpose  │ │• Purpose │  │• Purpose     │         │
│  └────────────┘ └───────────┘ └──────────┘  └──────────────┘         │
│         │             │              │                                  │
│         │             └──────┬───────┘                                 │
│         │                    │                                         │
│         ▼                    ▼                                         │
│  ┌──────────────────────────────────────────┐                         │
│  │  Supporting/Dependency Modules            │                         │
│  │  • support_module1.py (purpose)           │                         │
│  │  • support_module2.py (purpose)           │                         │
│  │  • support_module3.py (purpose)           │                         │
│  └──────────────────────────────────────────┘                         │
│                                                                         │
│  Module Count Summary:                                                 │
│  • Category 1: N modules (list types)                                 │
│  • Category 2: N modules (list types)                                 │
│  • Category 3: N modules (list types)                                 │
│  ─────────────────────────────────────────────────────────────         │
│  Total: N modules                                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

##### Pattern 4: Feature Request Routing
```
┌─────────────────────────────────────────────────────────────────────────┐
│                  [Feature Name] System Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User triggers action: [specific trigger]                              │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ 1. Context Detection                                      │          │
│  │    • Detect current state/position                        │          │
│  │    • Gather relevant information                          │          │
│  │    • Determine applicable handlers                        │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ 2. Route to appropriate handler                           │          │
│  │                                                           │          │
│  │  Type A ──► Handler A                                    │          │
│  │             └─ Fetch data from source A                  │          │
│  │                                                           │          │
│  │  Type B ──► Handler B                                    │          │
│  │             └─ Fetch data from source B                  │          │
│  │                                                           │          │
│  │  Type C ──► Handler C                                    │          │
│  │             └─ Fetch data from source C                  │          │
│  │                                                           │          │
│  │  Default ──► Fallback handler                            │          │
│  │              └─ Generic handling                         │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ 3. Process & Filter Results                               │          │
│  │    • Apply context-specific filtering                     │          │
│  │    • Sort and rank results                                │          │
│  │    • Format for presentation                              │          │
│  └────────────────────┬─────────────────────────────────────┘          │
│                       │                                                 │
│                       ▼                                                 │
│  Return formatted results to user                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6. Documentation Sections Template

Your final documentation should include these sections (adapt as needed):

1. **Title & Introduction**
   - Clear title stating the system name
   - Brief description of what the document illustrates

2. **High-Level Architecture** (with ASCII diagram)
   - Visual representation of the overall system structure
   - Client-server or component interactions
   - State management overview

3. **Core Component Lifecycles** (with ASCII diagrams)
   - Document/request lifecycle flows
   - State transitions
   - Event handling pipelines

4. **Feature-Specific Flows** (with ASCII diagrams for each major feature)
   - Completion/suggestion systems
   - Validation/diagnostics pipelines
   - Navigation and reference resolution
   - Any other major features

5. **Module Reference Tables**
   - Organized by category (Core, Features, Validators, Support)
   - Module name, purpose, key functions/classes
   - Dependencies between modules

6. **Data Structures**
   - Key data structures used throughout the system
   - Format as tables for quick reference

7. **Event/Request Flow Summary**
   - Summary table of all major events/requests
   - Quick reference for what happens at each stage

8. **Complete Module Dependency Structure** (with comprehensive ASCII diagram)
   - Visual hierarchy of all modules
   - Show dependencies with connecting lines
   - Categorize and count modules
   - Include summary statistics

9. **Module Summary Table**
   - Comprehensive table listing ALL modules
   - Include: Module name, Category, Primary function, Dependencies

### 7. ASCII Art Best Practices

- **Width**: Keep diagrams within 75-77 characters wide for readability
- **Clarity**: Use consistent spacing and alignment
- **Hierarchy**: Show parent-child relationships clearly with indentation and connecting lines
- **Flow direction**: Use arrows to show data/control flow direction
- **Grouping**: Use boxes to group related components
- **Labels**: Always label major components and sections
- **Balance**: Mix ASCII diagrams (for flows/hierarchies) with tables (for structured data)

### 8. Final Output Format

- **File format**: Markdown (.md)
- **Code blocks**: Wrap ASCII diagrams in triple backticks (```)
- **Headers**: Use appropriate header levels (##, ###)
- **Tables**: Use markdown tables for structured data reference
- **Emojis**: Use section emojis for visual organization (🏗️, 📄, 🔍, 💡, 🎨, 🔗, 🏛️, 📊)
- **Separators**: Use `---` for section breaks

### 9. Example Output Structure

```markdown
# [System Name] Architecture & Analysis Flow

This document illustrates the chain of events and data flow for [system description].

---

## 🏗️ High-Level Architecture

[ASCII diagram showing overall architecture]

[Supporting table with component details]

---

## 📄 [Component] Lifecycle

[ASCII diagram showing lifecycle flow]

### 1. [Event Name]

[Table with step-by-step details]

---

## 🔍 [Feature Name] Pipeline

[ASCII diagram showing feature processing]

[Supporting tables and details]

---

[Continue with additional sections...]

---

## 🏛️ Complete Module Dependency Structure

[Comprehensive ASCII diagram of all modules]

---

## 📊 Module Summary Table

[Complete table of all modules with dependencies]
```

## Usage Instructions

1. **Identify the codebase**: Understand the project structure, main entry points, and module organization
2. **Categorize modules**: Group modules by function (Core, Features, Validators, etc.)
3. **Map dependencies**: Understand how modules depend on each other
4. **Identify flows**: Determine the key data flows and processing pipelines
5. **Apply patterns**: Use the ASCII art patterns above for each major section
6. **Create diagrams**: Build comprehensive ASCII diagrams for all major architectural elements
7. **Add tables**: Supplement with structured tables for reference data
8. **Review**: Ensure all modules are documented and all flows are visualized
9. **Format**: Clean up formatting, ensure consistency, and verify markdown rendering

## Expected Outcome

A comprehensive architecture document (typically 700-900+ lines) that:
- Uses ASCII art diagrams extensively to visualize flows and hierarchies
- Maintains tables for structured data reference
- Documents all modules in the project
- Provides clear visual representation of system architecture
- Serves as an excellent onboarding and reference document for developers
- Balances visual appeal with technical accuracy and completeness

## Quality Checklist

- [ ] All major architectural components have ASCII diagrams
- [ ] Processing flows are visualized with clear step-by-step boxes
- [ ] Module dependencies are shown in hierarchical ASCII structure
- [ ] All modules are listed in summary table with dependencies
- [ ] ASCII diagrams use consistent box drawing characters
- [ ] Arrows clearly show data/control flow direction
- [ ] Tables complement (not duplicate) diagram information
- [ ] Document is well-organized with clear sections
- [ ] Headers use appropriate emoji for visual navigation
- [ ] Width of diagrams fits readable line length (75-77 chars)
- [ ] Code blocks are properly formatted with triple backticks
- [ ] Document includes comprehensive coverage of the codebase
