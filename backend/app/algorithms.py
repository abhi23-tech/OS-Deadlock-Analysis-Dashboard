from copy import deepcopy

def _matrix_shape(matrix, name):
    if not isinstance(matrix, list) or not matrix: raise ValueError(f"{name} must contain at least one process row")
    if not isinstance(matrix[0], list) or not matrix[0]: raise ValueError(f"{name} must contain at least one resource column")
    width=len(matrix[0])
    for i,row in enumerate(matrix):
        if not isinstance(row,list) or len(row)!=width: raise ValueError(f"{name} has inconsistent dimensions at row P{i}")
        for j,v in enumerate(row):
            if isinstance(v,bool) or not isinstance(v,int): raise ValueError(f"{name}[{i}][{j}] must be an integer")
            if v<0: raise ValueError(f"{name}[{i}][{j}] cannot be negative")

def validate_state(allocation, maximum, available):
    _matrix_shape(allocation,"Allocation"); _matrix_shape(maximum,"Maximum")
    if len(allocation)!=len(maximum) or len(allocation[0])!=len(maximum[0]): raise ValueError("Allocation and Maximum dimensions must match")
    if not isinstance(available,list) or len(available)!=len(allocation[0]): raise ValueError("Available vector length must match resource count")
    for j,v in enumerate(available):
        if isinstance(v,bool) or not isinstance(v,int): raise ValueError(f"Available[{j}] must be an integer")
        if v<0: raise ValueError("Available values cannot be negative")
    for i in range(len(allocation)):
        for j in range(len(available)):
            if allocation[i][j]>maximum[i][j]: raise ValueError(f"Allocation exceeds Maximum at P{i}, R{j}")
    return True

def need_matrix(allocation, maximum):
    return [[maximum[i][j]-allocation[i][j] for j in range(len(maximum[0]))] for i in range(len(maximum))]

def banker_safety(allocation, maximum, available):
    validate_state(allocation,maximum,available)
    alloc=deepcopy(allocation); need=need_matrix(alloc,maximum); work=available[:]; initial_work=work[:]
    finish=[False]*len(alloc); sequence=[]; trace=[]; cursor=0
    while True:
        selected=None
        for offset in range(len(alloc)):
            i=(cursor+offset)%len(alloc)
            if not finish[i] and all(need[i][j]<=work[j] for j in range(len(work))): selected=i; break
        if selected is None: break
        before=work[:]; work=[work[j]+alloc[selected][j] for j in range(len(work))]
        finish[selected]=True; sequence.append(selected); cursor=(selected+1)%len(alloc)
        trace.append({"process":selected,"need":need[selected][:],"work_before":before,"released_allocation":alloc[selected][:],"work_after":work[:]})
    safe=all(finish)
    return {"safe":safe,"status":"SAFE" if safe else "UNSAFE","allocation":alloc,"maximum":deepcopy(maximum),"need":need,"available":available[:],"initial_work":initial_work,"finish":finish,"safe_sequence":sequence if safe else [],"partial_sequence":sequence,"trace":trace,"explanation":"All processes can finish in this order." if safe else "No complete safe sequence exists. Unsafe does not necessarily mean a deadlock has already occurred."}

def resource_request(allocation, maximum, available, process_id, request):
    validate_state(allocation,maximum,available)
    n=len(allocation); m=len(available)
    if isinstance(process_id,bool) or not isinstance(process_id,int) or not 0<=process_id<n: raise ValueError(f"Invalid process ID: choose P0 through P{n-1}")
    if not isinstance(request,list) or len(request)!=m: raise ValueError("Request vector length must match resource count")
    if any(isinstance(x,bool) or not isinstance(x,int) for x in request): raise ValueError("Request values must be integers")
    if any(x<0 for x in request): raise ValueError("Request values cannot be negative")
    need=need_matrix(allocation,maximum)
    if any(request[j]>need[process_id][j] for j in range(m)):
        return {"status":"INVALID REQUEST","granted":False,"reason":"Request exceeds the process's remaining Need. Original state is unchanged.","request":request,"before":{"allocation":allocation,"need":need,"available":available},"after":{"allocation":allocation,"need":need,"available":available}}
    if any(request[j]>available[j] for j in range(m)):
        return {"status":"WAITING/DEFERRED","granted":False,"reason":"Request is within Need but exceeds currently Available resources. Original state is unchanged.","request":request,"before":{"allocation":allocation,"need":need,"available":available},"after":{"allocation":allocation,"need":need,"available":available}}
    before={"allocation":deepcopy(allocation),"need":need,"available":available[:]}
    trial_a=deepcopy(allocation); trial_v=available[:]
    for j in range(m): trial_a[process_id][j]+=request[j]; trial_v[j]-=request[j]
    safety=banker_safety(trial_a,maximum,trial_v)
    if not safety["safe"]:
        return {"status":"DENIED","granted":False,"reason":"Tentative allocation makes the state unsafe; the transaction was rolled back exactly.","request":request,"before":before,"after":before,"safety_check":safety}
    return {"status":"GRANTED","granted":True,"reason":"Request is within Need and Available, and the tentative state remains safe.","request":request,"before":before,"after":{"allocation":trial_a,"need":need_matrix(trial_a,maximum),"available":trial_v},"safe_sequence":safety["safe_sequence"],"safety_check":safety}

