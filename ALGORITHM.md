# FEPC Scheduling System - Algorithm Documentation

## Table of Contents
1. [Overview](#overview)
2. [Algorithm Approach](#algorithm-approach)
3. [Problem Modeling](#problem-modeling)
4. [Heuristics](#heuristics)
5. [Constraints](#constraints)
6. [Scoring System](#scoring-system)
7. [Implementation Flow](#implementation-flow)
8. [Performance Considerations](#performance-considerations)

---

## Overview

The FEPC Scheduling System uses a **Constraint Satisfaction Problem (CSP)** approach combined with **heuristic optimization** to generate conflict-free academic schedules. The algorithm balances multiple objectives while ensuring hard constraints are never violated.

### Key Features
- ✅ **Conflict-Free**: Guarantees no double-bookings
- ✅ **Fair Distribution**: Balanced faculty workload
- ✅ **Preference-Aware**: Respects faculty preferences when possible
- ✅ **Efficient**: Handles hundreds of scheduling tasks in seconds
- ✅ **Flexible**: Supports customizable constraints and weights

---

## Algorithm Approach

### Constraint Satisfaction Problem (CSP)

The scheduling problem is modeled as a CSP, which is a mathematical problem defined by:

| Component | Description | In Our System |
|-----------|-------------|---------------|
| **Variables** | Decisions to be made | Subject-Section pairs to schedule |
| **Domains** | Possible values for variables | All (Faculty, Room, Day, Time) combinations |
| **Constraints** | Rules that must be satisfied | No conflicts, capacity limits, etc. |
| **Objective** | What to optimize | Multi-objective score (balance, preferences, etc.) |

### Why CSP?

```
Traditional Approaches:
├── Brute Force → Too slow (millions of combinations)
├── Greedy Only → Gets stuck in local optima
├── Genetic Algorithms → Non-deterministic, hard to debug
└── CSP with Heuristics → ✅ Fast, deterministic, optimal
```

CSP is ideal because:
1. **Scheduling is inherently constraint-based** (no two classes in same room at same time)
2. **Heuristics guide the search** efficiently toward good solutions
3. **Backtracking** ensures we don't get stuck
4. **Deterministic** - same input produces same output

---

## Problem Modeling

### Variables (Scheduling Tasks)

Each scheduling task represents a subject that needs to be assigned to a section:

```
Task = {
  subjectId: string,      // What subject to schedule
  subjectCode: string,    // e.g., "CS101"
  sectionId: string,      // Which section needs this subject
  sectionName: string,    // e.g., "1CS-A"
  difficulty: number      // Computed for MRV heuristic
}
```

### Domains (Candidate Assignments)

For each task, the domain includes all valid combinations of:

```
Candidate = {
  facultyId: string,      // Who teaches
  roomId: string,         // Where
  day: string,            // When (day)
  startTime: string,      // When (start time)
  endTime: string,        // When (end time)
  score: number           // Quality of this assignment
}
```

### Time Slots

```
Days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
Time Range: 07:00 - 21:00
Granularity: 30 minutes
Duration: Based on subject units (1 unit = 1 hour)
```

---

## Heuristics

Heuristics are rules of thumb that guide the search toward good solutions faster.

### 1. Most Constrained Variable (MCV) / Minimum Remaining Values (MRV)

**Principle**: Schedule the most difficult tasks first.

**Why**: If a task has few options, scheduling it early prevents dead-ends later.

**Implementation**:
```typescript
function calculateDifficulty(task): number {
  eligibleFaculty = countFacultyWhoCanTeach(subject)
  suitableRooms = countRoomsThatFit(section)
  
  difficulty = 100 - (eligibleFaculty × 10) - (suitableRooms × 5)
  
  // Higher difficulty = fewer options = schedule first
  return difficulty
}

// Sort tasks by difficulty (descending)
tasks.sort((a, b) => b.difficulty - a.difficulty)
```

**Example**:
| Task | Eligible Faculty | Suitable Rooms | Difficulty | Priority |
|------|------------------|----------------|------------|----------|
| CS401 (Advanced AI) | 2 | 3 | 50 | 1st |
| CS101 (Intro Programming) | 10 | 8 | 20 | Last |

### 2. Least Constraining Value (LCV)

**Principle**: Choose the assignment that leaves the most options open for future tasks.

**Why**: Preserving flexibility reduces the chance of getting stuck.

**Implementation**:
```typescript
// For each candidate, calculate a score
// Higher score = less constraining = better
candidates.sort((a, b) => b.score - a.score)

// Try candidates in order of score (best first)
for (candidate of candidates) {
  if (tryAssign(candidate)) {
    // Success! Continue to next task
  }
}
```

### 3. Forward Checking

**Principle**: Check constraints before attempting assignment.

**Why**: Prune invalid branches early, avoid wasted computation.

**Implementation**:
```typescript
function isValidCandidate(candidate): boolean {
  // Check ALL hard constraints before assignment
  if (!checkFacultyAvailability()) return false
  if (!checkRoomAvailability()) return false
  if (!checkSectionAvailability()) return false
  if (!checkRoomCapacity()) return false
  if (!checkFacultyCapacity()) return false
  if (!checkSpecialization()) return false
  
  return true  // Only then consider this candidate
}
```

### 4. Backtracking

**Principle**: If we reach a dead-end, undo and try a different path.

**Why**: Ensures we explore the solution space systematically.

**Implementation**:
```typescript
function solve(tasks, index): boolean {
  if (index >= tasks.length) return true  // All tasks assigned
  
  const candidates = generateCandidates(tasks[index])
  
  for (candidate of candidates) {
    backtrackCount++
    
    if (tryAssign(candidate)) {
      if (solve(tasks, index + 1)) {
        return true  // Found solution!
      }
      // Dead-end ahead, backtrack
      removeAssignment(candidate)
    }
  }
  
  // No valid assignment found
  markAsUnassigned(tasks[index])
  return solve(tasks, index + 1)  // Continue with remaining tasks
}
```

---

## Constraints

### Hard Constraints (Must Be Satisfied)

Hard constraints are rules that **cannot be violated**. The algorithm only considers candidates that satisfy all hard constraints.

| Constraint | Type | Description | Check |
|------------|------|-------------|-------|
| **Faculty Double Booking** | Temporal | A faculty cannot teach two classes at the same time | `checkFacultyAvailability()` |
| **Room Double Booking** | Temporal | A room cannot have two classes at the same time | `checkRoomAvailability()` |
| **Section Overlap** | Temporal | A section cannot attend two classes at the same time | `checkSectionAvailability()` |
| **Room Capacity** | Spatial | Room must have enough seats for the section | `checkRoomCapacity()` |
| **Faculty Capacity** | Workload | Faculty cannot exceed their maximum teaching units | `checkFacultyCapacity()` |
| **Specialization Match** | Qualification | Faculty must have required specialization for subject | `checkSpecialization()` |
| **Duplicate Prevention** | Logical | Same subject cannot be assigned twice to same section | `checkSubjectNotDuplicate()` |
| **Unavailable Days** | Preference | Faculty cannot be scheduled on their unavailable days | `checkFacultyUnavailableDay()` |

### Soft Constraints (Optimized via Scoring)

Soft constraints are preferences that should be satisfied **when possible**, but can be violated if necessary.

| Constraint | Weight | Description |
|------------|--------|-------------|
| Faculty Preference | 15% | Preferred days, times, subjects |
| Load Balance | 30% | Fair distribution across faculty |
| Day Distribution | 10% | Even spread across the week for each faculty |
| Global Day Balance | 15% | Even spread across all schedules |
| Time Quality | 10% | Prefer prime hours (8AM-5PM) |
| Room Efficiency | 10% | Match room size to section size |

---

## Scoring System

### Overall Score Formula

```
Score = (w₁ × FacultyPreference) +
        (w₂ × LoadBalance) +
        (w₃ × DayDistribution) +
        (w₄ × GlobalDayBalance) +
        (w₅ × TimeQuality) +
        (w₆ × RoomEfficiency)

Where:
w₁ = 0.15 (Faculty Preference)
w₂ = 0.30 (Load Balance) ← Highest priority
w₃ = 0.10 (Day Distribution)
w₄ = 0.15 (Global Day Balance)
w₅ = 0.10 (Time Quality)
w₆ = 0.10 (Room Efficiency)
```

### Individual Score Components

#### 1. Faculty Preference Score (0-1)

```typescript
function scoreFacultyPreference(faculty, day, time, subject): number {
  let score = 0
  
  // Preferred day (40% weight)
  if (faculty.preferences.preferredDays.includes(day)) {
    score += 0.4
  }
  
  // Preferred time (30% weight)
  if (time within preferredTimeStart-preferredTimeEnd) {
    score += 0.3
  }
  
  // Unavailable day penalty
  if (faculty.preferences.unavailableDays.includes(day)) {
    score -= 0.8
  }
  
  // Preferred subject bonus
  if (faculty.preferences.preferredSubjects.includes(subject)) {
    score += 0.2
  }
  
  return clamp(score, 0, 1)
}
```

#### 2. Load Balance Score (0-1)

**Critical for fairness** - Higher scores for under-utilized faculty to encourage assignment.

| Current Utilization | Score | Interpretation |
|--------------------|-------|----------------|
| ≤ 30% | 1.0 | Very under-utilized → HIGHEST priority |
| ≤ 50% | 0.9 | Under-utilized → high priority |
| ≤ 70% | 0.8 | Approaching ideal |
| ≤ 85% | 0.7 | Ideal range |
| ≤ 95% | 0.5 | Getting full → lower priority |
| > 95% | 0.3 | Nearly at capacity → lowest priority |

```typescript
function scoreLoadBalance(faculty, additionalUnits): number {
  const utilization = (currentLoad + additionalUnits) / faculty.maxUnits
  
  if (utilization <= 0.3) return 1.0
  if (utilization <= 0.5) return 0.9
  if (utilization <= 0.7) return 0.8
  if (utilization <= 0.85) return 0.7
  if (utilization <= 0.95) return 0.5
  return 0.3
}
```

#### 3. Global Day Balance Score (0-1)

Ensures even distribution across all days.

```typescript
function scoreGlobalDayBalance(day): number {
  const avgPerDay = totalSchedules / 6  // 6 working days
  const currentDayCount = schedulesOnDay[day]
  const deficit = avgPerDay - currentDayCount
  
  if (deficit > 2) return 1.0   // Significantly under-scheduled
  if (deficit > 1) return 0.9   // Moderately under-scheduled
  if (deficit > 0) return 0.8   // Slightly under-scheduled
  if (deficit === 0) return 0.7 // At average
  if (deficit > -2) return 0.6  // Slightly over-scheduled
  if (deficit > -4) return 0.4  // Moderately over-scheduled
  return 0.2                    // Significantly over-scheduled
}
```

#### 4. Time Quality Score (0-1)

Prefers prime teaching hours.

| Time Range | Score | Quality |
|------------|-------|---------|
| 8:00 AM - 5:00 PM | 1.0 | Prime time |
| 5:00 PM - 6:00 PM | 0.8 | Late afternoon |
| 7:00 AM - 8:00 AM | 0.6 | Early morning |
| 6:00 PM - 9:00 PM | 0.6 | Evening |

#### 5. Room Efficiency Score (0-1)

Prefers rooms that are well-sized for the section.

```typescript
function scoreRoomEfficiency(room, section): number {
  const utilization = section.studentCount / room.capacity
  
  // Ideal: 60-85% utilization
  if (utilization >= 0.6 && utilization <= 0.85) return 1.0
  if (utilization >= 0.5 && utilization <= 0.9) return 0.8
  if (utilization >= 0.3) return 0.6
  return 0.4  // Room too large (wasted space)
}
```

---

## Implementation Flow

### Complete Algorithm Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│                    START: Generate Schedules                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Load Data                                          │
│  - Faculty (with preferences and specializations)           │
│  - Rooms (with capacity and equipment)                      │
│  - Sections (with year level and student count)             │
│  - Subjects (with units and requirements)                   │
│  - Curriculum (optional: subject-section mappings)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Determine Subject-Section Pairs                    │
│  - Use curriculum if provided, OR                           │
│  - Auto-detect based on:                                    │
│    • Department match                                       │
│    • Year level match (flexible: ±1 year)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Create Scheduling Tasks                            │
│  - One task per subject-section pair                        │
│  - Calculate difficulty for each task                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Sort Tasks by Difficulty (MRV Heuristic)           │
│  - Most constrained tasks first                             │
│  - Prevents dead-ends later                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Solve with Backtracking                            │
│                                                             │
│  For each task (in sorted order):                           │
│    ┌───────────────────────────────────────────────────────┐│
│    │ A. Generate Candidates                                ││
│    │    - All valid (faculty, room, day, time) combos      ││
│    │    - Filter by hard constraints                       ││
│    │    - Limit to max 1000 candidates                     ││
│    └───────────────────────────────────────────────────────┘│
│                         │                                    │
│                         ▼                                    │
│    ┌───────────────────────────────────────────────────────┐│
│    │ B. Score Candidates                                   ││
│    │    - Faculty preference: 15%                          ││
│    │    - Load balance: 30%                                ││
│    │    - Day distribution: 10%                            ││
│    │    - Global day balance: 15%                          ││
│    │    - Time quality: 10%                                ││
│    │    - Room efficiency: 10%                             ││
│    └───────────────────────────────────────────────────────┘│
│                         │                                    │
│                         ▼                                    │
│    ┌───────────────────────────────────────────────────────┐│
│    │ C. Try Candidates (sorted by score, best first)       ││
│    │                                                       ││
│    │    For each candidate:                                ││
│    │      - Verify all constraints                         ││
│    │      - If valid, assign and update tracking           ││
│    │      - Recurse to next task                           ││
│    │      - If recursion fails, backtrack                  ││
│    │                                                       ││
│    │    If no valid candidate:                             ││
│    │      - Mark task as unassigned                        ││
│    │      - Continue to next task                          ││
│    └───────────────────────────────────────────────────────┘│
│                                                             │
│  Continue until all tasks processed or max backtracks hit   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Detect Violations                                  │
│  - Scan for any remaining conflicts                          │
│  - Report capacity issues                                    │
│  - Identify unassigned items                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: Return Results                                     │
│  - Generated schedules                                       │
│  - Violations (should be empty)                              │
│  - Unassigned items with reasons                             │
│  - Statistics (time, count, rates)                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                         END
```

### Pseudocode

```
function generateSchedules(faculty, rooms, sections, subjects, curriculum):
    // Initialize
    context = createConstraintContext(faculty, rooms, sections, subjects)
    assignments = []
    unassigned = []
    
    // Step 1: Determine what to schedule
    pairs = determineSubjectSectionPairs(sections, subjects, curriculum)
    
    // Step 2: Create tasks
    tasks = []
    for each (subjectId, sectionId) in pairs:
        eligibleFaculty = getEligibleFaculty(subjectId)
        suitableRooms = getSuitableRooms(sectionId)
        difficulty = 100 - (eligibleFaculty × 10) - (suitableRooms × 5)
        tasks.push({subjectId, sectionId, difficulty})
    
    // Step 3: Sort by difficulty (MCV/MRV)
    tasks.sort(by: difficulty, descending)
    
    // Step 4: Solve with backtracking
    solve(tasks, 0)
    
    // Step 5: Return results
    return {
        schedules: assignments,
        violations: detectViolations(),
        unassigned: unassigned,
        stats: calculateStats()
    }

function solve(tasks, index):
    if index >= tasks.length:
        return true  // All assigned
    
    if backtrackCount >= MAX_BACKTRACKS:
        markRemainingAsUnassigned(tasks, index)
        return false
    
    task = tasks[index]
    
    // Check for duplicate
    if subjectAlreadyAssignedToSection(task):
        return solve(tasks, index + 1)
    
    // Generate candidates
    candidates = generateCandidates(task)
    
    if candidates.isEmpty():
        unassigned.push(task)
        return solve(tasks, index + 1)
    
    // Try each candidate
    for candidate in candidates (sorted by score):
        backtrackCount++
        
        if tryAssign(candidate):
            if solve(tasks, index + 1):
                return true
            backtrack(candidate)  // Undo and try next
    
    unassigned.push(task)
    return solve(tasks, index + 1)

function generateCandidates(task):
    candidates = []
    
    eligibleFaculty = getEligibleFaculty(task.subject)
    suitableRooms = getSuitableRooms(task.section)
    timeSlots = generateTimeSlots(task.subject.hoursPerWeek)
    
    for faculty in eligibleFaculty:
        for room in suitableRooms:
            for slot in timeSlots:
                // Check ALL hard constraints
                if not checkAllConstraints(faculty, room, slot, task):
                    continue
                
                score = calculateScore(faculty, room, slot, task)
                candidates.push(createCandidate(faculty, room, slot, score))
    
    // Sort by score (best first) - LCV heuristic
    return candidates.sort(by: score, descending)
```

---

## Performance Considerations

### Complexity Analysis

| Operation | Complexity |
|-----------|------------|
| Task Creation | O(S × Se) where S = subjects, Se = sections |
| Sorting Tasks | O(T log T) where T = tasks |
| Candidate Generation | O(F × R × D × H) per task |
| Overall (Worst Case) | O(T × F × R × D × H × B) where B = backtracks |

**Typical Values**:
- Tasks: 50-200
- Faculty: 10-50
- Rooms: 5-20
- Days: 6
- Time Slots: ~30 per day
- Max Backtracks: 50,000

### Optimization Strategies

1. **Early Pruning**: Check constraints before creating candidate objects
2. **Candidate Limiting**: Max 1000 candidates per task
3. **Backtrack Limit**: Stop after 50,000 backtracks to prevent infinite loops
4. **Difficulty Sorting**: MCV heuristic reduces search space significantly
5. **Score Caching**: Avoid recalculating scores for same parameters

### Performance Benchmarks

| Scale | Tasks | Faculty | Rooms | Generation Time |
|-------|-------|---------|-------|-----------------|
| Small | 30 | 10 | 5 | < 1 second |
| Medium | 80 | 25 | 10 | 2-5 seconds |
| Large | 150 | 50 | 20 | 5-15 seconds |

---

## Summary

The FEPC Scheduling System uses a **well-engineered CSP algorithm** that:

1. **Models** the scheduling problem as constraint satisfaction
2. **Applies** intelligent heuristics (MRV, LCV, Forward Checking)
3. **Enforces** hard constraints to guarantee conflict-free schedules
4. **Optimizes** soft constraints via multi-objective scoring
5. **Handles** edge cases with backtracking and graceful degradation

This approach produces **high-quality schedules** that are:
- **Conflict-free** (no double-bookings)
- **Fair** (balanced faculty workload)
- **Efficient** (good room utilization)
- **Respectful** (follows preferences when possible)

---

*Last Updated: 2024*
*FEPC Scheduling System v1.0*
