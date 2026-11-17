from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from .algorithms import validate_state, banker_safety, resource_request, detect_multiple, wait_for_graph, recover_process, validate_order
import os

app = FastAPI(title="OS Deadlock Analysis API", version="1.0.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class State(BaseModel):
    allocation: List[List[int]]
    maximum: List[List[int]]
    available: List[int]
class Request(State):
    process_id: int
    request: List[int]
class Detection(BaseModel):
    allocation: List[List[int]]
    request: List[List[int]]
    available: List[int]
class Recovery(State):
    process_id: int
class OrderCheck(BaseModel):
    resource_order: List[str]
    acquisition: List[str]

@app.get("/health")
def health(): return {"status":"ok", "service":"os-deadlock-analysis-api"}
@app.post("/api/safety")
def safety(s: State):
    try:
        validate_state(s.allocation,s.maximum,s.available)
        return banker_safety(s.allocation,s.maximum,s.available)
    except ValueError as e: raise HTTPException(422,str(e))
@app.post("/api/request")
def request_resource(s: Request):
    try:
        validate_state(s.allocation,s.maximum,s.available)
        return resource_request(s.allocation,s.maximum,s.available,s.process_id,s.request)
    except ValueError as e: raise HTTPException(422,str(e))
@app.post("/api/detection/multiple")
def detection(s: Detection):
    try: return detect_multiple(s.allocation,s.request,s.available)
    except ValueError as e: raise HTTPException(422,str(e))
@app.post("/api/detection/single")
def single_detection(payload: dict):
    try: return wait_for_graph(payload.get("processes",[]),payload.get("waits",[]))
    except ValueError as e: raise HTTPException(422,str(e))
@app.post("/api/recovery")
def recovery(s: Recovery):
    try:
        validate_state(s.allocation,s.maximum,s.available)
        return recover_process(s.allocation,s.maximum,s.available,s.process_id)
    except ValueError as e: raise HTTPException(422,str(e))
@app.post("/api/prevention/order")
def prevention(s: OrderCheck):
    try: return validate_order(s.resource_order,s.acquisition)
    except ValueError as e: raise HTTPException(422,str(e))
