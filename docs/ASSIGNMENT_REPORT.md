# OS IA Assignment Activity 2 — Assignment Report

## 1. Objective
Develop an interactive dashboard to analyze operating-system resource allocation and demonstrate deadlock avoidance, detection, prevention and recovery. Users control process count, resource count, Allocation, Maximum, Available, process requests, and detection inputs.

## 2. Problem statement
A system may have multiple processes competing for finite resources. Incorrect allocation or circular waiting can prevent progress. The dashboard makes algorithm decisions visible and provides repeatable tests for safe/unsafe states and request outcomes.

## 3. Architecture
- **React + Vite + TypeScript:** responsive pages, editable matrices, validation-oriented controls, execution traces and result reporting.
- **FastAPI:** JSON API, request schema checks, HTTP 422 validation responses, CORS and `/health`.
- **Python algorithms:** Need calculation, Banker safety, atomic resource request simulation, multi-instance detection, wait-for graph cycle detection, recovery and resource-order validation.
- **pytest:** reproducible algorithm/API-independent unit tests.
- **Persistence:** none required; each request is stateless.

## 4. Folder structure
- `frontend/src/App.tsx`: dashboard navigation, matrix/vector editors and feature pages.
- `frontend/src/api.ts`: API base URL and JSON fetch helper.
- `frontend/src/styles.css`: responsive design system.
- `backend/app/main.py`: API routes, Pydantic request models, CORS and health check.
- `backend/app/algorithms.py`: pure algorithm functions and validation.
- `backend/tests/test_algorithms.py`: automated algorithm tests.
- `backend/Dockerfile`, `backend/render.yaml`: backend deployment setup.
- `frontend/vercel.json`: SPA routing for Vercel.

## 5. Banker’s algorithm
For each process and resource, `Need[i][j] = Maximum[i][j] - Allocation[i][j]`. Initialize `Work = Available` and all Finish values false. Find an unfinished process whose Need is component-wise no greater than Work. Mark it finished and add its Allocation to Work. Repeat. If every process finishes, the state is SAFE; otherwise it is UNSAFE.

### Assignment sample
Allocation:
| Process | R0 | R1 | R2 |
|---|---:|---:|---:|
| P0 | 0 | 1 | 0 |
| P1 | 2 | 0 | 0 |
| P2 | 3 | 0 | 2 |
| P3 | 2 | 1 | 1 |
| P4 | 0 | 0 | 2 |

Maximum:
| Process | R0 | R1 | R2 |
|---|---:|---:|---:|
| P0 | 7 | 5 | 3 |
| P1 | 3 | 2 | 2 |
| P2 | 9 | 0 | 2 |
| P3 | 2 | 2 | 2 |
| P4 | 4 | 3 | 3 |

Available = `(3, 3, 2)`.

Calculated Need:
| Process | R0 | R1 | R2 |
|---|---:|---:|---:|
| P0 | 7 | 4 | 3 |
| P1 | 1 | 2 | 2 |
| P2 | 6 | 0 | 0 |
| P3 | 0 | 1 | 1 |
| P4 | 4 | 3 | 1 |

Expected safe sequence: `P1 → P3 → P4 → P0 → P2`.

Work trace for that sequence:
| Process completed | Work before | Allocation released | Work after |
|---|---|---|---|
| P1 | (3,3,2) | (2,0,0) | (5,3,2) |
| P3 | (5,3,2) | (2,1,1) | (7,4,3) |
| P4 | (7,4,3) | (0,0,2) | (7,4,5) |
| P0 | (7,4,5) | (0,1,0) | (7,5,5) |
| P2 | (7,5,5) | (3,0,2) | (10,5,7) |

## 6. Resource request decisions
The algorithm validates process ID, vector size, integer/non-negative request values and the process's remaining Need. If request exceeds Need, return INVALID REQUEST. If it is within Need but exceeds Available, return WAITING/DEFERRED. Otherwise simulate allocation and run safety. If unsafe, return DENIED and leave original state unchanged; if safe, return GRANTED and new state.

For sample P0 request `(0,4,0)`, expected status is WAITING/DEFERRED because R1 Available is 3. For `(0,3,0)`, expected status is DENIED because tentative Available becomes `(3,0,2)` and no complete safe sequence exists. Both rejections must preserve the original state.

## 7. Detection assumptions
- **Single-instance:** model waits as directed edges in a wait-for graph. A cycle confirms deadlock under the single-instance assumption.
- **Multiple-instance:** use Allocation, outstanding Request and Available. Repeatedly find a process whose Request can be met by Work, then release its Allocation. Unfinished processes are classified as deadlocked under this model. A graph cycle alone is not sufficient proof in a multiple-instance system.

## 8. Recovery and prevention
Recovery is user-confirmed: terminate a selected process, release its allocation into Available and recalculate the remaining state. This may lose work or disrupt dependencies. Resource-ordering prevention defines a global strict order; acquisition that moves backward in that order is rejected. This removes circular wait but may reduce flexibility or cause extra waiting.

## 9. Boundary tests
The pytest suite covers sample sequence, zero Available, zero Need, invalid process ID, negative request, Allocation > Maximum, request > Need, request > Available, unsafe request rollback, granted safe request, unsafe state with no full sequence, multiple-instance detection, wait-for cycle, recovery release and ordering. Run `python -m pytest -v` from `backend` and report the actual terminal outcome. The UI additionally provides ten live API boundary checks with expected/actual PASS/FAIL rows.

## 10. Screenshot evidence checklist
Capture screenshots yourself after running the app: (1) overview, (2) safe-sequence trace, (3) WAITING/DEFERRED sample request, (4) DENIED request and unchanged state, (5) detection output, (6) recovery confirmation and result, (7) valid/invalid resource ordering, (8) executed boundary test table, (9) `/health` response. Do not present this checklist as evidence that screenshots have already been taken.

## 11. Six-minute presentation plan
- 0:00–0:40: objective and architecture.
- 0:40–1:50: Need matrix, Work vector and safe sequence.
- 1:50–3:00: resource request cases and rollback.
- 3:00–4:00: compare detection models.
- 4:00–4:50: recovery and global ordering.
- 4:50–5:40: run boundary checks and show actual report.
- 5:40–6:00: limitations and AI usage disclosure.

## 12. Viva questions
1. **What is a safe state?** A state with at least one completion order for all processes.
2. **Does unsafe mean deadlock?** No; it means the system cannot guarantee a safe completion order.
3. **Why calculate Need?** It is the remaining declared resource claim for each process.
4. **Why test a tentative request?** To avoid granting a request that makes the state unsafe.
5. **Why roll back?** A denied request must not mutate the original allocation state.
6. **Does every graph cycle imply deadlock?** No; the conclusion depends on resource-instance assumptions.
7. **How does resource ordering prevent circular wait?** All acquisitions follow one strict increasing order, so a circular chain cannot form.

## 13. Verification status
This report describes intended behavior. Record actual test output from the packaged automated suite and the UI's live test runner. Cloud deployment is not claimed unless independently performed and verified.
