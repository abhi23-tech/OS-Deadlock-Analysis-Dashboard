import pytest
from app.algorithms import banker_safety, resource_request, validate_state, detect_multiple, wait_for_graph, recover_process, validate_order
A=[[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]]
M=[[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]]
V=[3,3,2]
def test_sample_safe_sequence():
    r=banker_safety(A,M,V); assert r['safe']; assert r['safe_sequence']==[1,3,4,0,2]
def test_request_waiting_p0_040():
    r=resource_request(A,M,V,0,[0,4,0]); assert r['status']=='WAITING/DEFERRED'; assert r['after']==r['before']
def test_request_unsafe_p0_030():
    r=resource_request(A,M,V,0,[0,3,0]); assert r['status']=='DENIED'; assert r['after']==r['before']
def test_request_exceeds_need():
    r=resource_request(A,M,V,0,[8,0,0]); assert r['status']=='INVALID REQUEST'
def test_granted_request():
    # Safe state with request within need and availability
    a=[[1,0],[0,1]]; m=[[2,1],[1,2]]; v=[1,1]
    r=resource_request(a,m,v,0,[1,0]); assert r['status']=='GRANTED'; assert r['after']['allocation'][0]==[2,0]
def test_zero_available():
    r=banker_safety([[1]],[[2]],[0]); assert r['status']=='UNSAFE'
def test_zero_need_process():
    r=banker_safety([[1]],[[1]],[0]); assert r['safe'] and r['safe_sequence']==[0]
def test_invalid_process_id():
    with pytest.raises(ValueError): resource_request(A,M,V,9,[0,0,0])
def test_negative_request():
    with pytest.raises(ValueError): resource_request(A,M,V,0,[-1,0,0])
def test_allocation_greater_maximum():
    with pytest.raises(ValueError): validate_state([[2]],[[1]],[0])
def test_request_exceeds_available():
    r=resource_request(A,M,V,0,[0,4,0]); assert r['status']=='WAITING/DEFERRED'
def test_unsafe_state_no_complete_sequence():
    r=banker_safety([[1,0],[0,1]],[[2,0],[0,2]],[0,0]); assert not r['safe'] and r['safe_sequence']==[]
def test_multiple_instance_detection():
    r=detect_multiple([[1],[1]],[[1],[1]],[0]); assert r['deadlocked'] and r['unfinished_processes']==[0,1]
def test_wait_for_cycle():
    r=wait_for_graph(['P0','P1'],[['P0','P1'],['P1','P0']]); assert r['deadlocked']
def test_recovery_releases_resources():
    r=recover_process([[1]],[[2]],[0],0); assert r['available_after']==[1]
def test_order_validation():
    assert validate_order(['R0','R1'],['R0','R1'])['valid']; assert not validate_order(['R0','R1'],['R1','R0'])['valid']
