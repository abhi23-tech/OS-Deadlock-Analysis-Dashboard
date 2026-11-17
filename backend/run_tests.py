import sys
from app.algorithms import (
    banker_safety,
    resource_request,
    validate_state,
    detect_multiple,
    wait_for_graph,
    recover_process,
    validate_order,
)

A = [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]]
M = [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]]
V = [3, 3, 2]

def run_all():
    tests = []
    
    def test_sample_safe_sequence():
        r = banker_safety(A, M, V)
        assert r['safe'], "Sample state should be safe"
        assert r['safe_sequence'] == [1, 3, 4, 0, 2], f"Expected sequence [1,3,4,0,2], got {r['safe_sequence']}"
    tests.append(("Sample safe sequence verification", test_sample_safe_sequence))

    def test_request_waiting_p0_040():
        r = resource_request(A, M, V, 0, [0, 4, 0])
        assert r['status'] == 'WAITING/DEFERRED'
        assert r['after'] == r['before']
    tests.append(("Request waiting P0 (0,4,0)", test_request_waiting_p0_040))

    def test_request_unsafe_p0_030():
        r = resource_request(A, M, V, 0, [0, 3, 0])
        assert r['status'] == 'DENIED'
        assert r['after'] == r['before']
    tests.append(("Request unsafe denied P0 (0,3,0)", test_request_unsafe_p0_030))

    def test_request_exceeds_need():
        r = resource_request(A, M, V, 0, [8, 0, 0])
        assert r['status'] == 'INVALID REQUEST'
    tests.append(("Request exceeds need detection", test_request_exceeds_need))

    def test_granted_request():
        a = [[1, 0], [0, 1]]
        m = [[2, 1], [1, 2]]
        v = [1, 1]
        r = resource_request(a, m, v, 0, [1, 0])
        assert r['status'] == 'GRANTED'
        assert r['after']['allocation'][0] == [2, 0]
    tests.append(("Valid safe request granted", test_granted_request))

    def test_zero_available():
        r = banker_safety([[1]], [[2]], [0])
        assert r['status'] == 'UNSAFE'
    tests.append(("Zero available edge case", test_zero_available))

    def test_zero_need_process():
        r = banker_safety([[1]], [[1]], [0])
        assert r['safe'] and r['safe_sequence'] == [0]
    tests.append(("Zero need process immediate completion", test_zero_need_process))

    def test_invalid_process_id():
        try:
            resource_request(A, M, V, 9, [0, 0, 0])
            assert False, "Should raise ValueError"
        except ValueError:
            pass
    tests.append(("Invalid process ID exception", test_invalid_process_id))

    def test_negative_request():
        try:
            resource_request(A, M, V, 0, [-1, 0, 0])
            assert False, "Should raise ValueError"
        except ValueError:
            pass
    tests.append(("Negative resource request rejection", test_negative_request))

    def test_allocation_greater_maximum():
        try:
            validate_state([[2]], [[1]], [0])
            assert False, "Should raise ValueError"
        except ValueError:
            pass
    tests.append(("Allocation > Maximum validation error", test_allocation_greater_maximum))

    def test_unsafe_state_no_complete_sequence():
        r = banker_safety([[1, 0], [0, 1]], [[2, 0], [0, 2]], [0, 0])
        assert not r['safe'] and r['safe_sequence'] == []
    tests.append(("Unsafe state with no complete sequence", test_unsafe_state_no_complete_sequence))

    def test_multiple_instance_detection():
        r = detect_multiple([[1], [1]], [[1], [1]], [0])
        assert r['deadlocked'] and r['unfinished_processes'] == [0, 1]
    tests.append(("Multi-instance deadlock detection", test_multiple_instance_detection))

    def test_wait_for_cycle():
        r = wait_for_graph(['P0', 'P1'], [['P0', 'P1'], ['P1', 'P0']])
        assert r['deadlocked']
    tests.append(("Wait-for graph cycle detection", test_wait_for_cycle))

    def test_recovery_releases_resources():
        r = recover_process([[1]], [[2]], [0], 0)
        assert r['available_after'] == [1]
    tests.append(("Recovery reclamation of resources", test_recovery_releases_resources))

    def test_order_validation():
        assert validate_order(['R0', 'R1'], ['R0', 'R1'])['valid']
        assert not validate_order(['R0', 'R1'], ['R1', 'R0'])['valid']
    tests.append(("Strict resource ordering validation", test_order_validation))

    passed = 0
    print(f"\n{'='*65}\n  RUNNING DEADLOCK ENGINE ALGORITHM VERIFICATION SUITE\n{'='*65}")
    for name, fn in tests:
        try:
            fn()
            print(f"  [ PASS ] {name}")
            passed += 1
        except Exception as e:
            print(f"  [ FAIL ] {name}: {e}")
    
    print(f"{'='*65}")
    print(f"  RESULT: {passed}/{len(tests)} test assertions passed successfully.")
    print(f"{'='*65}\n")
    return passed == len(tests)

if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