def detect_multiple(allocation, request, available):
    _matrix_shape(allocation,"Allocation"); _matrix_shape(request,"Request")
    if len(allocation)!=len(request) or len(allocation[0])!=len(request[0]): raise ValueError("Allocation and Request dimensions must match")
    if len(available)!=len(allocation[0]): raise ValueError("Available vector length must match resource count")
    for mat,name in ((allocation,"Allocation"),(request,"Request")):
        for row in mat:
            if any(isinstance(v,bool) or not isinstance(v,int) or v<0 for v in row): raise ValueError(f"{name} values must be non-negative integers")
    if any(isinstance(v,bool) or not isinstance(v,int) or v<0 for v in available): raise ValueError("Available values must be non-negative integers")
    work=available[:]; finish=[all(v==0 for v in row) for row in allocation]; trace=[]; completed=[]
    while True:
        found=None
        for i in range(len(allocation)):
            if not finish[i] and all(request[i][j]<=work[j] for j in range(len(work))): found=i; break
        if found is None: break
        before=work[:]; work=[work[j]+allocation[found][j] for j in range(len(work))]; finish[found]=True; completed.append(found)
        trace.append({"process":found,"work_before":before,"request":request[found][:],"released_allocation":allocation[found][:],"work_after":work[:]})
    unfinished=[i for i,v in enumerate(finish) if not v]
    return {"deadlocked":bool(unfinished),"status":"DEADLOCKED" if unfinished else "NO DEADLOCK DETECTED","unfinished_processes":unfinished,"completed_sequence":completed,"work_final":work,"trace":trace,"explanation":"Unfinished processes cannot satisfy outstanding requests with current Work; under this detection model they are deadlocked." if unfinished else "Every process can finish under the current detection model."}

def wait_for_graph(processes, waits):
    nodes=list(dict.fromkeys(str(p) for p in processes)); graph={p:[] for p in nodes}
    for edge in waits:
        if not isinstance(edge,list) or len(edge)!=2: raise ValueError("Each wait edge must be [waiting_process, blocking_process]")
        a,b=map(str,edge)
        if a not in graph or b not in graph: raise ValueError(f"Unknown process in wait edge {a} -> {b}")
        graph[a].append(b)
    visiting=set(); visited=set(); path=[]; cycle=[]
    def dfs(node):
        nonlocal cycle
        visiting.add(node); path.append(node)
        for nxt in graph[node]:
            if nxt in visiting:
                cycle=path[path.index(nxt):]+[nxt]; return True
            if nxt not in visited and dfs(nxt): return True
        path.pop(); visiting.remove(node); visited.add(node); return False
    for node in nodes:
        if node not in visited and dfs(node): break
    return {"deadlocked":bool(cycle),"status":"DEADLOCKED" if cycle else "NO CYCLE DETECTED","graph":graph,"cycle":cycle,"assumption":"Single instance per resource type; a wait-for graph cycle confirms deadlock under this model."}

def recover_process(allocation, maximum, available, process_id):
    validate_state(allocation,maximum,available)
    if isinstance(process_id,bool) or not isinstance(process_id,int) or not 0<=process_id<len(allocation): raise ValueError("Invalid process ID")
    old=deepcopy(allocation); new=deepcopy(allocation); released=new[process_id][:]; new[process_id]=[0]*len(available)
    new_available=[available[j]+released[j] for j in range(len(available))]
    new_max=deepcopy(maximum); new_max[process_id]=[0]*len(available)
    safety=banker_safety(new,new_max,new_available)
    return {"status":"RECOVERY COMPLETE","terminated_process":process_id,"released_resources":released,"allocation_before":old,"allocation_after":new,"available_before":available[:],"available_after":new_available,"safety_after_recovery":safety}

def validate_order(resource_order, acquisition):
    if len(set(resource_order))!=len(resource_order): raise ValueError("Resource order must not contain duplicates")
    if any(r not in resource_order for r in acquisition): raise ValueError("Acquisition includes a resource absent from configured order")
    ranks={r:i for i,r in enumerate(resource_order)}
    violations=[(acquisition[i],acquisition[i+1]) for i in range(len(acquisition)-1) if ranks[acquisition[i]]>ranks[acquisition[i+1]]]
    return {"valid":not violations,"status":"VALID ORDER" if not violations else "INVALID ORDER","acquisition":acquisition,"violations":[{"from":a,"to":b} for a,b in violations],"explanation":"Acquiring resources only in one global increasing order prevents circular wait." if not violations else "This acquisition order moves backwards in the configured global order and violates the prevention rule."}
